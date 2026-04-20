import type {
  StrategicMetricUnit,
  StrategicObjectiveEvidenceLevel,
  StrategicObjectiveKey,
  StrategicObjectiveScorecard,
  SummaryMetrics
} from "@bgc-alpha/schemas";

type StrategicAssumptions = {
  score_thresholds: {
    candidate: number;
    risky: number;
  };
  revenue: {
    proxy_revenue_capture_rate: number;
    target_revenue_per_active_member: number;
    target_cross_app_share_pct: number;
  };
  ops_cost: {
    automation_coverage_score: number;
    target_cost_to_serve_index: number;
    cashout_ops_penalty_weight: number;
  };
  tax: {
    legal_readiness_score: number;
    compliance_structure_score: number;
    target_tax_event_reduction_pct: number;
  };
  affiliate: {
    target_activation_rate_pct: number;
    target_retention_rate_pct: number;
    target_productivity_share_pct: number;
  };
  active_user: {
    target_retention_rate_pct: number;
    target_cross_app_share_pct: number;
  };
};

export type StrategicBaselineModel = {
  strategicKpiAssumptions: StrategicAssumptions;
};

export type StrategicWorkingRow = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier?: string | null;
  issued: number;
  spent: number;
  cashout: number;
  activeMember: boolean;
  recognizedRevenueUsd?: number | null;
  grossMarginUsd?: number | null;
  retainedRevenueUsd?: number | null;
  globalRewardUsd?: number | null;
  poolRewardUsd?: number | null;
  partnerPayoutOutUsd?: number | null;
  productFulfillmentOutUsd?: number | null;
  memberJoinPeriod?: string | null;
  isAffiliate?: boolean | null;
  crossAppActive?: boolean | null;
  lifecycleStage: "existing" | "new" | "retained" | "reactivated" | "inactive";
};

type StrategicMetric = {
  metric_key: string;
  label: string;
  value: number;
  unit: StrategicMetricUnit;
};

type StrategicEvaluation = {
  strategic_metrics: Record<string, number>;
  strategic_objectives: StrategicObjectiveScorecard[];
};

type CashflowGateStatus = "healthy" | "review" | "reject";

type CashflowContext = {
  grossCashIn: number;
  retainedRevenue: number;
  partnerPayoutOut: number;
  directRewardObligation: number;
  poolFundingObligation: number;
  actualPayoutOut: number;
  productFulfillmentOut: number;
  netTreasuryDelta: number;
  rewardObligations: number;
  actualOutflows: number;
  totalFinancialPressure: number;
  actualOutflowBurdenPct: number;
  obligationBurdenPct: number;
  financialPressureRatio: number;
  obligationCoveragePct: number;
  netTreasuryMarginPct: number;
  payoutInflowRatio: number;
  reserveRunwayMonths: number;
  hasCashflowData: boolean;
  gateStatus: CashflowGateStatus;
  gateReason: string | null;
};

const NET_TREASURY_MARGIN_TARGET_PCT = 15;
const NET_DELTA_PER_ACTIVE_USER_TARGET_USD = 10;

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function statusFromScore(
  score: number,
  thresholds: StrategicAssumptions["score_thresholds"]
): StrategicObjectiveScorecard["status"] {
  if (score >= thresholds.candidate) {
    return "candidate";
  }

  if (score >= thresholds.risky) {
    return "risky";
  }

  return "rejected";
}

function scoreAgainstTarget(value: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return clamp(safeDivide(value, target) * 100, 0, 100);
}

function buildMetric(
  metricKey: string,
  label: string,
  value: number,
  unit: StrategicMetricUnit
): StrategicMetric {
  return {
    metric_key: metricKey,
    label,
    value: roundMetric(value),
    unit
  };
}

function getRowRetainedRevenue(row: StrategicWorkingRow) {
  return Math.max(row.retainedRevenueUsd ?? row.recognizedRevenueUsd ?? 0, 0);
}

function getRowRewardObligation(row: StrategicWorkingRow) {
  return Math.max(row.globalRewardUsd ?? 0, 0) + Math.max(row.poolRewardUsd ?? 0, 0);
}

function getRowFinancialBurden(row: StrategicWorkingRow) {
  return (
    getRowRewardObligation(row) +
    Math.max(row.cashout, 0) +
    Math.max(row.partnerPayoutOutUsd ?? 0, 0) +
    Math.max(row.productFulfillmentOutUsd ?? 0, 0)
  );
}

