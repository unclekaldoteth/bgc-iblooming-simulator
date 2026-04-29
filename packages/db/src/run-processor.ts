import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import {
  evaluateFounderScenarioGuardrails,
  parseFounderSafeScenarioParameters,
  scenarioGuardrailMatrix,
  type DecisionPack,
  type DecisionPackHistoricalTruthCoverage,
  type MilestoneEvaluation,
  type RunFlag,
  type SimulationRunRequest,
  type StrategicObjectiveScorecard,
  type SummaryMetrics
} from "@bgc-alpha/schemas";
import { evaluateRecommendation, simulateScenario } from "@bgc-alpha/simulation-core";

import { upsertRunDecisionPack } from "./decision-packs";
import {
  getSnapshotTruthCoverage,
  getSnapshotCanonicalGapAudit,
  listSnapshotMemberMonthFacts,
  listSnapshotPoolPeriodFacts
} from "./snapshots";
import {
  getRunById,
  markRunFailed,
  markRunStarted,
  persistCompletedRun
} from "./runs";
import { writeAuditEvent } from "./audit";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency"
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const tokenAmountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const scenarioGuardrailByKey = new Map(
  scenarioGuardrailMatrix.map((entry) => [entry.parameter_key, entry] as const)
);

const realDataModeLabel = "Imported Data Only";
const forecastModeLabel = "Add Forecast";

const simpleScenarioValueLabels: Record<string, string> = {
  advanced_forecast: forecastModeLabel,
  alpha_internal: "Internal ALPHA",
  auto: "Auto",
  capped_emission: "Capped emission",
  cohort_projection: "Member forecast",
  dao: "DAO",
  externally_transferable: "Externally transferable",
  fixed_accounting: "Fixed internal rate",
  fixed_supply: "Fixed supply",
  founder_admin: "Team admin",
  future_on_chain_token: "Future on-chain token",
  internal_credit: "Internal credit",
  liquidity_pool: "Liquidity pool price",
  mainnet: "Mainnet",
  market_forecast: "Market forecast",
  multisig_admin: "Multisig admin",
  non_transferable: "Not transferable",
  not_applicable_internal: "Internal only / not applicable",
  not_on_chain: "Not on-chain",
  not_started: "Not started",
  off_chain_token: "Off-chain token",
  oracle_feed: "Oracle price feed",
  planned: "Planned",
  platform_limited: "Platform-limited",
  points: "Points",
  projection_overlay: "Add projection",
  snapshot_window: "Imported data period only",
  token_voting: "Token voting",
  uncapped_internal: "Uncapped internal",
  unreviewed: "Unreviewed"
};

const tokenPriceBasisLabels: Record<string, string> = {
  fixed_accounting: "Fixed internal rate",
  liquidity_pool: "Liquidity pool price",
  market_forecast: "Market forecast",
  not_applicable_internal: "Internal only / no market price",
  oracle_feed: "Oracle price feed"
};

function readMetadataRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readRecordAlias(
  record: Record<string, unknown> | null,
  aliases: string[]
) {
  if (!record) {
    return null;
  }

  for (const alias of aliases) {
    const candidate = readMetadataRecord(record[alias]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function readNumberAlias(
  record: Record<string, unknown> | null,
  aliases: string[]
) {
  if (!record) {
    return null;
  }

  for (const alias of aliases) {
    const candidate = readOptionalNumber(record[alias]);

    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function readStringAlias(
  record: Record<string, unknown> | null,
  aliases: string[]
) {
  if (!record) {
    return null;
  }

  for (const alias of aliases) {
    const candidate = readOptionalString(record[alias]);

    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function buildPoolFundingEntries(
  metadata: Record<string, unknown> | null,
  periodKey: string,
  sourceSystem: string
) {
  const poolFundingBasis = readRecordAlias(metadata, ["pool_funding_basis", "poolFundingBasis"]);
  const poolShareSnapshot = readRecordAlias(metadata, ["pool_share_snapshot", "poolShareSnapshot"]);

  if (!poolFundingBasis) {
    return null;
  }

  const entries = Object.entries(poolFundingBasis)
    .flatMap(([poolCode, poolValue]) => {
      const normalizedPoolValue = readMetadataRecord(poolValue);

      if (!normalizedPoolValue) {
        return [];
      }

      const fundingAmount = readNumberAlias(normalizedPoolValue, ["funding_amount", "fundingAmount"]);

      if (!(fundingAmount && fundingAmount > 0)) {
        return [];
      }

      const distributionAmount =
        readNumberAlias(normalizedPoolValue, ["distribution_amount", "distributionAmount"]) ?? 0;
      const distributionCycle =
        readStringAlias(normalizedPoolValue, ["distribution_cycle", "distributionCycle"]) ?? "ADHOC";
      const shareSnapshot = poolShareSnapshot
        ? readMetadataRecord(poolShareSnapshot[poolCode])
        : null;
      const eligibilitySnapshotKey =
        readStringAlias(shareSnapshot, ["eligibility_snapshot_key", "eligibilitySnapshotKey"]) ??
        `${periodKey}::${sourceSystem}::${poolCode}::${distributionCycle}`;

      return [
        {
          poolCode,
          fundingAmount,
          distributionAmount,
          distributionCycle,
          cycleKey: eligibilitySnapshotKey
        }
      ];
    })
    .sort((left, right) => left.poolCode.localeCompare(right.poolCode));

  return entries.length > 0 ? entries : null;
}

function buildSimulationFact(
  fact: Awaited<ReturnType<typeof listSnapshotMemberMonthFacts>>[number]
) {
  const metadata = readMetadataRecord(fact.metadataJson);
  const recognizedRevenueUsd =
    readNumberAlias(metadata, ["recognizedRevenueUsd", "recognized_revenue_usd"]);
  const grossMarginUsd =
    readNumberAlias(metadata, ["grossMarginUsd", "gross_margin_usd"]);
  const memberJoinPeriod =
    readStringAlias(metadata, ["memberJoinPeriod", "member_join_period"]);
  const isAffiliate =
    readOptionalBoolean(metadata?.isAffiliate) ?? readOptionalBoolean(metadata?.is_affiliate);
  const crossAppActive =
    readOptionalBoolean(metadata?.crossAppActive) ?? readOptionalBoolean(metadata?.cross_app_active);
  const recognizedRevenueBasis = readRecordAlias(metadata, [
    "recognized_revenue_basis",
    "recognizedRevenueBasis"
  ]);
  const sinkBreakdown = readRecordAlias(metadata, ["sink_breakdown_usd", "sinkBreakdownUsd"]);
  const entryFeeUsd = readNumberAlias(recognizedRevenueBasis, ["entry_fee_usd", "entryFeeUsd"]);
  const grossSaleUsd = readNumberAlias(recognizedRevenueBasis, ["gross_sale_usd", "grossSaleUsd"]);
  const cpUserShareUsd = readNumberAlias(recognizedRevenueBasis, ["cp_user_share_usd", "cpUserShareUsd"]);
  const ibPlatformRevenueUsd = readNumberAlias(recognizedRevenueBasis, [
    "ib_platform_revenue_usd",
    "ibPlatformRevenueUsd"
  ]);
  const productFulfillmentOutUsd = readNumberAlias(sinkBreakdown, ["PC_SPEND"]);

  let grossCashInUsd: number | null = null;
  let retainedRevenueUsd: number | null = recognizedRevenueUsd;
  let partnerPayoutOutUsd: number | null = null;

  if (entryFeeUsd !== null) {
    grossCashInUsd = entryFeeUsd;
    retainedRevenueUsd = entryFeeUsd;
  } else if (grossSaleUsd !== null) {
    grossCashInUsd = grossSaleUsd;
    retainedRevenueUsd = ibPlatformRevenueUsd ?? recognizedRevenueUsd;
    partnerPayoutOutUsd = cpUserShareUsd;
  } else if (recognizedRevenueUsd !== null) {
    grossCashInUsd = recognizedRevenueUsd;
    retainedRevenueUsd = recognizedRevenueUsd;
  }

  return {
    periodKey: fact.periodKey,
    memberKey: fact.memberKey,
    sourceSystem: fact.sourceSystem,
    memberTier: fact.memberTier,
    groupKey: fact.groupKey,
    pcVolume: fact.pcVolume,
    spRewardBasis: fact.spRewardBasis,
    globalRewardUsd: fact.globalRewardUsd,
    poolRewardUsd: fact.poolRewardUsd,
    cashoutUsd: fact.cashoutUsd,
    sinkSpendUsd: fact.sinkSpendUsd,
    activeMember: fact.activeMember,
    recognizedRevenueUsd,
    grossMarginUsd,
    memberJoinPeriod,
    isAffiliate,
    crossAppActive,
    grossCashInUsd,
    retainedRevenueUsd,
    partnerPayoutOutUsd,
    productFulfillmentOutUsd,
    poolFundingEntries: buildPoolFundingEntries(metadata, fact.periodKey, fact.sourceSystem)
  };
}

function buildSummary(run: Awaited<ReturnType<typeof getRunById>>): SummaryMetrics {
  const metricValue = (metricKey: string) =>
    run?.summaryMetrics.find((metric) => metric.metricKey === metricKey)?.metricValue ?? 0;

  return {
    alpha_issued_total: metricValue("alpha_issued_total"),
    alpha_actual_spent_total: metricValue("alpha_actual_spent_total"),
    alpha_modeled_spent_total: metricValue("alpha_modeled_spent_total"),
    alpha_spent_total: metricValue("alpha_spent_total"),
    alpha_held_total: metricValue("alpha_held_total"),
    alpha_cashout_equivalent_total: metricValue("alpha_cashout_equivalent_total"),
    alpha_opening_balance_total: metricValue("alpha_opening_balance_total"),
    alpha_ending_balance_total: metricValue("alpha_ending_balance_total"),
    alpha_expired_burned_total: metricValue("alpha_expired_burned_total"),
    company_gross_cash_in_total: metricValue("company_gross_cash_in_total"),
    company_retained_revenue_total: metricValue("company_retained_revenue_total"),
    company_partner_payout_out_total: metricValue("company_partner_payout_out_total"),
    company_direct_reward_obligation_total: metricValue("company_direct_reward_obligation_total"),
    company_pool_funding_obligation_total: metricValue("company_pool_funding_obligation_total"),
    company_actual_payout_out_total: metricValue("company_actual_payout_out_total"),
    company_product_fulfillment_out_total: metricValue("company_product_fulfillment_out_total"),
    company_net_treasury_delta_total: metricValue("company_net_treasury_delta_total"),
    actual_sink_utilization_rate: metricValue("actual_sink_utilization_rate"),
    modeled_sink_utilization_rate: metricValue("modeled_sink_utilization_rate"),
    sink_utilization_rate: metricValue("sink_utilization_rate"),
    payout_inflow_ratio: metricValue("payout_inflow_ratio"),
    reserve_runway_months: metricValue("reserve_runway_months"),
    reward_concentration_top10_pct: metricValue("reward_concentration_top10_pct"),
    forecast_actual_period_count: metricValue("forecast_actual_period_count"),
    forecast_projected_period_count: metricValue("forecast_projected_period_count")
  };
}

function buildFlags(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>): RunFlag[] {
  return run.flags.map((flag) => ({
    flag_type: flag.flagType,
    severity:
      flag.severity === "critical" || flag.severity === "warning" || flag.severity === "info"
        ? flag.severity
        : "warning",
    message: flag.message,
    period_key: flag.periodKey
  }));
}

function runNeedsDecisionPackRefresh(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>) {
  const summaryKeys = new Set(run.summaryMetrics.map((metric) => metric.metricKey));

  if (
    !summaryKeys.has("alpha_actual_spent_total") ||
    !summaryKeys.has("alpha_modeled_spent_total") ||
    !summaryKeys.has("actual_sink_utilization_rate") ||
    !summaryKeys.has("modeled_sink_utilization_rate")
  ) {
    return true;
  }

  const latestPack = run.decisionPacks[0];

  if (!latestPack) {
    return true;
  }

  const recommendation = readMetadataRecord(latestPack.recommendationJson);
  const tokenFlowEvidence = readMetadataRecord(recommendation?.token_flow_evidence);

  if (!tokenFlowEvidence) {
    return true;
  }

  const rows = Array.isArray(tokenFlowEvidence.rows) ? tokenFlowEvidence.rows : [];

  return !rows.some((row) => readMetadataRecord(row)?.key === "scenario_mode");
}

function formatPercent(value: number) {
  return `${percentageFormatter.format(value)}%`;
}

function formatSimpleScenarioValue(value: string) {
  return simpleScenarioValueLabels[value] ?? value.replace(/_/g, " ");
}

function formatTokenPriceBasis(value: string) {
  return tokenPriceBasisLabels[value] ?? formatSimpleScenarioValue(value);
}

function formatPlanningHorizon(months: number | null) {
  return months ? `${months} months` : "snapshot window";
}

function isAdvancedForecastMode(parameters: ReturnType<typeof parseFounderSafeScenarioParameters>) {
  return parameters.scenario_mode === "advanced_forecast";
}

function buildScenarioModeValue(parameters: ReturnType<typeof parseFounderSafeScenarioParameters>) {
  return isAdvancedForecastMode(parameters) ? forecastModeLabel : realDataModeLabel;
}

function buildCohortProjectionValue(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>
) {
  const cohort = parameters.cohort_assumptions;

  if (
    cohort.new_members_per_month === 0 &&
    cohort.monthly_churn_rate_pct === 0 &&
    cohort.monthly_reactivation_rate_pct === 0
  ) {
    return isAdvancedForecastMode(parameters)
      ? "on, but growth assumptions are still 0"
      : "off in Imported Data Only";
  }

  return [
    `${cohort.new_members_per_month} new/month`,
    `${formatPercent(cohort.monthly_churn_rate_pct)} churn`,
    `${formatPercent(cohort.monthly_reactivation_rate_pct)} reactivation`
  ].join(" · ");
}

function buildMilestoneValue(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>
) {
  if (parameters.milestone_schedule.length === 0) {
    return "none";
  }

  return `${parameters.milestone_schedule.length} phase${
    parameters.milestone_schedule.length === 1 ? "" : "s"
  }`;
}

function buildSinkAdoptionValue(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>
) {
  const sink = parameters.sink_adoption_model;

  if (
    sink.sink_adoption_rate_pct === 0 ||
    sink.eligible_member_share_pct === 0 ||
    sink.avg_sink_ticket_usd === 0 ||
    sink.sink_frequency_per_month === 0
  ) {
    return "disabled";
  }

  return [
    `${formatPercent(sink.sink_adoption_rate_pct)} adoption`,
    `${formatPercent(sink.eligible_member_share_pct)} eligible`,
    `${currencyFormatter.format(sink.avg_sink_ticket_usd)} ticket`,
    `${sink.sink_frequency_per_month}/mo`,
    `${formatPercent(sink.alpha_payment_share_pct)} ALPHA share`,
    `${formatPercent(sink.sink_growth_rate_pct)} monthly growth`
  ].join(" · ");
}

function formatNullableNumber(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "not set";
}

function formatNullableCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? currencyFormatter.format(value) : "not set";
}

function formatNullableTokenAmount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? tokenAmountFormatter.format(value)
    : "not set";
}

function divideIfReady(numerator: number | null | undefined, denominator: number | null | undefined) {
  return typeof numerator === "number" &&
    typeof denominator === "number" &&
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    denominator > 0
    ? numerator / denominator
    : null;
}

function buildTokenFlowEvidence(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>,
  summary: SummaryMetrics,
  truthCoverage: DecisionPackHistoricalTruthCoverage,
  canonicalGapAudit: DecisionPack["canonical_gap_audit"]
): DecisionPack["token_flow_evidence"] {
  const tokenPolicy = parameters.alpha_token_policy;
  const forecastPolicy = parameters.forecast_policy;
  const web3 = parameters.web3_tokenomics;
  const market = web3.market;
  const advancedForecastMode = isAdvancedForecastMode(parameters);
  const web3AssumptionsOpen =
    web3.network_status !== "not_applicable_internal" ||
    web3.supply_model !== "not_applicable_internal" ||
    market.price_basis !== "not_applicable_internal" ||
    tokenPolicy.on_chain_status !== "not_on_chain" ||
    tokenPolicy.transferability === "externally_transferable";
  const poolPrice = divideIfReady(market.liquidity_pool_usd, market.liquidity_pool_alpha);
  const effectiveAlphaUsdPrice =
    market.alpha_usd_price ?? (market.price_basis === "liquidity_pool" ? poolPrice : null);
  const reserveBackingPrice = divideIfReady(market.treasury_reserve_usd, market.circulating_supply);
  const reserveBackingPct =
    reserveBackingPrice !== null && effectiveAlphaUsdPrice
      ? (reserveBackingPrice / effectiveAlphaUsdPrice) * 100
      : null;
  const marketCap =
    effectiveAlphaUsdPrice && market.circulating_supply
      ? effectiveAlphaUsdPrice * market.circulating_supply
      : null;
  const sellPressureUsd =
    effectiveAlphaUsdPrice && market.monthly_sell_pressure_alpha
      ? effectiveAlphaUsdPrice * market.monthly_sell_pressure_alpha
      : null;
  const netMonthlyDemandUsd =
    typeof market.monthly_buy_demand_usd === "number" && sellPressureUsd !== null
      ? market.monthly_buy_demand_usd - sellPressureUsd
      : null;
  const liquidityPoolReady =
    market.price_basis !== "liquidity_pool" ||
    (typeof market.liquidity_pool_alpha === "number" &&
      market.liquidity_pool_alpha > 0 &&
      typeof market.liquidity_pool_usd === "number" &&
      market.liquidity_pool_usd > 0);
  const marketPriceReady =
    market.price_basis === "not_applicable_internal" ||
    (typeof effectiveAlphaUsdPrice === "number" && Number.isFinite(effectiveAlphaUsdPrice)) ||
    (market.price_basis === "liquidity_pool" && liquidityPoolReady && poolPrice !== null);
  const allocationValues = [
    web3.allocation.community_pct,
    web3.allocation.treasury_pct,
    web3.allocation.team_pct,
    web3.allocation.investor_pct,
    web3.allocation.liquidity_pct
  ];
  const allocationTotal = allocationValues.reduce<number>(
    (total, value) => total + (typeof value === "number" ? value : 0),
    0
  );
  const allocationComplete = allocationValues.every((value): value is number => typeof value === "number");
  const caveats: string[] = [];

  if (summary.reward_concentration_top10_pct > 60) {
    caveats.push("Reward concentration is high, so public token wording should not claim broad distribution yet.");
  }

  if (summary.forecast_projected_period_count > 0) {
    caveats.push("Forecast months are assumptions and must stay separate from uploaded data months.");
  }

  if (advancedForecastMode) {
    caveats.push("Add Forecast uses growth assumptions. Whitepaper must describe these outputs as estimates, not observed data.");
  }

  if (summary.alpha_modeled_spent_total > 0) {
    caveats.push("Internal-use totals include modeled demand; uploaded internal-use data remains separated from forecast adoption.");
  }

  if (truthCoverage.status !== "strong") {
    caveats.push("Imported data is not fully strong yet, so Whitepaper text must keep data caveats.");
  }

  if (canonicalGapAudit.readiness !== "strong") {
    caveats.push("Source detail is not fully complete; ALPHA flow claims should cite the accepted working basis.");
  }

  if (web3AssumptionsOpen) {
    caveats.push("Web3 supply, transferability, liquidity, decision rules, smart-contract, and legal assumptions still require team/legal approval.");
  }

  if (market.price_basis !== "not_applicable_internal" && !marketPriceReady) {
    caveats.push("ALPHA market price is not set, so public-token value claims are not ready.");
  }

  if (market.price_basis === "liquidity_pool" && !liquidityPoolReady) {
    caveats.push("Liquidity pool price needs both ALPHA amount and USDC reserve before it can support a public price claim.");
  }

  if (
    reserveBackingPct !== null &&
    market.price_basis !== "not_applicable_internal" &&
    reserveBackingPct < 100
  ) {
    caveats.push("Treasury reserve backing is below the selected ALPHA price, so $1-style language needs stronger support.");
  }

  if (netMonthlyDemandUsd !== null && netMonthlyDemandUsd < 0) {
    caveats.push("Estimated monthly sell pressure is higher than buy demand at the selected ALPHA price.");
  }

  return {
    readiness: web3AssumptionsOpen
      ? "web3_gap_open"
      : truthCoverage.status === "strong"
        ? "tokenflow_ready"
        : "whitepaper_draft_ready",
    summary: web3AssumptionsOpen
      ? "ALPHA flow is supported by this result, but public Web3 token assumptions are still open."
      : "Phase 1 ALPHA is supported as an internal, non-transferable credit.",
    rows: [
      {
        key: "alpha_spec_lock",
        label: "ALPHA Policy",
        value: `${formatSimpleScenarioValue(tokenPolicy.classification)} · ${formatSimpleScenarioValue(tokenPolicy.transferability)} · ${formatSimpleScenarioValue(tokenPolicy.on_chain_status)}`,
        status:
          tokenPolicy.classification === "internal_credit" &&
          tokenPolicy.transferability === "non_transferable" &&
          tokenPolicy.on_chain_status === "not_on_chain"
            ? "locked"
            : "assumption",
        detail: "Defines what ALPHA is before token flow or whitepaper claims are written."
      },
      {
        key: "scenario_mode",
        label: "Result Mode",
        value: buildScenarioModeValue(parameters),
        status: advancedForecastMode ? "assumption" : "locked",
        detail: advancedForecastMode
          ? "Growth assumptions are on. Result, Compare, and Whitepaper must label them as estimates."
          : "Growth forecast is off; the run uses imported data only."
      },
      {
        key: "token_flow_ledger",
        label: "ALPHA Ledger",
        value: `ending ${summary.alpha_ending_balance_total} · burned ${summary.alpha_expired_burned_total}`,
        status: "ready",
        detail: "Result output includes opening balance, issued, actual used, modeled used, cash-out, expired/burned, and ending balance by month."
      },
      {
        key: "actual_vs_forecast_sink",
        label: "Actual vs Modeled Internal Use",
        value: `actual ${summary.alpha_actual_spent_total} · modeled ${summary.alpha_modeled_spent_total} · use ${formatPercent(summary.sink_utilization_rate)}`,
        status: summary.alpha_modeled_spent_total > 0 ? "assumption" : "ready",
        detail: `Uploaded internal-use data stays separate from forecast adoption assumptions (${buildSinkAdoptionValue(parameters)}).`
      },
      {
        key: "forecast_layer",
        label: "Forecast Settings",
        value: `${summary.forecast_actual_period_count} observed months · ${summary.forecast_projected_period_count} forecast months · ${formatSimpleScenarioValue(forecastPolicy.mode)}`,
        status: summary.forecast_projected_period_count > 0 || forecastPolicy.mode !== "snapshot_window" ? "assumption" : "ready",
        detail: "Uploaded data months and forecast months are separated in the result evidence."
      },
      {
        key: "supply_model",
        label: "Supply Model",
        value: `${formatSimpleScenarioValue(web3.supply_model)} · max supply ${formatNullableNumber(web3.max_supply)}`,
        status: web3.supply_model === "not_applicable_internal" ? "locked" : web3.max_supply ? "assumption" : "blocked",
        detail: "Public Web3 token plans need a clear supply policy before they can be described as final."
      },
      {
        key: "token_price_basis",
        label: "Token Price Basis",
        value: `${formatTokenPriceBasis(market.price_basis)} · ALPHA price ${formatNullableCurrency(effectiveAlphaUsdPrice)}`,
        status: market.price_basis === "not_applicable_internal" ? "locked" : marketPriceReady ? "assumption" : "blocked",
        detail: "Shows whether ALPHA uses an internal rate, oracle feed, liquidity pool, or forecast price."
      },
      {
        key: "market_support",
        label: "Market Support",
        value: `market cap ${formatNullableCurrency(marketCap)} · reserve backing ${
          reserveBackingPct === null ? "not set" : `${percentageFormatter.format(reserveBackingPct)}%`
        }`,
        status:
          market.price_basis === "not_applicable_internal"
            ? "locked"
            : reserveBackingPct === null
              ? "assumption"
              : reserveBackingPct >= 100
                ? "ready"
                : "assumption",
        detail: `Reserve ${formatNullableCurrency(market.treasury_reserve_usd)} supports ${formatNullableTokenAmount(
          market.circulating_supply
        )} circulating ALPHA.`
      },
      {
        key: "liquidity_price",
        label: "Liquidity Pool Price",
        value: `pool price ${formatNullableCurrency(poolPrice)} · ${formatNullableTokenAmount(
          market.liquidity_pool_alpha
        )} ALPHA / ${formatNullableCurrency(market.liquidity_pool_usd)}`,
        status:
          market.price_basis === "not_applicable_internal"
            ? "locked"
            : market.price_basis !== "liquidity_pool"
            ? "assumption"
            : liquidityPoolReady
              ? "ready"
              : "blocked",
        detail: "If price comes from a pool, the pool must show enough ALPHA and USDC to calculate the implied price."
      },
      {
        key: "market_pressure",
        label: "Market Pressure",
        value: `buy ${formatNullableCurrency(market.monthly_buy_demand_usd)} · sell ${formatNullableCurrency(
          sellPressureUsd
        )} · net ${formatNullableCurrency(netMonthlyDemandUsd)}`,
        status:
          market.price_basis === "not_applicable_internal"
            ? "locked"
            : netMonthlyDemandUsd === null
              ? "assumption"
              : netMonthlyDemandUsd >= 0
                ? "ready"
                : "blocked",
        detail: `Burn ${formatNullableTokenAmount(market.monthly_burn_alpha)} ALPHA and vesting unlock ${formatNullableTokenAmount(
          market.vesting_unlock_alpha
        )} ALPHA per month are tracked as market assumptions.`
      },
      {
        key: "allocation_model",
        label: "Allocation",
        value: allocationComplete ? `${allocationTotal}% allocated` : "allocation not fully set",
        status: web3.supply_model === "not_applicable_internal" ? "locked" : allocationComplete && Math.abs(allocationTotal - 100) < 0.01 ? "assumption" : "blocked",
        detail: "Community, treasury, team, investor, and liquidity allocations must sum to 100% for a public token plan."
      },
      {
        key: "liquidity_governance_legal",
        label: "Liquidity / Decision Rules / Legal",
        value: `${web3.liquidity.enabled ? "liquidity enabled" : "no liquidity"} · ${web3.governance.mode} · ${web3.legal.classification}`,
        status: web3.network_status === "not_applicable_internal" ? "locked" : "assumption",
        detail: "Web3 claims need clear liquidity, decision rules, and legal settings."
      },
      {
        key: "whitepaper_binding",
        label: "Whitepaper Evidence",
        value: `${truthCoverage.status} data · ${canonicalGapAudit.readiness} source detail · ${caveats.length} caveats`,
        status: caveats.length === 0 ? "ready" : "assumption",
        detail: "Whitepaper should cite the uploaded data, scenario settings, result, warnings, and caveats from this pack."
      }
    ],
    caveats
  };
}

function buildRunRecommendedSetup(
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>,
  summary: SummaryMetrics,
  recommendation: ReturnType<typeof evaluateRecommendation>,
  truthCoverage: DecisionPackHistoricalTruthCoverage
): DecisionPack["recommended_setup"] {
  const pushItem = (
    items: DecisionPack["recommended_setup"]["items"],
    parameterKey: string,
    label: string,
    value: string,
    status: "recommended" | "caution" | "locked"
  ) => {
    const guardrail = scenarioGuardrailByKey.get(parameterKey as never);

    items.push({
      parameter_key: parameterKey,
      label,
      value,
      status,
      rationale:
        guardrail?.business_rationale ??
        "This setup item is included to keep the recommended pilot envelope explicit."
    });
  };

  const items: DecisionPack["recommended_setup"]["items"] = [];

  pushItem(
    items,
    "scenario_mode",
    "Scenario mode",
    buildScenarioModeValue(parameters),
    isAdvancedForecastMode(parameters) ? "caution" : "locked"
  );
  pushItem(items, "k_pc", "k_pc", String(parameters.k_pc), "recommended");
  pushItem(items, "k_sp", "k_sp", String(parameters.k_sp), "recommended");
  pushItem(items, "cap_user_monthly", "User monthly cap", parameters.cap_user_monthly, "recommended");
  pushItem(items, "cap_group_monthly", "Group monthly cap", parameters.cap_group_monthly, "recommended");
  pushItem(items, "sink_target", "Internal use target", String(parameters.sink_target), "caution");
  pushItem(items, "sink_adoption_model", "Internal use model", buildSinkAdoptionValue(parameters), "caution");
  pushItem(items, "cashout_mode", "Cash-out mode", parameters.cashout_mode, "caution");
  pushItem(items, "cashout_min_usd", "Cash-out minimum", currencyFormatter.format(parameters.cashout_min_usd), "caution");
  pushItem(items, "cashout_fee_bps", "Cash-out fee", `${parameters.cashout_fee_bps} bps`, "caution");
  pushItem(items, "cashout_windows_per_year", "Cash-out windows / year", String(parameters.cashout_windows_per_year), "caution");
  pushItem(items, "cashout_window_days", "Cash-out window days", String(parameters.cashout_window_days), "caution");
  pushItem(items, "projection_horizon_months", "Forecast time range", formatPlanningHorizon(parameters.projection_horizon_months), "caution");
  pushItem(items, "milestone_schedule", "Phase schedule", buildMilestoneValue(parameters), "caution");
  pushItem(items, "reward_global_factor", "Global reward factor", String(parameters.reward_global_factor), "locked");
  pushItem(items, "reward_pool_factor", "Pool reward factor", String(parameters.reward_pool_factor), "locked");
  pushItem(
    items,
    "cohort_assumptions",
    "Growth Forecast",
    buildCohortProjectionValue(parameters),
    isAdvancedForecastMode(parameters) ? "caution" : "locked"
  );
  pushItem(
    items,
    "alpha_token_policy",
    "ALPHA token policy",
    `${formatSimpleScenarioValue(parameters.alpha_token_policy.classification)} · ${formatSimpleScenarioValue(parameters.alpha_token_policy.transferability)}`,
    parameters.alpha_token_policy.classification === "internal_credit" ? "locked" : "caution"
  );
  pushItem(
    items,
    "forecast_policy",
    "Forecast policy",
    `${formatSimpleScenarioValue(parameters.forecast_policy.mode)} · ${formatSimpleScenarioValue(parameters.forecast_policy.forecast_basis)}`,
    parameters.forecast_policy.mode === "snapshot_window" ? "locked" : "caution"
  );
  pushItem(
    items,
    "web3_tokenomics",
    "Web3 token plan",
    `${formatSimpleScenarioValue(parameters.web3_tokenomics.network_status)} · ${formatSimpleScenarioValue(parameters.web3_tokenomics.supply_model)}`,
    parameters.web3_tokenomics.network_status === "not_applicable_internal" ? "locked" : "caution"
  );
  pushItem(
    items,
    "web3_tokenomics",
    "Token price basis",
    `${formatTokenPriceBasis(parameters.web3_tokenomics.market.price_basis)} · ${formatNullableCurrency(parameters.web3_tokenomics.market.alpha_usd_price)}`,
    parameters.web3_tokenomics.market.price_basis === "not_applicable_internal" ? "locked" : "caution"
  );

  const warnings: string[] = [];

  if (truthCoverage.status !== "strong") {
    warnings.push("Imported data is not fully strong yet, so recommendation wording should stay careful.");
  }

  if (recommendation.policy_status !== "candidate") {
    warnings.push("This pilot envelope is still under review and should not be treated as the final default.");
  }

  if (summary.payout_inflow_ratio >= 1) {
    warnings.push("Treasury pressure is at or above revenue support and still needs team review.");
  }

  if (isAdvancedForecastMode(parameters)) {
    warnings.push("Add Forecast is on; growth numbers must be labeled as assumptions.");
  }

  return {
    title: "Recommended Setup",
    summary:
      recommendation.policy_status === "candidate"
        ? "This result can be used as an initial pilot setup: it is clear which values are policy choices and which come from uploaded data."
        : "This result shows a draft setup, but the settings still need review before they can become the recommended default.",
    items,
    warnings
  };
}

function buildRunDecisionLog(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>,
  summary: SummaryMetrics,
  recommendation: ReturnType<typeof evaluateRecommendation>,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[],
  truthCoverage: DecisionPackHistoricalTruthCoverage
): DecisionPack["decision_log"] {
  const proxyObjectives = strategicObjectives.filter((objective) => objective.evidence_level !== "direct");
  const riskyMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status !== "candidate");
  const log: DecisionPack["decision_log"] = [
    {
      key: "understanding_doc_truth",
      title: "Imported business data stays unchanged",
      status: "fixed_truth",
      owner: "Understanding Doc",
      rationale: `Result ${run.scenario.name} is calculated on top of ${run.snapshot.name}; scenarios do not rewrite uploaded reward or money data.`
    }
  ];

  log.push({
    key: "pilot_policy_envelope",
    title: "Recommended setup from this result",
    status:
      recommendation.policy_status === "candidate"
        ? "recommended"
        : recommendation.policy_status === "risky"
          ? "pending_founder"
          : "blocked",
    owner: "Business Team",
    rationale:
      recommendation.policy_status === "candidate"
        ? `Treasury pressure is ${summary.payout_inflow_ratio.toFixed(2)}x with net cash change ${currencyFormatter.format(summary.company_net_treasury_delta_total)}.`
        : recommendation.policy_status === "risky"
          ? "This result is still usable for discussion, but team review is required before it can become the pilot default."
          : "This result fails core treasury or money thresholds and should not be promoted as the pilot default."
  });

  if (isAdvancedForecastMode(parameters)) {
    log.push({
      key: "advanced_forecast_caveat",
      title: "Forecast needs a caveat",
      status: "pending_founder",
      owner: "Business Team / Strategy",
      rationale: "This result uses new-member, churn, and reactivation assumptions. Result, Compare, Token Flow, and Whitepaper must describe those numbers as estimates."
    });
  }

  if (truthCoverage.status !== "strong") {
    log.push({
      key: "truth_coverage_gap",
      title: "Imported data still needs more work",
      status: "blocked",
      owner: "Data / Ops",
      rationale: truthCoverage.summary
    });
  }

  if (proxyObjectives.length > 0) {
    log.push({
      key: "strategic_evidence_gap",
      title: "Some strategic claims still rely on proxy or checklist evidence",
      status: "blocked",
      owner: "Data / Legal / Ops",
      rationale: proxyObjectives
        .map((objective) => `${objective.label} is ${objective.evidence_level}`)
        .join("; ")
    });
  }

  if (riskyMilestones.length > 0) {
    log.push({
      key: "milestone_governance_review",
      title: "Phase promotion still needs team review",
      status: "pending_founder",
      owner: "Business Team",
      rationale: riskyMilestones
        .map((milestone) => `${milestone.label}: ${milestone.reasons[0] ?? milestone.policy_status}`)
        .join("; ")
    });
  }

  return log;
}

function buildRunTruthAssumptionMatrix(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  parameters: ReturnType<typeof parseFounderSafeScenarioParameters>,
  truthCoverage: DecisionPackHistoricalTruthCoverage
): DecisionPack["truth_assumption_matrix"] {
  return [
    {
      key: "snapshot_truth",
      label: "Approved snapshot",
      value: run.snapshot.name,
      classification: "historical_truth",
      note: "Imported recognized revenue and reward distribution are the data basis for this run."
    },
    {
      key: "truth_coverage",
      label: "Imported data coverage",
      value: truthCoverage.status,
      classification: "derived_assessment",
      note: truthCoverage.summary
    },
    {
      key: "scenario_mode",
      label: "Scenario mode",
      value: buildScenarioModeValue(parameters),
      classification: isAdvancedForecastMode(parameters) ? "scenario_assumption" : "locked_boundary",
      note: isAdvancedForecastMode(parameters)
        ? "Growth Forecast is on and must be read as estimates."
        : "Growth forecast is off; the run uses imported data only."
    },
    {
      key: "k_pc",
      label: "k_pc",
      value: String(parameters.k_pc),
      classification: "scenario_lever",
      note: "Editable PC-to-ALPHA conversion."
    },
    {
      key: "k_sp",
      label: "k_sp",
      value: String(parameters.k_sp),
      classification: "scenario_lever",
      note: "Editable SP / Sales Point-to-ALPHA conversion."
    },
    {
      key: "caps",
      label: "Monthly caps",
      value: `user ${parameters.cap_user_monthly} · group ${parameters.cap_group_monthly}`,
      classification: "scenario_lever",
      note: "Monthly limits are policy choices and do not change imported data."
    },
    {
      key: "cashout_policy",
      label: "Cash-out policy",
      value: `${parameters.cashout_mode} · ${currencyFormatter.format(parameters.cashout_min_usd)} min · ${parameters.cashout_fee_bps} bps`,
      classification: "scenario_assumption",
      note: "Cash-out policy is a simulation assumption, not observed data."
    },
    {
      key: "sink_target",
      label: "Internal use target",
      value: String(parameters.sink_target),
      classification: "scenario_assumption",
      note: "Internal-use target is a scenario assumption."
    },
    {
      key: "sink_adoption_model",
      label: "Internal use model",
      value: buildSinkAdoptionValue(parameters),
      classification: "scenario_assumption",
      note: "Internal use model adds estimated use without changing uploaded internal-use data."
    },
    {
      key: "projection_horizon",
      label: "Forecast time range",
      value: formatPlanningHorizon(parameters.projection_horizon_months),
      classification: "scenario_assumption",
      note: "Projection beyond the imported data period must be read as an assumption."
    },
    {
      key: "milestone_schedule",
      label: "Phase schedule",
      value: buildMilestoneValue(parameters),
      classification: "scenario_assumption",
      note: "Time-based policy changes are review assumptions."
    },
    {
      key: "reward_factor_lock",
      label: "Global / pool reward factors",
      value: "locked to core formula",
      classification: "locked_boundary",
      note: "Locked so the core reward formula does not change during scenario comparison."
    },
    {
      key: "cohort_projection",
      label: "Growth Forecast",
      value: buildCohortProjectionValue(parameters),
      classification: isAdvancedForecastMode(parameters) ? "scenario_assumption" : "locked_boundary",
      note: isAdvancedForecastMode(parameters)
        ? "New member, churn, and reactivation forecasts are on."
        : "New member, churn, and reactivation forecasts are not used in imported-data mode."
    },
    {
      key: "alpha_token_policy",
      label: "ALPHA token policy",
      value: `${formatSimpleScenarioValue(parameters.alpha_token_policy.classification)} · ${formatSimpleScenarioValue(parameters.alpha_token_policy.transferability)} · ${formatSimpleScenarioValue(parameters.alpha_token_policy.on_chain_status)}`,
      classification:
        parameters.alpha_token_policy.classification === "internal_credit"
          ? "locked_boundary"
          : "scenario_assumption",
      note: "This separates Phase 1 internal ALPHA language from future Web3 token claims."
    },
    {
      key: "forecast_policy",
      label: "Forecast policy",
      value: `${formatSimpleScenarioValue(parameters.forecast_policy.mode)} · ${formatSimpleScenarioValue(parameters.forecast_policy.forecast_basis)}`,
      classification:
        parameters.forecast_policy.mode === "snapshot_window"
          ? "locked_boundary"
          : "scenario_assumption",
      note: "Forecast periods must stay separate from imported data periods."
    },
    {
      key: "token_price_basis",
      label: "Token price basis",
      value: `${formatTokenPriceBasis(parameters.web3_tokenomics.market.price_basis)} · ${formatNullableCurrency(parameters.web3_tokenomics.market.alpha_usd_price)}`,
      classification:
        parameters.web3_tokenomics.market.price_basis === "not_applicable_internal"
          ? "locked_boundary"
          : "scenario_assumption",
      note: "Token price is a scenario assumption unless ALPHA stays internal-only."
    },
    {
      key: "web3_tokenomics",
      label: "Web3 token plan",
      value: `${formatSimpleScenarioValue(parameters.web3_tokenomics.network_status)} · ${formatSimpleScenarioValue(parameters.web3_tokenomics.supply_model)}`,
      classification:
        parameters.web3_tokenomics.network_status === "not_applicable_internal" &&
        parameters.web3_tokenomics.market.price_basis === "not_applicable_internal"
          ? "locked_boundary"
          : "scenario_assumption",
      note: "Supply, price, allocation, vesting, liquidity, decision rules, smart contract, and legal settings are assumptions, not uploaded data."
    }
  ];
}

function buildDecisionPack(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[],
  truthCoverage: DecisionPackHistoricalTruthCoverage,
  canonicalGapAudit: DecisionPack["canonical_gap_audit"]
): DecisionPack {
  const summary = buildSummary(run);
  const flags = buildFlags(run);
  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const recommendation = evaluateRecommendation(
    summary,
    flags,
    baselineModel.recommendationThresholds
  );
  const parameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
    reward_global_factor: baselineModel.defaults.reward_global_factor,
    reward_pool_factor: baselineModel.defaults.reward_pool_factor
  });
  const strongObjectives = strategicObjectives.filter((objective) => objective.status === "candidate");
  const weakObjectives = strategicObjectives.filter((objective) => objective.status === "rejected");
  const proxyObjectives = strategicObjectives.filter((objective) => objective.evidence_level !== "direct");
  const failedMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status === "rejected");
  const riskyMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status === "risky");
  const recommendedSetup = buildRunRecommendedSetup(
    parameters,
    summary,
    recommendation,
    truthCoverage
  );
  const decisionLog = buildRunDecisionLog(
    run,
    parameters,
    summary,
    recommendation,
    strategicObjectives,
    milestoneEvaluations,
    truthCoverage
  );
  const truthAssumptionMatrix = buildRunTruthAssumptionMatrix(run, parameters, truthCoverage);
  const tokenFlowEvidence = buildTokenFlowEvidence(
    parameters,
    summary,
    truthCoverage,
    canonicalGapAudit
  );

  return {
    title: `${run.scenario.name} Decision Pack`,
    policy_status: recommendation.policy_status,
    recommendation:
      recommendation.policy_status === "candidate"
        ? strongObjectives.length > 0
          ? "This scenario stays within the current treasury thresholds when measured against uploaded revenue and reward data. The money view is clear enough for team review."
          : "This scenario stays within the current treasury thresholds when measured against uploaded revenue and reward data, but the strategic upside is still limited."
        : recommendation.policy_status === "risky"
          ? "This scenario is usable for discussion, but treasury pressure, concentration, or money clarity still needs team review before adoption."
          : "This scenario breaks core treasury safety thresholds or produces an unsafe money position and should not be used as the pilot default.",
    preferred_settings: [
      `Evaluated snapshot: ${run.snapshot.name}`,
      `Evaluated template: ${run.scenario.templateType}`,
      `Scenario mode: ${buildScenarioModeValue(parameters)}`,
      "Evaluation basis: uploaded revenue data + uploaded reward data",
      `Gross cash in: ${currencyFormatter.format(summary.company_gross_cash_in_total)}`,
      `Retained revenue: ${currencyFormatter.format(summary.company_retained_revenue_total)}`,
      `Partner payout out: ${currencyFormatter.format(summary.company_partner_payout_out_total)}`,
      `Direct reward obligations: ${currencyFormatter.format(summary.company_direct_reward_obligation_total)}`,
      `Pool funding obligations: ${currencyFormatter.format(summary.company_pool_funding_obligation_total)}`,
      `Actual payout out: ${currencyFormatter.format(summary.company_actual_payout_out_total)}`,
      `Product fulfillment out: ${currencyFormatter.format(summary.company_product_fulfillment_out_total)}`,
      `Net cash change: ${currencyFormatter.format(summary.company_net_treasury_delta_total)}`,
      `Ending ALPHA balance: ${summary.alpha_ending_balance_total.toFixed(2)}`,
      `Actual ALPHA used: ${summary.alpha_actual_spent_total.toFixed(2)}`,
      `Modeled ALPHA used: ${summary.alpha_modeled_spent_total.toFixed(2)}`,
      `Observed months: ${summary.forecast_actual_period_count}`,
      `Forecast months: ${summary.forecast_projected_period_count}`,
      `Treasury pressure: ${summary.payout_inflow_ratio.toFixed(2)}x`,
      `Reserve runway: ${summary.reserve_runway_months.toFixed(2)} months`,
      `k_pc: ${parameters.k_pc}`,
      `k_sp: ${parameters.k_sp}`,
      `Cash-out mode: ${formatSimpleScenarioValue(parameters.cashout_mode)}`,
      `Sink target: ${parameters.sink_target}`,
      `Sink adoption model: ${buildSinkAdoptionValue(parameters)}`,
      `Forecast time range: ${parameters.projection_horizon_months ?? "current data range"}`,
      `New members / month: ${parameters.cohort_assumptions.new_members_per_month}`,
      `Monthly churn: ${parameters.cohort_assumptions.monthly_churn_rate_pct}%`,
      `Monthly reactivation: ${parameters.cohort_assumptions.monthly_reactivation_rate_pct}%`,
      `ALPHA token policy: ${formatSimpleScenarioValue(parameters.alpha_token_policy.classification)} / ${formatSimpleScenarioValue(parameters.alpha_token_policy.transferability)}`,
      `Web3 token plan: ${formatSimpleScenarioValue(parameters.web3_tokenomics.network_status)} / ${formatSimpleScenarioValue(parameters.web3_tokenomics.supply_model)}`,
      `ALPHA price basis: ${formatTokenPriceBasis(parameters.web3_tokenomics.market.price_basis)} / ${formatNullableCurrency(parameters.web3_tokenomics.market.alpha_usd_price)}`,
      ...parameters.milestone_schedule.map(
        (milestone) =>
          `Phase ${milestone.label}: starts month ${milestone.start_month}${
            milestone.end_month ? `, ends month ${milestone.end_month}` : ""
          }`
      ),
      ...milestoneEvaluations.map(
        (milestone) =>
          `Phase check ${milestone.label}: ${milestone.policy_status} (${milestone.start_period_key} to ${milestone.end_period_key})`
      ),
      ...strongObjectives.map(
        (objective) =>
          `${objective.label}: ${objective.status} (${objective.score.toFixed(2)} / ${objective.evidence_level})`
      )
    ],
    rejected_settings: [
      ...flags.map((flag) => flag.message),
      ...failedMilestones.map(
        (milestone) =>
          `${milestone.label}: phase gate failed (${milestone.reasons[0] ?? "Treasury thresholds are violated."})`
      ),
      ...weakObjectives.map(
        (objective) => `${objective.label}: ${objective.reasons[0] ?? "Strategic score is below threshold."}`
      )
    ],
    unresolved_questions: [
      "Confirm whether the selected uploaded data has complete revenue fields for the period under review.",
      "Confirm whether cash-in, partner-payout, and fulfillment-cost fields are complete enough for the current money view.",
      "Confirm whether the pilot should keep the current cash-out policy baseline or use a windowed override.",
      "Confirm whether the internal-use target aligns with the initial utility scope approved for Phase 1.",
      "Confirm whether modeled internal-use assumptions are approved before using them for growth or whitepaper claims.",
      ...(isAdvancedForecastMode(parameters)
        ? ["Confirm Add Forecast is approved before using it in team material or the Whitepaper."]
        : []),
      "Confirm whether ALPHA remains an internal non-transferable credit or becomes a future on-chain/tokenized asset.",
      "Confirm Web3 price basis, supply, allocation, vesting, liquidity, decision rules, smart-contract, and legal assumptions before public whitepaper claims.",
      ...riskyMilestones.map(
        (milestone) =>
          `${milestone.label}: phase gate is risky and still needs team review before promotion.`
      ),
      ...proxyObjectives.map(
        (objective) =>
          `${objective.label}: evidence level is ${objective.evidence_level}, so stronger source data is still needed.`
      )
    ],
    strategic_objectives: strategicObjectives,
    milestone_evaluations: milestoneEvaluations,
    historical_truth_coverage: truthCoverage,
    recommended_setup: recommendedSetup,
    decision_log: decisionLog,
    truth_assumption_matrix: truthAssumptionMatrix,
    canonical_gap_audit: canonicalGapAudit,
    token_flow_evidence: tokenFlowEvidence
  };
}

