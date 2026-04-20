import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import {
  evaluateFounderScenarioGuardrails,
  parseFounderSafeScenarioParameters,
  type DecisionPack,
  type MilestoneEvaluation,
  type RunFlag,
  type SimulationRunRequest,
  type StrategicObjectiveScorecard,
  type SummaryMetrics
} from "@bgc-alpha/schemas";
import { evaluateRecommendation, simulateScenario } from "@bgc-alpha/simulation-core";

import { upsertRunDecisionPack } from "./decision-packs";
import { listSnapshotMemberMonthFacts, listSnapshotPoolPeriodFacts } from "./snapshots";
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
    alpha_spent_total: metricValue("alpha_spent_total"),
    alpha_held_total: metricValue("alpha_held_total"),
    alpha_cashout_equivalent_total: metricValue("alpha_cashout_equivalent_total"),
    company_gross_cash_in_total: metricValue("company_gross_cash_in_total"),
    company_retained_revenue_total: metricValue("company_retained_revenue_total"),
    company_partner_payout_out_total: metricValue("company_partner_payout_out_total"),
    company_direct_reward_obligation_total: metricValue("company_direct_reward_obligation_total"),
    company_pool_funding_obligation_total: metricValue("company_pool_funding_obligation_total"),
    company_actual_payout_out_total: metricValue("company_actual_payout_out_total"),
    company_product_fulfillment_out_total: metricValue("company_product_fulfillment_out_total"),
    company_net_treasury_delta_total: metricValue("company_net_treasury_delta_total"),
    sink_utilization_rate: metricValue("sink_utilization_rate"),
    payout_inflow_ratio: metricValue("payout_inflow_ratio"),
    reserve_runway_months: metricValue("reserve_runway_months"),
    reward_concentration_top10_pct: metricValue("reward_concentration_top10_pct")
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

function buildDecisionPack(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[]
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

  return {
    title: `${run.scenario.name} Decision Pack`,
    policy_status: recommendation.policy_status,
    recommendation:
      recommendation.policy_status === "candidate"
        ? strongObjectives.length > 0
          ? "This scenario stays within the current treasury thresholds when measured against imported recognized revenue support and snapshot reward distributions, and the cashflow lens remains readable enough for founder review."
          : "This scenario stays within the current treasury thresholds when measured against imported recognized revenue support and snapshot reward distributions, but the strategic upside remains limited."
        : recommendation.policy_status === "risky"
          ? "This scenario is usable for discussion, but treasury pressure, concentration, or cashflow clarity still need founder review before adoption."
          : "This scenario breaches core treasury safety thresholds against recognized revenue support or produces an unacceptable cashflow posture and should not be used as the pilot default.",
    preferred_settings: [
      `Evaluated snapshot: ${run.snapshot.name}`,
      `Evaluated template: ${run.scenario.templateType}`,
      "Evaluation basis: imported recognized revenue support + snapshot reward distributions",
      `Gross cash in: ${currencyFormatter.format(summary.company_gross_cash_in_total)}`,
      `Retained revenue: ${currencyFormatter.format(summary.company_retained_revenue_total)}`,
      `Partner payout out: ${currencyFormatter.format(summary.company_partner_payout_out_total)}`,
      `Direct reward obligations: ${currencyFormatter.format(summary.company_direct_reward_obligation_total)}`,
      `Pool funding obligations: ${currencyFormatter.format(summary.company_pool_funding_obligation_total)}`,
      `Actual payout out: ${currencyFormatter.format(summary.company_actual_payout_out_total)}`,
      `Product fulfillment out: ${currencyFormatter.format(summary.company_product_fulfillment_out_total)}`,
      `Net treasury delta: ${currencyFormatter.format(summary.company_net_treasury_delta_total)}`,
      `Treasury pressure: ${summary.payout_inflow_ratio.toFixed(2)}x`,
      `Reserve runway: ${summary.reserve_runway_months.toFixed(2)} months`,
      `k_pc: ${parameters.k_pc}`,
      `k_sp: ${parameters.k_sp}`,
      `Cash-out mode: ${parameters.cashout_mode}`,
      `Sink target: ${parameters.sink_target}`,
      `Projection horizon: ${parameters.projection_horizon_months ?? "snapshot window"}`,
      `New members / month: ${parameters.cohort_assumptions.new_members_per_month}`,
      `Monthly churn: ${parameters.cohort_assumptions.monthly_churn_rate_pct}%`,
      `Monthly reactivation: ${parameters.cohort_assumptions.monthly_reactivation_rate_pct}%`,
      ...parameters.milestone_schedule.map(
        (milestone) =>
          `Milestone ${milestone.label}: starts month ${milestone.start_month}${
            milestone.end_month ? `, ends month ${milestone.end_month}` : ""
          }`
      ),
      ...milestoneEvaluations.map(
        (milestone) =>
          `Gate ${milestone.label}: ${milestone.policy_status} (${milestone.start_period_key} to ${milestone.end_period_key})`
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
          `${milestone.label}: milestone gate failed (${milestone.reasons[0] ?? "Treasury thresholds are violated."})`
      ),
      ...weakObjectives.map(
        (objective) => `${objective.label}: ${objective.reasons[0] ?? "Strategic score is below threshold."}`
      )
    ],
    unresolved_questions: [
      "Confirm whether the selected snapshot has complete recognized revenue fields for the period under review.",
      "Confirm whether gross-cash, partner-payout, and product-fulfillment fields are complete enough for the current cashflow lens.",
      "Confirm whether the pilot should keep the current cash-out policy baseline or use a windowed override.",
      "Confirm whether the sink target aligns with the initial utility scope approved for Phase 1.",
      ...riskyMilestones.map(
        (milestone) =>
          `${milestone.label}: milestone gate is risky and still needs founder review before promotion.`
      ),
      ...proxyObjectives.map(
        (objective) =>
          `${objective.label}: evidence level is ${objective.evidence_level}, so stronger source data is still needed.`
      )
    ],
    strategic_objectives: strategicObjectives,
    milestone_evaluations: milestoneEvaluations
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

  const pack = buildDecisionPack(run, strategicObjectives, milestoneEvaluations);
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
    if (!run.decisionPacks[0]) {
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