function buildCashflowContext(summary: SummaryMetrics): CashflowContext {
  const grossCashIn = Math.max(summary.company_gross_cash_in_total, 0);
  const retainedRevenue = Math.max(summary.company_retained_revenue_total, 0);
  const partnerPayoutOut = Math.max(summary.company_partner_payout_out_total, 0);
  const directRewardObligation = Math.max(summary.company_direct_reward_obligation_total, 0);
  const poolFundingObligation = Math.max(summary.company_pool_funding_obligation_total, 0);
  const actualPayoutOut = Math.max(summary.company_actual_payout_out_total, 0);
  const productFulfillmentOut = Math.max(summary.company_product_fulfillment_out_total, 0);
  const netTreasuryDelta = summary.company_net_treasury_delta_total;
  const rewardObligations = directRewardObligation + poolFundingObligation;
  const actualOutflows = partnerPayoutOut + actualPayoutOut + productFulfillmentOut;
  const totalFinancialPressure = rewardObligations + actualOutflows;
  const actualOutflowBurdenPct = safeDivide(actualOutflows, retainedRevenue) * 100;
  const obligationBurdenPct = safeDivide(rewardObligations, retainedRevenue) * 100;
  const financialPressureRatio = safeDivide(totalFinancialPressure, retainedRevenue);
  const obligationCoveragePct = safeDivide(retainedRevenue, Math.max(rewardObligations, 1)) * 100;
  const netTreasuryMarginPct = safeDivide(netTreasuryDelta, retainedRevenue) * 100;
  const payoutInflowRatio = summary.payout_inflow_ratio;
  const reserveRunwayMonths = summary.reserve_runway_months;
  const hasCashflowData =
    grossCashIn > 0 ||
    retainedRevenue > 0 ||
    partnerPayoutOut > 0 ||
    rewardObligations > 0 ||
    actualPayoutOut > 0 ||
    productFulfillmentOut > 0;
  let gateStatus: CashflowGateStatus = "healthy";
  let gateReason: string | null = null;

  if (!hasCashflowData) {
    gateStatus = "review";
    gateReason = "cashflow fields are incomplete, so strategic claims cannot be marked Ready.";
  } else if (retainedRevenue <= 0 && totalFinancialPressure > 0) {
    gateStatus = "reject";
    gateReason = "retained revenue is unavailable while obligations or outflows exist.";
  } else if (payoutInflowRatio >= 1.15) {
    gateStatus = "reject";
    gateReason = "treasury pressure is above the critical threshold.";
  } else if (reserveRunwayMonths < 3) {
    gateStatus = "reject";
    gateReason = "reserve runway is below 3 months.";
  } else if (financialPressureRatio > 1.25) {
    gateStatus = "reject";
    gateReason = "obligations and outflows materially exceed retained revenue capacity.";
  } else if (retainedRevenue <= 0) {
    gateStatus = "review";
    gateReason = "gross cash exists but retained revenue is not available for strategic claims.";
  } else if (netTreasuryDelta < 0) {
    gateStatus = "review";
    gateReason = "net treasury delta is negative.";
  } else if (payoutInflowRatio >= 1) {
    gateStatus = "review";
    gateReason = "modeled obligations are at or above retained revenue support.";
  } else if (reserveRunwayMonths < 6) {
    gateStatus = "review";
    gateReason = "reserve runway is below 6 months.";
  } else if (financialPressureRatio > 1) {
    gateStatus = "review";
    gateReason = "combined obligations and cash outflows exceed retained revenue.";
  }

  return {
    grossCashIn,
    retainedRevenue,
    partnerPayoutOut,
    directRewardObligation,
    poolFundingObligation,
    actualPayoutOut,
    productFulfillmentOut,
    netTreasuryDelta,
    rewardObligations,
    actualOutflows,
    totalFinancialPressure,
    actualOutflowBurdenPct,
    obligationBurdenPct,
    financialPressureRatio,
    obligationCoveragePct,
    netTreasuryMarginPct,
    payoutInflowRatio,
    reserveRunwayMonths,
    hasCashflowData,
    gateStatus,
    gateReason
  };
}

function applyCashflowGate(
  score: number,
  reasons: string[],
  cashflow: CashflowContext,
  thresholds: StrategicAssumptions["score_thresholds"]
) {
  if (cashflow.gateStatus === "healthy") {
    return {
      score,
      reasons
    };
  }

  const scoreCap =
    cashflow.gateStatus === "reject"
      ? Math.max(thresholds.risky - 0.01, 0)
      : Math.max(thresholds.candidate - 0.01, 0);
  const gatedScore = Math.min(score, scoreCap);
  const gateReason = `Cashflow gate: ${cashflow.gateReason}`;

  return {
    score: gatedScore,
    reasons: [gateReason, ...reasons]
  };
}

function buildScorecard(
  objectiveKey: StrategicObjectiveKey,
  label: string,
  score: number,
  evidenceLevel: StrategicObjectiveEvidenceLevel,
  primaryMetrics: StrategicMetric[],
  reasons: string[],
  thresholds: StrategicAssumptions["score_thresholds"],
  cashflow: CashflowContext
): StrategicObjectiveScorecard {
  const gated = applyCashflowGate(score, reasons, cashflow, thresholds);
  const finalScore = roundMetric(clamp(gated.score, 0, 100));

  return {
    objective_key: objectiveKey,
    label,
    score: finalScore,
    status: statusFromScore(finalScore, thresholds),
    evidence_level: evidenceLevel,
    primary_metrics: primaryMetrics,
    reasons: gated.reasons
  };
}