export async function generateDecisionPackForRun(
  runId: string,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[]
) {
  const run = await getRunById(runId);

  if (!run) {
    throw new Error(`Run ${runId} was not found.`);
  }

  const truthCoverage =
    (await getSnapshotTruthCoverage(run.snapshotId)) ?? {
      status: "weak",
      summary: "Imported data coverage could not be read for this snapshot.",
      rows: []
    };
  const canonicalGapAudit =
    (await getSnapshotCanonicalGapAudit(run.snapshotId)) ?? {
      readiness: "weak",
      summary: "Source detail check could not be read for this snapshot.",
      rows: []
    };
  const pack = buildDecisionPack(
    run,
    strategicObjectives,
    milestoneEvaluations,
    truthCoverage,
    canonicalGapAudit
  );
  const savedPack = await upsertRunDecisionPack({
    runId,
    title: pack.title,
    recommendationJson: pack,
    createdBy: run.createdBy
  });

  await writeAuditEvent({
    actorUserId: run.createdBy,
    entityType: "decision_pack",
    entityId: savedPack.id,
    action: "decision_pack.generated",
    metadata: {
      runId,
      policyStatus: pack.policy_status
    }
  });

  return savedPack;
}

export async function processSimulationRun(runId: string) {
  const run = await getRunById(runId);

  if (!run) {
    throw new Error(`Run ${runId} was not found.`);
  }

  if (run.status === "COMPLETED") {
    if (runNeedsDecisionPackRefresh(run)) {
      const [facts, poolPeriodFacts] = await Promise.all([
        listSnapshotMemberMonthFacts(run.snapshotId),
        listSnapshotPoolPeriodFacts(run.snapshotId)
      ]);
      const baselineModel = resolveBaselineModelRuleset(
        run.modelVersion.rulesetJson,
        run.modelVersion.versionName
      );
      const input: SimulationRunRequest = {
        snapshotId: run.snapshotId,
        baselineModelVersionId: run.modelVersionId,
        scenario: {
          id: run.scenario.id,
          name: run.scenario.name,
          template: run.scenario.templateType as "Baseline" | "Conservative" | "Growth" | "Stress",
          parameters: parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
            reward_global_factor: baselineModel.defaults.reward_global_factor,
            reward_pool_factor: baselineModel.defaults.reward_pool_factor
          })
        }
      };
      const guardrailIssues = evaluateFounderScenarioGuardrails(input.scenario.parameters, {
        reward_global_factor: baselineModel.defaults.reward_global_factor,
        reward_pool_factor: baselineModel.defaults.reward_pool_factor
      });

      if (guardrailIssues.some((issue) => issue.severity === "ERROR")) {
        throw new Error(
          guardrailIssues
            .filter((issue) => issue.severity === "ERROR")
            .map((issue) => issue.message)
            .join(" ")
        );
      }

      const result = simulateScenario({
        request: input,
        facts: facts.map(buildSimulationFact),
        poolPeriodFacts: poolPeriodFacts.map((fact) => ({
          periodKey: fact.periodKey,
          poolCode: fact.poolCode,
          distributionCycle: fact.distributionCycle,
          unit: fact.unit,
          fundingAmount: fact.fundingAmount,
          distributionAmount: fact.distributionAmount,
          recipientCount: fact.recipientCount,
          shareCountTotal: fact.shareCountTotal
        })),
        baselineModel
      });

      await persistCompletedRun(runId, {
        summaryMetrics: {
          ...result.summary_metrics,
          ...result.strategic_metrics
        },
        timeSeriesMetrics: result.time_series_metrics,
        segmentMetrics: result.segment_metrics,
        flags: result.flags,
        recommendationSignals: result.recommendation_signals,
        runNotes: `policy_status=${result.recommendation_signals.policy_status}`,
        completedAt: run.completedAt
      });

      await generateDecisionPackForRun(
        runId,
        result.strategic_objectives as StrategicObjectiveScorecard[],
        result.milestone_evaluations as MilestoneEvaluation[]
      );

      return getRunById(runId);
    }

    return run;
  }

  if (run.status === "RUNNING") {
    return run;
  }

  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const input: SimulationRunRequest = {
    snapshotId: run.snapshotId,
    baselineModelVersionId: run.modelVersionId,
    scenario: {
      id: run.scenario.id,
      name: run.scenario.name,
      template: run.scenario.templateType as "Baseline" | "Conservative" | "Growth" | "Stress",
      parameters: parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
        reward_global_factor: baselineModel.defaults.reward_global_factor,
        reward_pool_factor: baselineModel.defaults.reward_pool_factor
      })
    }
  };

  try {
    await markRunStarted(runId);

    const [facts, poolPeriodFacts] = await Promise.all([
      listSnapshotMemberMonthFacts(run.snapshotId),
      listSnapshotPoolPeriodFacts(run.snapshotId)
    ]);

    const result = simulateScenario({
      request: input,
      facts: facts.map(buildSimulationFact),
      poolPeriodFacts: poolPeriodFacts.map((fact) => ({
        periodKey: fact.periodKey,
        poolCode: fact.poolCode,
        distributionCycle: fact.distributionCycle,
        unit: fact.unit,
        fundingAmount: fact.fundingAmount,
        distributionAmount: fact.distributionAmount,
        recipientCount: fact.recipientCount,
        shareCountTotal: fact.shareCountTotal
      })),
      baselineModel
    });

    const persistedRun = await persistCompletedRun(runId, {
      summaryMetrics: {
        ...result.summary_metrics,
        ...result.strategic_metrics
      },
      timeSeriesMetrics: result.time_series_metrics,
      segmentMetrics: result.segment_metrics,
      flags: result.flags,
      recommendationSignals: result.recommendation_signals,
      runNotes: `policy_status=${result.recommendation_signals.policy_status}`
    });

    await generateDecisionPackForRun(
      runId,
      result.strategic_objectives as StrategicObjectiveScorecard[],
      result.milestone_evaluations as MilestoneEvaluation[]
    );

    await writeAuditEvent({
      actorUserId: persistedRun.createdBy,
      entityType: "simulation_run",
      entityId: runId,
      action: "run.completed",
      metadata: {
        policyStatus: result.recommendation_signals.policy_status,
        flagCount: result.flags.length
      }
    });

    return getRunById(runId);
  } catch (error) {
    await markRunFailed(runId, error instanceof Error ? error.message : "worker_run_failed");
    await writeAuditEvent({
      actorUserId: run.createdBy,
      entityType: "simulation_run",
      entityId: runId,
      action: "run.failed",
      metadata: {
        message: error instanceof Error ? error.message : "worker_run_failed"
      }
    });
    throw error;
  }
}