function extractMemberPeriodHistory(rows: StrategicWorkingRow[]) {
  const periods = [...new Set(rows.map((row) => row.periodKey))].sort();
  const earliestPeriod = periods[0] ?? null;
  const activePeriodsByMember = new Map<string, Set<string>>();
  const sourceSystemsByMember = new Map<string, Set<string>>();
  const firstSeenPeriodByMember = new Map<string, string>();
  const explicitCrossAppMembers = new Set<string>();

  for (const row of rows) {
    if (row.activeMember) {
      const activePeriods = activePeriodsByMember.get(row.memberKey) ?? new Set<string>();
      activePeriods.add(row.periodKey);
      activePeriodsByMember.set(row.memberKey, activePeriods);
    }

    const sourceSystems = sourceSystemsByMember.get(row.memberKey) ?? new Set<string>();
    sourceSystems.add(row.sourceSystem);
    sourceSystemsByMember.set(row.memberKey, sourceSystems);

    const firstSeen = firstSeenPeriodByMember.get(row.memberKey);

    if (!firstSeen || row.periodKey < firstSeen) {
      firstSeenPeriodByMember.set(row.memberKey, row.periodKey);
    }

    if (row.crossAppActive) {
      explicitCrossAppMembers.add(row.memberKey);
    }
  }

  const crossAppMembers = new Set(
    [...sourceSystemsByMember.entries()]
      .filter(([, sourceSystems]) => sourceSystems.size > 1)
      .map(([memberKey]) => memberKey)
  );

  for (const memberKey of explicitCrossAppMembers) {
    crossAppMembers.add(memberKey);
  }

  return {
    periods,
    earliestPeriod,
    activePeriodsByMember,
    firstSeenPeriodByMember,
    crossAppMembers
  };
}

function evaluateRevenue(
  rows: StrategicWorkingRow[],
  summary: SummaryMetrics,
  assumptions: StrategicAssumptions,
  history: ReturnType<typeof extractMemberPeriodHistory>,
  cashflow: CashflowContext
) {
  const activeMemberCount = new Set(
    rows.filter((row) => row.activeMember).map((row) => row.memberKey)
  ).size;
  const directRevenueTotal = rows.reduce(
    (total, row) => total + (row.recognizedRevenueUsd ?? 0),
    0
  );
  const directMarginTotal = rows.reduce((total, row) => total + (row.grossMarginUsd ?? 0), 0);
  const directDataAvailable = directRevenueTotal > 0 || directMarginTotal > 0;
  const proxyRevenueTotal = rows.reduce(
    (total, row) => total + row.spent * assumptions.revenue.proxy_revenue_capture_rate,
    0
  );
  const revenueTotal = cashflow.retainedRevenue > 0
    ? cashflow.retainedRevenue
    : directDataAvailable
      ? directRevenueTotal
      : proxyRevenueTotal;
  const grossMarginTotal = directMarginTotal > 0 ? directMarginTotal : revenueTotal * 0.35;
  const retainedRevenuePerActiveMember = safeDivide(revenueTotal, activeMemberCount);
  const crossAppRevenueTotal = rows.reduce((total, row) => {
    const revenueBasis = getRowRetainedRevenue(row) > 0
      ? getRowRetainedRevenue(row)
      : row.spent * assumptions.revenue.proxy_revenue_capture_rate;

    return history.crossAppMembers.has(row.memberKey) ? total + revenueBasis : total;
  }, 0);
  const crossAppRevenueShare = safeDivide(crossAppRevenueTotal, revenueTotal) * 100;
  const sinkToRevenueRatio = safeDivide(summary.alpha_spent_total, Math.max(revenueTotal, 1));
  const netTreasuryMarginScore = scoreAgainstTarget(
    Math.max(cashflow.netTreasuryMarginPct, 0),
    NET_TREASURY_MARGIN_TARGET_PCT
  );
  const obligationCoverageScore = scoreAgainstTarget(cashflow.obligationCoveragePct, 100);
  const score =
    scoreAgainstTarget(
      retainedRevenuePerActiveMember,
      assumptions.revenue.target_revenue_per_active_member
    ) * 0.35 +
    scoreAgainstTarget(crossAppRevenueShare, assumptions.revenue.target_cross_app_share_pct) * 0.2 +
    netTreasuryMarginScore * 0.25 +
    obligationCoverageScore * 0.2;
  const evidenceLevel: StrategicObjectiveEvidenceLevel =
    directDataAvailable && cashflow.hasCashflowData && cashflow.retainedRevenue > 0
      ? "direct"
      : "proxy";
  const reasons = [
    evidenceLevel === "direct"
      ? "Uses retained revenue, recognized revenue, and net treasury delta from the cashflow lens."
      : "Uses proxy revenue logic because cashflow revenue evidence is incomplete.",
    retainedRevenuePerActiveMember >= assumptions.revenue.target_revenue_per_active_member
      ? "Retained revenue per active member is at or above the current target."
      : "Retained revenue per active member is still below the current target.",
    cashflow.netTreasuryDelta >= 0
      ? "Net treasury delta supports the revenue growth claim."
      : "Net treasury delta does not yet support a defensible revenue growth claim.",
    crossAppRevenueShare >= assumptions.revenue.target_cross_app_share_pct
      ? "Cross-app revenue participation is broad enough to support ecosystem growth."
      : "Cross-app revenue share is still too narrow to prove ecosystem-level lift."
  ];
  const primaryMetrics = [
    buildMetric("strategic.revenue.retained_revenue_total", "Retained revenue", revenueTotal, "usd"),
    buildMetric(
      "strategic.revenue.retained_revenue_per_active_member",
      "Retained revenue per active member",
      retainedRevenuePerActiveMember,
      "usd"
    ),
    buildMetric(
      "strategic.revenue.net_treasury_delta",
      "Net treasury delta",
      cashflow.netTreasuryDelta,
      "usd"
    ),
    buildMetric(
      "strategic.revenue.cross_app_revenue_share",
      "Cross-app revenue share",
      crossAppRevenueShare,
      "percent"
    )
  ];

  return {
    metrics: {
      "strategic.revenue.revenue_recognized_total": roundMetric(revenueTotal),
      "strategic.revenue.gross_margin_total": roundMetric(grossMarginTotal),
      "strategic.revenue.retained_revenue_per_active_member": roundMetric(retainedRevenuePerActiveMember),
      "strategic.revenue.cross_app_revenue_share": roundMetric(crossAppRevenueShare),
      "strategic.revenue.sink_to_revenue_ratio": roundMetric(sinkToRevenueRatio),
      "strategic.revenue.net_treasury_margin_pct": roundMetric(cashflow.netTreasuryMarginPct),
      "strategic.revenue.obligation_coverage_pct": roundMetric(cashflow.obligationCoveragePct),
      "strategic.revenue.revenue_growth_index": roundMetric(score),
      "strategic.revenue.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "revenue",
      "Revenue Growth",
      score,
      evidenceLevel,
      primaryMetrics,
      reasons,
      assumptions.score_thresholds,
      cashflow
    )
  };
}

function evaluateOpsCost(
  rows: StrategicWorkingRow[],
  summary: SummaryMetrics,
  assumptions: StrategicAssumptions,
  cashflow: CashflowContext
) {
  const activeMemberCount = new Set(
    rows.filter((row) => row.activeMember).map((row) => row.memberKey)
  ).size;
  const manualOpsProxyTotal = rows.filter((row) => row.cashout > 0).length;
  const cashoutOpsLoadIndex = safeDivide(manualOpsProxyTotal, Math.max(activeMemberCount, 1)) * 100;
  const costPerActiveMemberProxy = safeDivide(manualOpsProxyTotal, Math.max(activeMemberCount, 1));
  const outflowEfficiencyScore = clamp(100 - cashflow.actualOutflowBurdenPct, 0, 100);
  const obligationEfficiencyScore = clamp(100 - cashflow.obligationBurdenPct, 0, 100);
  const cashoutOpsLoadScore = clamp(
    100 - cashoutOpsLoadIndex * assumptions.ops_cost.cashout_ops_penalty_weight,
    0,
    100
  );
  const costToServeIndex = clamp(
    assumptions.ops_cost.automation_coverage_score * 0.15 +
      clamp(summary.sink_utilization_rate, 0, 100) * 0.15 +
      outflowEfficiencyScore * 0.35 +
      obligationEfficiencyScore * 0.25 +
      cashoutOpsLoadScore * 0.1,
    0,
    100
  );
  const reasons = [
    "Uses cashflow outflow burden plus proxy cash-out ops load and automation coverage.",
    costToServeIndex >= assumptions.ops_cost.target_cost_to_serve_index
      ? "The modeled operating pattern is efficient enough for the current target."
      : "Cash-out handling and manual servicing pressure still look too heavy.",
    cashflow.actualOutflows <= cashflow.retainedRevenue
      ? "Actual cash outflows remain within retained revenue support."
      : "Actual cash outflows exceed retained revenue support.",
    cashflow.rewardObligations <= cashflow.retainedRevenue
      ? "Reward and pool obligations remain covered by retained revenue."
      : "Reward and pool obligations exceed retained revenue support."
  ];
  const score = costToServeIndex;
  const primaryMetrics = [
    buildMetric(
      "strategic.ops_cost.actual_outflow_burden_pct",
      "Actual outflow burden",
      cashflow.actualOutflowBurdenPct,
      "percent"
    ),
    buildMetric(
      "strategic.ops_cost.actual_payout_out",
      "Actual payout out",
      cashflow.actualPayoutOut,
      "usd"
    ),
    buildMetric(
      "strategic.ops_cost.product_fulfillment_out",
      "Product fulfillment out",
      cashflow.productFulfillmentOut,
      "usd"
    ),
    buildMetric(
      "strategic.ops_cost.net_treasury_delta",
      "Net treasury delta",
      cashflow.netTreasuryDelta,
      "usd"
    )
  ];

  return {
    metrics: {
      "strategic.ops_cost.cost_to_serve_index": roundMetric(costToServeIndex),
      "strategic.ops_cost.actual_outflow_burden_pct": roundMetric(cashflow.actualOutflowBurdenPct),
      "strategic.ops_cost.obligation_burden_pct": roundMetric(cashflow.obligationBurdenPct),
      "strategic.ops_cost.cashout_ops_load_index": roundMetric(cashoutOpsLoadIndex),
      "strategic.ops_cost.manual_ops_proxy_total": roundMetric(manualOpsProxyTotal),
      "strategic.ops_cost.cost_per_active_member_proxy": roundMetric(costPerActiveMemberProxy),
      "strategic.ops_cost.automation_coverage_score": roundMetric(
        assumptions.ops_cost.automation_coverage_score
      ),
      "strategic.ops_cost.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "ops_cost",
      "Operational Cost Reduction",
      score,
      "proxy",
      primaryMetrics,
      reasons,
      assumptions.score_thresholds,
      cashflow
    )
  };
}

function evaluateTax(
  assumptions: StrategicAssumptions,
  cashflow: CashflowContext
) {
  const taxEventReductionProxyPct = clamp(
    100 - safeDivide(cashflow.actualPayoutOut, Math.max(cashflow.grossCashIn, 1)) * 100,
    0,
    100
  );
  const payoutToRetainedRevenuePct = safeDivide(cashflow.actualPayoutOut, cashflow.retainedRevenue) * 100;
  const netTreasuryMarginScore = scoreAgainstTarget(
    Math.max(cashflow.netTreasuryMarginPct, 0),
    NET_TREASURY_MARGIN_TARGET_PCT
  );
  const jurisdictionFitScore =
    (assumptions.tax.legal_readiness_score + assumptions.tax.compliance_structure_score) / 2;
  const score =
    scoreAgainstTarget(
      taxEventReductionProxyPct,
      assumptions.tax.target_tax_event_reduction_pct
    ) * 0.3 +
    clamp(assumptions.tax.legal_readiness_score, 0, 100) * 0.3 +
    clamp(assumptions.tax.compliance_structure_score, 0, 100) * 0.3 +
    netTreasuryMarginScore * 0.1;
  const reasons = [
    "This is a checklist-based scorecard using actual payout out from the cashflow lens, not a direct tax simulation.",
    taxEventReductionProxyPct >= assumptions.tax.target_tax_event_reduction_pct
      ? "Actual payout out is low enough relative to gross cash in to support a cleaner transaction structure."
      : "Actual payout out is still too high relative to gross cash in to claim meaningful tax-event reduction.",
    assumptions.tax.legal_readiness_score >= 50
      ? "Legal readiness assumptions are progressing toward an implementation path."
      : "Legal readiness remains an explicit blocker for stronger tax claims.",
    cashflow.netTreasuryDelta >= 0
      ? "Net treasury delta does not add an additional tax-structure warning."
      : "Negative net treasury delta weakens tax-structure readiness."
  ];
  const primaryMetrics = [
    buildMetric(
      "strategic.tax.actual_payout_out",
      "Actual payout out",
      cashflow.actualPayoutOut,
      "usd"
    ),
    buildMetric(
      "strategic.tax.gross_cash_in",
      "Gross cash in",
      cashflow.grossCashIn,
      "usd"
    ),
    buildMetric(
      "strategic.tax.tax_event_reduction_proxy_pct",
      "Tax-event reduction proxy",
      taxEventReductionProxyPct,
      "percent"
    ),
    buildMetric(
      "strategic.tax.legal_readiness_score",
      "Legal readiness",
      assumptions.tax.legal_readiness_score,
      "score"
    ),
    buildMetric(
      "strategic.tax.compliance_structure_score",
      "Compliance structure",
      assumptions.tax.compliance_structure_score,
      "score"
    )
  ];

  return {
    metrics: {
      "strategic.tax.tax_event_reduction_proxy_pct": roundMetric(taxEventReductionProxyPct),
      "strategic.tax.actual_payout_to_retained_revenue_pct": roundMetric(payoutToRetainedRevenuePct),
      "strategic.tax.legal_readiness_score": roundMetric(assumptions.tax.legal_readiness_score),
      "strategic.tax.compliance_structure_score": roundMetric(
        assumptions.tax.compliance_structure_score
      ),
      "strategic.tax.jurisdiction_fit_score": roundMetric(jurisdictionFitScore),
      "strategic.tax.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "tax",
      "Tax Optimization",
      score,
      "checklist",
      primaryMetrics,
      reasons,
      assumptions.score_thresholds,
      cashflow
    )
  };
}

function evaluateAffiliate(
  rows: StrategicWorkingRow[],
  summary: SummaryMetrics,
  assumptions: StrategicAssumptions,
  history: ReturnType<typeof extractMemberPeriodHistory>,
  cashflow: CashflowContext
) {
  const explicitAffiliateRows = rows.filter((row) => row.isAffiliate === true);
  const directAffiliateEvidence = explicitAffiliateRows.length > 0;
  const affiliateMembers = new Set(
    (directAffiliateEvidence
      ? explicitAffiliateRows
      : rows.filter((row) => ["builder", "leader"].includes(row.memberTier?.toLowerCase() ?? "")))
      .map((row) => row.memberKey)
  );
  const activeAffiliateMembers = new Set(
    rows.filter((row) => row.activeMember && affiliateMembers.has(row.memberKey)).map((row) => row.memberKey)
  );
  const affiliateRetentionMembers = new Set(
    [...history.activePeriodsByMember.entries()]
      .filter(([memberKey, activePeriods]) => affiliateMembers.has(memberKey) && activePeriods.size >= 2)
      .map(([memberKey]) => memberKey)
  );
  const newAffiliateMembers = new Set(
    rows
      .filter((row) => {
        if (!affiliateMembers.has(row.memberKey) || !row.activeMember) {
          return false;
        }

        if (row.memberJoinPeriod) {
          return row.memberJoinPeriod === row.periodKey;
        }

        return history.earliestPeriod !== null && history.firstSeenPeriodByMember.get(row.memberKey) !== history.earliestPeriod;
      })
      .map((row) => row.memberKey)
  );
  const affiliateIssuedTotal = rows.reduce(
    (total, row) => total + (affiliateMembers.has(row.memberKey) ? row.issued : 0),
    0
  );
  const affiliateRows = rows.filter((row) => affiliateMembers.has(row.memberKey));
  const affiliateRetainedRevenue = affiliateRows.reduce(
    (total, row) => total + getRowRetainedRevenue(row),
    0
  );
  const affiliateRewardObligations = affiliateRows.reduce(
    (total, row) => total + getRowRewardObligation(row),
    0
  );
  const affiliateActualPayout = affiliateRows.reduce(
    (total, row) => total + Math.max(row.cashout, 0),
    0
  );
  const affiliateFinancialBurden = affiliateRewardObligations + affiliateActualPayout;
  const affiliateNetContribution = affiliateRetainedRevenue - affiliateFinancialBurden;
  const affiliateContributionMarginPct = safeDivide(
    affiliateNetContribution,
    affiliateRetainedRevenue
  ) * 100;
  const affiliateEconomicScore =
    affiliateRetainedRevenue > 0
      ? clamp(affiliateContributionMarginPct + 50, 0, 100)
      : affiliateFinancialBurden > 0
        ? 0
        : 50;
  const activationRate = safeDivide(activeAffiliateMembers.size, affiliateMembers.size) * 100;
  const retentionRate = safeDivide(affiliateRetentionMembers.size, affiliateMembers.size) * 100;
  const productivityShare = safeDivide(affiliateIssuedTotal, Math.max(summary.alpha_issued_total, 1)) * 100;
  const score =
    scoreAgainstTarget(activationRate, assumptions.affiliate.target_activation_rate_pct) * 0.25 +
    scoreAgainstTarget(retentionRate, assumptions.affiliate.target_retention_rate_pct) * 0.25 +
    scoreAgainstTarget(productivityShare, assumptions.affiliate.target_productivity_share_pct) * 0.15 +
    affiliateEconomicScore * 0.35;
  const evidenceLevel: StrategicObjectiveEvidenceLevel =
    directAffiliateEvidence && cashflow.hasCashflowData && affiliateRetainedRevenue > 0
      ? "direct"
      : "proxy";
  const reasons = [
    evidenceLevel === "direct"
      ? "Uses imported affiliate flags plus retained revenue and payout obligations from the cashflow lens."
      : "Uses affiliate activity or member-tier proxy because affiliate cashflow contribution is incomplete.",
    activationRate >= assumptions.affiliate.target_activation_rate_pct
      ? "Affiliate activation is strong enough for the current target."
      : "Affiliate activation is still below the current target.",
    retentionRate >= assumptions.affiliate.target_retention_rate_pct
      ? "Affiliate retention is stable enough to support expansion."
      : "Affiliate retention still looks fragile across periods.",
    affiliateNetContribution >= 0
      ? "Affiliate retained revenue covers affiliate reward and payout burden."
      : "Affiliate reward and payout burden exceeds affiliate retained revenue."
  ];
  const primaryMetrics = [
    buildMetric(
      "strategic.affiliate.active_affiliate_count",
      "Active affiliates",
      activeAffiliateMembers.size,
      "count"
    ),
    buildMetric(
      "strategic.affiliate.retained_revenue",
      "Affiliate retained revenue",
      affiliateRetainedRevenue,
      "usd"
    ),
    buildMetric(
      "strategic.affiliate.financial_burden",
      "Affiliate obligation + payout burden",
      affiliateFinancialBurden,
      "usd"
    ),
    buildMetric(
      "strategic.affiliate.net_contribution",
      "Affiliate net contribution",
      affiliateNetContribution,
      "usd"
    )
  ];

  return {
    metrics: {
      "strategic.affiliate.new_affiliate_count": roundMetric(newAffiliateMembers.size),
      "strategic.affiliate.active_affiliate_count": roundMetric(activeAffiliateMembers.size),
      "strategic.affiliate.affiliate_activation_rate": roundMetric(activationRate),
      "strategic.affiliate.affiliate_retention_rate": roundMetric(retentionRate),
      "strategic.affiliate.affiliate_productivity_share": roundMetric(productivityShare),
      "strategic.affiliate.retained_revenue": roundMetric(affiliateRetainedRevenue),
      "strategic.affiliate.financial_burden": roundMetric(affiliateFinancialBurden),
      "strategic.affiliate.net_contribution": roundMetric(affiliateNetContribution),
      "strategic.affiliate.contribution_margin_pct": roundMetric(affiliateContributionMarginPct),
      "strategic.affiliate.affiliate_growth_index": roundMetric(score),
      "strategic.affiliate.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "affiliate",
      "Affiliate Acquisition",
      score,
      evidenceLevel,
      primaryMetrics,
      reasons,
      assumptions.score_thresholds,
      cashflow
    )
  };
}

function evaluateActiveUsers(
  rows: StrategicWorkingRow[],
  assumptions: StrategicAssumptions,
  history: ReturnType<typeof extractMemberPeriodHistory>,
  cashflow: CashflowContext
) {
  const activeMembers = new Set(
    rows.filter((row) => row.activeMember).map((row) => row.memberKey)
  );
  const directLifecycleEvidence = rows.some(
    (row) => Boolean(row.memberJoinPeriod) || row.crossAppActive === true
  );
  const retainedMembers = new Set(
    [...history.activePeriodsByMember.entries()]
      .filter(([, activePeriods]) => activePeriods.size >= 2)
      .map(([memberKey]) => memberKey)
  );
  const newActiveMembers = new Set(
    rows
      .filter((row) => {
        if (!row.activeMember) {
          return false;
        }

        if (row.memberJoinPeriod) {
          return row.memberJoinPeriod === row.periodKey;
        }

        return history.earliestPeriod !== null && history.firstSeenPeriodByMember.get(row.memberKey) !== history.earliestPeriod;
      })
      .map((row) => row.memberKey)
  );
  const reactivatedMembers = new Set(
    rows.filter((row) => row.lifecycleStage === "reactivated").map((row) => row.memberKey)
  );
  const crossAppActiveShare = safeDivide(
    [...activeMembers].filter((memberKey) => history.crossAppMembers.has(memberKey)).length,
    Math.max(activeMembers.size, 1)
  ) * 100;
  const activeRows = rows.filter((row) => row.activeMember);
  const activeRetainedRevenue = activeRows.reduce(
    (total, row) => total + getRowRetainedRevenue(row),
    0
  );
  const activeFinancialBurden = activeRows.reduce(
    (total, row) => total + getRowFinancialBurden(row),
    0
  );
  const activeNetContribution = activeRetainedRevenue - activeFinancialBurden;
  const retainedRevenuePerActiveUser = safeDivide(activeRetainedRevenue, activeMembers.size);
  const netDeltaPerActiveUser = safeDivide(cashflow.netTreasuryDelta, activeMembers.size);
  const cashGeneratingActiveMembers = new Set(
    activeRows
      .filter((row) => getRowRetainedRevenue(row) > 0)
      .map((row) => row.memberKey)
  );
  const cashGeneratingActiveUserShare = safeDivide(
    cashGeneratingActiveMembers.size,
    Math.max(activeMembers.size, 1)
  ) * 100;
  const retainedShare = safeDivide(retainedMembers.size, Math.max(activeMembers.size, 1)) * 100;
  const newActiveShare = safeDivide(newActiveMembers.size, Math.max(activeMembers.size, 1)) * 100;
  const netDeltaPerActiveUserScore = scoreAgainstTarget(
    Math.max(netDeltaPerActiveUser, 0),
    NET_DELTA_PER_ACTIVE_USER_TARGET_USD
  );
  const score =
    scoreAgainstTarget(retainedShare, assumptions.active_user.target_retention_rate_pct) * 0.25 +
    scoreAgainstTarget(crossAppActiveShare, assumptions.active_user.target_cross_app_share_pct) * 0.2 +
    clamp(cashGeneratingActiveUserShare, 0, 100) * 0.25 +
    scoreAgainstTarget(
      retainedRevenuePerActiveUser,
      assumptions.revenue.target_revenue_per_active_member
    ) * 0.2 +
    netDeltaPerActiveUserScore * 0.1;
  const evidenceLevel: StrategicObjectiveEvidenceLevel =
    directLifecycleEvidence && cashflow.hasCashflowData && activeRetainedRevenue > 0
      ? "direct"
      : "proxy";
  const reasons = [
    evidenceLevel === "direct"
      ? "Uses imported lifecycle or cross-app activity fields plus retained revenue from the cashflow lens."
      : "Uses member-history proxy logic because active-user cashflow contribution is incomplete.",
    retainedShare >= assumptions.active_user.target_retention_rate_pct
      ? "Active-user retention is strong enough for the current target."
      : "Active-user retention is still below the current target.",
    crossAppActiveShare >= assumptions.active_user.target_cross_app_share_pct
      ? "Cross-app activity is broad enough to support ecosystem stickiness."
      : "Cross-app activity is still too narrow to prove durable ecosystem growth.",
    activeNetContribution >= 0
      ? "Active-user retained revenue covers active-user financial burden."
      : "Active-user financial burden exceeds active-user retained revenue."
  ];
  const primaryMetrics = [
    buildMetric(
      "strategic.active_user.active_user_count",
      "Active users",
      activeMembers.size,
      "count"
    ),
    buildMetric(
      "strategic.active_user.cash_generating_active_user_share",
      "Cash-generating active-user share",
      cashGeneratingActiveUserShare,
      "percent"
    ),
    buildMetric(
      "strategic.active_user.retained_revenue_per_active_user",
      "Retained revenue per active user",
      retainedRevenuePerActiveUser,
      "usd"
    ),
    buildMetric(
      "strategic.active_user.net_delta_per_active_user",
      "Net treasury delta per active user",
      netDeltaPerActiveUser,
      "usd"
    )
  ];

  return {
    metrics: {
      "strategic.active_user.active_user_count": roundMetric(activeMembers.size),
      "strategic.active_user.new_active_user_count": roundMetric(newActiveMembers.size),
      "strategic.active_user.retained_active_user_count": roundMetric(retainedMembers.size),
      "strategic.active_user.reactivated_user_count": roundMetric(reactivatedMembers.size),
      "strategic.active_user.cross_app_active_user_share": roundMetric(crossAppActiveShare),
      "strategic.active_user.cash_generating_active_user_share": roundMetric(cashGeneratingActiveUserShare),
      "strategic.active_user.retained_revenue_per_active_user": roundMetric(retainedRevenuePerActiveUser),
      "strategic.active_user.net_delta_per_active_user": roundMetric(netDeltaPerActiveUser),
      "strategic.active_user.net_contribution": roundMetric(activeNetContribution),
      "strategic.active_user.active_user_growth_index": roundMetric(score),
      "strategic.active_user.score": roundMetric(score)
    },
    scorecard: buildScorecard(
      "active_user",
      "Active-User Growth",
      score,
      evidenceLevel,
      primaryMetrics,
      reasons,
      assumptions.score_thresholds,
      cashflow
    )
  };
}

export function evaluateStrategicObjectives(input: {
  rows: StrategicWorkingRow[];
  summary: SummaryMetrics;
  baselineModel: StrategicBaselineModel;
}): StrategicEvaluation {
  const assumptions = input.baselineModel.strategicKpiAssumptions;
  const history = extractMemberPeriodHistory(input.rows);
  const cashflow = buildCashflowContext(input.summary);
  const revenue = evaluateRevenue(input.rows, input.summary, assumptions, history, cashflow);
  const opsCost = evaluateOpsCost(input.rows, input.summary, assumptions, cashflow);
  const tax = evaluateTax(assumptions, cashflow);
  const affiliate = evaluateAffiliate(input.rows, input.summary, assumptions, history, cashflow);
  const activeUser = evaluateActiveUsers(input.rows, assumptions, history, cashflow);

  return {
    strategic_metrics: {
      "strategic.cashflow.actual_outflow_burden_pct": roundMetric(cashflow.actualOutflowBurdenPct),
      "strategic.cashflow.obligation_burden_pct": roundMetric(cashflow.obligationBurdenPct),
      "strategic.cashflow.financial_pressure_ratio": roundMetric(cashflow.financialPressureRatio),
      "strategic.cashflow.obligation_coverage_pct": roundMetric(cashflow.obligationCoveragePct),
      "strategic.cashflow.net_treasury_margin_pct": roundMetric(cashflow.netTreasuryMarginPct),
      ...revenue.metrics,
      ...opsCost.metrics,
      ...tax.metrics,
      ...affiliate.metrics,
      ...activeUser.metrics
    },
    strategic_objectives: [
      revenue.scorecard,
      opsCost.scorecard,
      tax.scorecard,
      affiliate.scorecard,
      activeUser.scorecard
    ]
  };
}
