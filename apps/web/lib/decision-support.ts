import type {
  DecisionPackDecisionLogEntry,
  DecisionPackHistoricalTruthCoverage,
  DecisionPackRecommendedSetup,
  DecisionPackTruthAssumptionItem
} from "@bgc-alpha/schemas";

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

type GuardrailStatus = "allowed" | "conditional" | "locked";
type ParameterKind = "number" | "currency" | "percent" | "string" | "integer" | "months";

export type CompareDecisionSupportParameters = {
  k_pc: number;
  k_sp: number;
  reward_global_factor: number;
  reward_pool_factor: number;
  cap_user_monthly: string;
  cap_group_monthly: string;
  sink_target: number;
  cashout_mode: "ALWAYS_OPEN" | "WINDOWS";
  cashout_min_usd: number;
  cashout_fee_bps: number;
  cashout_windows_per_year: number;
  cashout_window_days: number;
  projection_horizon_months: number | null;
  milestone_count: number;
  cohort_projection_label: string;
};

export type CompareDecisionSupportRun = {
  id: string;
  label: string;
  scenarioName: string;
  snapshotName: string;
  verdict: string;
  summaryMetrics: Record<string, number>;
  parameters: CompareDecisionSupportParameters;
  historicalTruthCoverage: DecisionPackHistoricalTruthCoverage | null;
  strategicObjectives: {
    objective_key: string;
    label: string;
    status: string;
    score: number;
    evidence_level: string;
    primary_metrics: string[];
    reasons: string[];
  }[];
  milestoneEvaluations: {
    milestone_key: string;
    label: string;
    policy_status: string;
    reasons: string[];
  }[];
  decisionLog: DecisionPackDecisionLogEntry[];
  truthAssumptionMatrix: DecisionPackTruthAssumptionItem[];
  recommendedSetup: DecisionPackRecommendedSetup | null;
};

export type ParameterRangeSynthesisRow = {
  parameterKey: string;
  label: string;
  guardrailStatus: GuardrailStatus;
  recommendedValues: string;
  cautionValues: string | null;
  rejectedValues: string | null;
  testedValues: string;
  evidence: string;
  rationale: string;
};

export type CompareSimulationSummaryRow = {
  key: string;
  label: string;
  status: "ready" | "review" | "blocked" | "info";
  currentReadout: string;
  implication: string;
};

export type CompareSimulationSummaryArtifact = {
  status: "recommended" | "review" | "blocked";
  summary: string;
  rows: CompareSimulationSummaryRow[];
};

export type CompareParameterRegistryRow = {
  parameterKey: string;
  symbol: string;
  label: string;
  description: string;
  testedRange: string;
  workingDefault: string;
  currentRecommended: string;
  decisionOwner: string;
  classification: "scenario_lever" | "scenario_assumption" | "locked_boundary";
  guardrailStatus: GuardrailStatus;
};

export type CompareFounderQuestionRow = {
  key: string;
  status: "pending_founder" | "blocked" | "recommended";
  question: string;
  whyNow: string;
  decisionOwner: string;
  recommendedDirection: string;
  decisionOptions: string;
};

export type CompareFinancialScenarioViewRow = {
  runId: string;
  label: string;
  posture: string;
  verdict: "candidate" | "risky" | "rejected" | "pending";
  summary: string;
  tradeoff: string;
  grossCashIn: number;
  retainedRevenue: number;
  partnerPayoutOut: number;
  directObligations: number;
  actualPayoutOut: number;
  fulfillmentOut: number;
  netTreasuryDelta: number;
  treasuryPressure: number;
  reserveRunwayMonths: number;
  leakageRatePct: number;
};

export type CompareFinancialScenarioViewArtifact = {
  summary: string;
  rows: CompareFinancialScenarioViewRow[];
};

export type CompareExecutiveStatusMemoArtifact = {
  status: "recommended" | "review" | "blocked";
  summary: string;
  rows: CompareSimulationSummaryRow[];
};

export type CompareTechnicalImplementationPlanRow = {
  key: string;
  label: string;
  owner: string;
  status: "ready" | "in_progress" | "blocked" | "deferred";
  nextAction: string;
  whyItMatters: string;
};

export type CompareTechnicalImplementationPlanArtifact = {
  summary: string;
  rows: CompareTechnicalImplementationPlanRow[];
};

export type RecommendedPilotEnvelope = {
  status: "recommended" | "review" | "blocked";
  recommendedRunId: string | null;
  recommendedRunLabel: string | null;
  summary: string;
  items: Array<{
    label: string;
    value: string;
    status: "recommended" | "caution" | "locked";
    rationale: string;
  }>;
  reasons: string[];
};

export type CompareDecisionLogEntry = {
  key: string;
  title: string;
  status: "fixed_truth" | "recommended" | "pending_founder" | "blocked";
  owner: string;
  rationale: string;
};

export type CompareTruthAssumptionRow = {
  key: string;
  label: string;
  value: string;
  classification: "historical_truth" | "scenario_lever" | "scenario_assumption" | "locked_boundary" | "derived_assessment";
  note: string;
};

export type CompareDecisionSupportArtifacts = {
  simulationSummary: CompareSimulationSummaryArtifact;
  financialScenarioView: CompareFinancialScenarioViewArtifact;
  parameterRanges: ParameterRangeSynthesisRow[];
  parameterRegistry: CompareParameterRegistryRow[];
  recommendedEnvelope: RecommendedPilotEnvelope;
  decisionLog: CompareDecisionLogEntry[];
  founderQuestionQueue: CompareFounderQuestionRow[];
  executiveStatusMemo: CompareExecutiveStatusMemoArtifact;
  technicalImplementationPlan: CompareTechnicalImplementationPlanArtifact;
  truthAssumptionMatrix: CompareTruthAssumptionRow[];
};

type ParameterDescriptor = {
  key: keyof CompareDecisionSupportParameters;
  symbol: string;
  label: string;
  description: string;
  kind: ParameterKind;
  guardrailStatus: GuardrailStatus;
  decisionOwner: string;
  rationale: string;
};

const parameterDescriptors: ParameterDescriptor[] = [
  {
    key: "k_pc",
    symbol: "k_pc",
    label: "k_pc",
    description: "PC-to-ALPHA conversion coefficient applied on top of fixed PC truth.",
    kind: "number",
    guardrailStatus: "allowed",
    decisionOwner: "Founder / Tokenomics",
    rationale: "Allowed ALPHA conversion overlay on top of PC truth."
  },
  {
    key: "k_sp",
    symbol: "k_sp",
    label: "k_sp",
    description: "SP-to-ALPHA conversion coefficient applied on top of fixed SP/LTS truth.",
    kind: "number",
    guardrailStatus: "allowed",
    decisionOwner: "Founder / Tokenomics",
    rationale: "Allowed ALPHA conversion overlay on top of SP/LTS truth."
  },
  {
    key: "cap_user_monthly",
    symbol: "cap_user_monthly",
    label: "User monthly cap",
    description: "Maximum ALPHA issuance allowed per user each month.",
    kind: "string",
    guardrailStatus: "allowed",
    decisionOwner: "Founder / Tokenomics",
    rationale: "User-level monthly cap changes policy exposure without rewriting historical events."
  },
  {
    key: "cap_group_monthly",
    symbol: "cap_group_monthly",
    label: "Group monthly cap",
    description: "Maximum ALPHA issuance allowed per group each month.",
    kind: "string",
    guardrailStatus: "allowed",
    decisionOwner: "Founder / Tokenomics",
    rationale: "Group-level monthly cap changes policy exposure without rewriting historical events."
  },
  {
    key: "sink_target",
    symbol: "sink_target",
    label: "Sink target",
    description: "Desired share of ALPHA expected to recycle into internal utility sinks.",
    kind: "number",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Product",
    rationale: "Sink posture is a scenario assumption about desired internal use."
  },
  {
    key: "cashout_mode",
    symbol: "cashout_mode",
    label: "Cash-out mode",
    description: "Release mode used for the ALPHA cash-out path.",
    kind: "string",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Finance",
    rationale: "Cash-out release policy is an ALPHA overlay assumption."
  },
  {
    key: "cashout_min_usd",
    symbol: "cashout_min_usd",
    label: "Cash-out minimum",
    description: "Minimum value allowed to leave through one cash-out release.",
    kind: "currency",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Finance",
    rationale: "Cash-out minimum is an ALPHA overlay assumption."
  },
  {
    key: "cashout_fee_bps",
    symbol: "cashout_fee_bps",
    label: "Cash-out fee",
    description: "Fee charged on each cash-out release, expressed in basis points.",
    kind: "integer",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Finance",
    rationale: "Cash-out fee is an ALPHA overlay assumption."
  },
  {
    key: "cashout_windows_per_year",
    symbol: "cashout_windows_per_year",
    label: "Cash-out windows / year",
    description: "Number of release windows opened each year.",
    kind: "integer",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Finance / Ops",
    rationale: "Cash-out windows are scenario assumptions, not historical truth."
  },
  {
    key: "cashout_window_days",
    symbol: "cashout_window_days",
    label: "Cash-out window days",
    description: "Duration of each cash-out release window.",
    kind: "integer",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Ops",
    rationale: "Cash-out window duration is a scenario assumption, not historical truth."
  },
  {
    key: "projection_horizon_months",
    symbol: "projection_horizon_months",
    label: "Projection horizon",
    description: "How many months the scenario projects beyond the observed data window.",
    kind: "months",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / Strategy",
    rationale: "Projection horizon extends beyond observed history and must be framed as an assumption."
  },
  {
    key: "milestone_count",
    symbol: "milestone_count",
    label: "Milestone count",
    description: "Number of staged policy checkpoints defined inside a scenario.",
    kind: "integer",
    guardrailStatus: "conditional",
    decisionOwner: "Founder / PMO",
    rationale: "Milestone schedule is a staged policy assumption, not historical truth."
  }
];

function getStatusRank(status: string) {
  if (status === "candidate") return 0;
  if (status === "risky") return 1;
  if (status === "rejected") return 2;
  return 3;
}

function formatMonths(value: number | null) {
  return value === null ? "snapshot window" : `${decimalFormatter.format(value)} months`;
}

function formatParameterValue(
  descriptor: ParameterDescriptor,
  value: CompareDecisionSupportParameters[keyof CompareDecisionSupportParameters]
) {
  switch (descriptor.kind) {
    case "currency":
      return currencyFormatter.format(Number(value));
    case "percent":
      return `${decimalFormatter.format(Number(value))}%`;
    case "integer":
      return `${Math.round(Number(value))}`;
    case "months":
      return formatMonths((value as number | null) ?? null);
    case "number":
      return decimalFormatter.format(Number(value));
    default:
      return String(value);
  }
}

function formatValueSet(descriptor: ParameterDescriptor, values: Array<string | number | null>) {
  const normalizedValues = [...new Set(values.map((value) => value ?? "__null__"))];
  if (normalizedValues.length === 0) {
    return "n/a";
  }

  if (descriptor.kind === "number" || descriptor.kind === "currency" || descriptor.kind === "integer") {
    const numericValues = normalizedValues
      .map((value) => (value === "__null__" ? null : Number(value)))
      .filter((value): value is number => value !== null && Number.isFinite(value))
      .sort((left, right) => left - right);

    if (numericValues.length === 0) {
      return "n/a";
    }

    if (numericValues.length === 1 || numericValues[0] === numericValues[numericValues.length - 1]) {
      return formatParameterValue(descriptor, numericValues[0]);
    }

    return `${formatParameterValue(descriptor, numericValues[0])} → ${formatParameterValue(
      descriptor,
      numericValues[numericValues.length - 1]
    )}`;
  }

  return normalizedValues
    .map((value) => (value === "__null__" ? "snapshot window" : formatParameterValue(descriptor, value)))
    .join(", ");
}

function sortRunsForRecommendation(runs: CompareDecisionSupportRun[]) {
  return [...runs].sort((left, right) => {
    const leftRank = getStatusRank(left.verdict);
    const rightRank = getStatusRank(right.verdict);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftPressure = left.summaryMetrics.payout_inflow_ratio ?? 0;
    const rightPressure = right.summaryMetrics.payout_inflow_ratio ?? 0;
    if (leftPressure !== rightPressure) {
      return leftPressure - rightPressure;
    }

    const leftNet = left.summaryMetrics.company_net_treasury_delta_total ?? 0;
    const rightNet = right.summaryMetrics.company_net_treasury_delta_total ?? 0;
    if (leftNet !== rightNet) {
      return rightNet - leftNet;
    }

    const leftRunway = left.summaryMetrics.reserve_runway_months ?? 0;
    const rightRunway = right.summaryMetrics.reserve_runway_months ?? 0;
    if (leftRunway !== rightRunway) {
      return rightRunway - leftRunway;
    }

    const leftConcentration = left.summaryMetrics.reward_concentration_top10_pct ?? 0;
    const rightConcentration = right.summaryMetrics.reward_concentration_top10_pct ?? 0;
    return leftConcentration - rightConcentration;
  });
}

export function buildParameterRangeSynthesis(
  runs: CompareDecisionSupportRun[]
): ParameterRangeSynthesisRow[] {
  return parameterDescriptors.map((descriptor) => {
    const candidateRuns = runs.filter((run) => run.verdict === "candidate");
    const riskyRuns = runs.filter((run) => run.verdict === "risky");
    const rejectedRuns = runs.filter((run) => run.verdict === "rejected");

    const getValues = (targetRuns: CompareDecisionSupportRun[]) =>
      targetRuns.map((run) => run.parameters[descriptor.key]);

    const candidateValues = getValues(candidateRuns);
    const riskyValues = getValues(riskyRuns);
    const rejectedValues = getValues(rejectedRuns);
    const testedValues = runs.map((run) => run.parameters[descriptor.key]);

    return {
      parameterKey: String(descriptor.key),
      label: descriptor.label,
      guardrailStatus: descriptor.guardrailStatus,
      recommendedValues:
        candidateValues.length > 0
          ? formatValueSet(descriptor, candidateValues)
          : riskyValues.length > 0
            ? formatValueSet(descriptor, riskyValues)
            : formatValueSet(descriptor, testedValues),
      cautionValues:
        riskyValues.length > 0
          ? formatValueSet(descriptor, riskyValues)
          : null,
      rejectedValues:
        rejectedValues.length > 0
          ? formatValueSet(descriptor, rejectedValues)
          : null,
      testedValues: formatValueSet(descriptor, testedValues),
      evidence: `${candidateRuns.length} ready · ${riskyRuns.length} review · ${rejectedRuns.length} rejected`,
      rationale: descriptor.rationale
    };
  });
}

export function buildRecommendedPilotEnvelope(
  runs: CompareDecisionSupportRun[],
  parameterRanges: ParameterRangeSynthesisRow[]
): RecommendedPilotEnvelope {
  if (runs.length === 0) {
    return {
      status: "blocked",
      recommendedRunId: null,
      recommendedRunLabel: null,
      summary: "No selected runs are available to build a pilot envelope.",
      items: [],
      reasons: []
    };
  }

  const [bestRun] = sortRunsForRecommendation(runs);
  const status =
    bestRun.verdict === "candidate"
      ? "recommended"
      : bestRun.verdict === "risky"
        ? "review"
        : "blocked";

  const items = parameterRanges.map((row) => {
    const setupItem = bestRun.recommendedSetup?.items.find((item) => item.parameter_key === row.parameterKey);

    return {
      label: row.label,
      value:
        setupItem?.value ??
        formatParameterValue(
          parameterDescriptors.find((descriptor) => String(descriptor.key) === row.parameterKey) ?? parameterDescriptors[0],
          bestRun.parameters[row.parameterKey as keyof CompareDecisionSupportParameters]
        ),
      status:
        setupItem?.status ??
        (row.guardrailStatus === "allowed"
          ? "recommended"
          : row.guardrailStatus === "conditional"
            ? "caution"
            : "locked"),
      rationale: setupItem?.rationale ?? row.rationale
    };
  });

  const reasons = [
    `Best current candidate: ${bestRun.label}.`,
    `Net treasury delta ${currencyFormatter.format(bestRun.summaryMetrics.company_net_treasury_delta_total ?? 0)} with treasury pressure ${decimalFormatter.format(bestRun.summaryMetrics.payout_inflow_ratio ?? 0)}x.`,
    `Reserve runway ${decimalFormatter.format(bestRun.summaryMetrics.reserve_runway_months ?? 0)} months and top 10% reward share ${decimalFormatter.format(bestRun.summaryMetrics.reward_concentration_top10_pct ?? 0)}%.`
  ];

  if (bestRun.historicalTruthCoverage) {
    reasons.push(`Historical truth coverage is ${bestRun.historicalTruthCoverage.status}.`);
  }

  const firstDecisionBlocker = bestRun.decisionLog.find((entry) => entry.status === "blocked");
  if (firstDecisionBlocker) {
    reasons.push(firstDecisionBlocker.rationale);
  }

  return {
    status,
    recommendedRunId: bestRun.id,
    recommendedRunLabel: bestRun.label,
    summary:
      status === "recommended"
        ? "Selected runs already define a usable pilot envelope. The values below are taken from the strongest ready candidate while keeping conditional assumptions explicit."
        : status === "review"
          ? "Selected runs do not yet produce a clean ready envelope. The values below come from the least risky option and still need founder review."
          : "Selected runs do not yet define a defensible pilot envelope. Use the parameter ranges and decision log to understand what must be changed first.",
    items,
    reasons
  };
}

function buildCoverageSummary(runs: CompareDecisionSupportRun[]) {
  const counts = {
    strong: 0,
    partial: 0,
    weak: 0
  };

  for (const run of runs) {
    const status = run.historicalTruthCoverage?.status ?? "weak";
    counts[status] += 1;
  }

  return counts;
}

function buildPendingFounderLevers(parameterRanges: ParameterRangeSynthesisRow[]) {
  return parameterRanges
    .filter((row) => row.guardrailStatus === "conditional")
    .filter((row) => row.testedValues !== row.recommendedValues || row.cautionValues || row.rejectedValues)
    .map((row) => row.label);
}

function getParameterDescriptor(parameterKey: string) {
  return (
    parameterDescriptors.find((descriptor) => String(descriptor.key) === parameterKey) ??
    parameterDescriptors[0]
  );
}

function classifyParameterRow(
  row: ParameterRangeSynthesisRow
): "scenario_lever" | "scenario_assumption" | "locked_boundary" {
  if (row.guardrailStatus === "allowed") return "scenario_lever";
  if (row.guardrailStatus === "conditional") return "scenario_assumption";
  return "locked_boundary";
}

function findWorkingDefaultRun(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope
) {
  return (
    runs.find((run) => /baseline/i.test(run.scenarioName) || /baseline/i.test(run.label)) ??
    runs.find((run) => run.id === recommendedEnvelope.recommendedRunId) ??
    sortRunsForRecommendation(runs)[0] ??
    null
  );
}

function describeVerdictStatus(status: RecommendedPilotEnvelope["status"]) {
  if (status === "recommended") return "Ready";
  if (status === "review") return "Needs Review";
  return "Blocked";
}

function getFounderScenarioPosture(run: CompareDecisionSupportRun) {
  const name = `${run.scenarioName} ${run.label}`.toLowerCase();

  if (name.includes("conservative")) return "Safety-First";
  if (name.includes("baseline")) return "Working Baseline";
  if (name.includes("growth")) return "Expansion";
  if (name.includes("stress")) return "Shock Case";

  const pressure = run.summaryMetrics.payout_inflow_ratio ?? 0;
  const payout = run.summaryMetrics.company_actual_payout_out_total ?? 0;
  const retained = run.summaryMetrics.company_retained_revenue_total ?? 0;

  if (pressure < 0.25 && payout <= retained * 0.01) return "Safety-First";
  if (pressure < 0.5) return "Working Baseline";
  return "Expansion";
}

function summarizeFinancialTradeoff(
  run: CompareDecisionSupportRun,
  leakageRatePct: number
) {
  const netDelta = run.summaryMetrics.company_net_treasury_delta_total ?? 0;
  const pressure = run.summaryMetrics.payout_inflow_ratio ?? 0;
  const payout = run.summaryMetrics.company_actual_payout_out_total ?? 0;

  if (netDelta <= 0) {
    return "Current envelope is treasury-negative and should be treated as a warning path, not a default.";
  }

  if (pressure < 0.25 && leakageRatePct < 5) {
    return "Treasury protection dominates; founder tradeoff is lower member release in exchange for stronger reserve posture.";
  }

  if (payout > 0 && pressure < 1) {
    return "Envelope still stays treasury-positive while allowing member release; the main tradeoff is how much liquidity to permit now versus later.";
  }

  return "Envelope is still usable, but tradeoffs between member attractiveness and reserve protection should stay explicit.";
}

export function buildCompareFinancialScenarioView(
  runs: CompareDecisionSupportRun[]
): CompareFinancialScenarioViewArtifact {
  if (runs.length === 0) {
    return {
      summary: "No selected runs are available to build a founder financial view.",
      rows: []
    };
  }

  const rows = runs.map((run) => {
    const grossCashIn = run.summaryMetrics.company_gross_cash_in_total ?? 0;
    const retainedRevenue = run.summaryMetrics.company_retained_revenue_total ?? 0;
    const partnerPayoutOut = run.summaryMetrics.company_partner_payout_out_total ?? 0;
    const directObligations =
      (run.summaryMetrics.company_direct_reward_obligation_total ?? 0) +
      (run.summaryMetrics.company_pool_funding_obligation_total ?? 0);
    const actualPayoutOut = run.summaryMetrics.company_actual_payout_out_total ?? 0;
    const fulfillmentOut = run.summaryMetrics.company_product_fulfillment_out_total ?? 0;
    const netTreasuryDelta = run.summaryMetrics.company_net_treasury_delta_total ?? 0;
    const treasuryPressure = run.summaryMetrics.payout_inflow_ratio ?? 0;
    const reserveRunwayMonths = run.summaryMetrics.reserve_runway_months ?? 0;
    const leakageRatePct =
      grossCashIn > 0 ? ((actualPayoutOut + fulfillmentOut) / grossCashIn) * 100 : 0;

    return {
      runId: run.id,
      label: run.label,
      posture: getFounderScenarioPosture(run),
      verdict: (run.verdict as CompareFinancialScenarioViewRow["verdict"]) ?? "pending",
      summary:
        netTreasuryDelta >= 0
          ? `${currencyFormatter.format(netTreasuryDelta)} net treasury delta with ${decimalFormatter.format(treasuryPressure)}x pressure.`
          : `${currencyFormatter.format(netTreasuryDelta)} net treasury delta and ${decimalFormatter.format(treasuryPressure)}x pressure.`,
      tradeoff: summarizeFinancialTradeoff(run, leakageRatePct),
      grossCashIn,
      retainedRevenue,
      partnerPayoutOut,
      directObligations,
      actualPayoutOut,
      fulfillmentOut,
      netTreasuryDelta,
      treasuryPressure,
      reserveRunwayMonths,
      leakageRatePct
    };
  });

  return {
    summary:
      "Founder-facing financial readout. This compresses each compared run into business-cashflow language: money in, liability load, payout/fulfillment leakage, and resulting treasury posture.",
    rows
  };
}

export function buildCompareSimulationSummary(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope
): CompareSimulationSummaryArtifact {
  if (runs.length === 0) {
    return {
      status: "blocked",
      summary: "No selected runs are available to build a simulation summary.",
      rows: []
    };
  }

  const snapshotNames = [...new Set(runs.map((run) => run.snapshotName))];
  const labels = runs.map((run) => run.label);
  const top10Shares = runs.map((run) => run.summaryMetrics.reward_concentration_top10_pct ?? 0);
  const pressures = runs.map((run) => run.summaryMetrics.payout_inflow_ratio ?? 0);
  const runways = runs.map((run) => run.summaryMetrics.reserve_runway_months ?? 0);
  const coverage = buildCoverageSummary(runs);
  const uniqueVerdicts = [...new Set(runs.map((run) => run.verdict))];
  const bestRun = runs.find((run) => run.id === recommendedEnvelope.recommendedRunId) ?? sortRunsForRecommendation(runs)[0];

  return {
    status: recommendedEnvelope.status,
    summary:
      recommendedEnvelope.status === "recommended"
        ? "Selected runs already produce a usable pilot envelope, but the historical truth layer still needs to stay explicit."
        : recommendedEnvelope.status === "review"
          ? "Selected runs produce a working review envelope, but founder review is still needed before anything is treated as a default."
          : "Selected runs are still blocked from becoming a defensible pilot envelope and should be read as exploration only.",
    rows: [
      {
        key: "snapshot_basis",
        label: "Snapshot basis",
        status: snapshotNames.length === 1 ? "ready" : "review",
        currentReadout:
          snapshotNames.length === 1
            ? snapshotNames[0]!
            : `${snapshotNames.length} snapshots selected`,
        implication:
          snapshotNames.length === 1
            ? "All compared runs sit on the same imported business truth."
            : "Mixed snapshot truth reduces founder confidence in the comparison."
      },
      {
        key: "scenario_set",
        label: "Scenario set",
        status: "info",
        currentReadout: labels.join(", "),
        implication: "This compare set tests policy overlays on top of fixed imported history, not rewritten historical truth."
      },
      {
        key: "recommendation",
        label: "Current recommendation",
        status:
          recommendedEnvelope.status === "recommended"
            ? "ready"
            : recommendedEnvelope.status === "review"
              ? "review"
              : "blocked",
        currentReadout: `${describeVerdictStatus(recommendedEnvelope.status)} · ${recommendedEnvelope.recommendedRunLabel ?? "No strongest run"}`,
        implication: recommendedEnvelope.summary
      },
      {
        key: "treasury_readout",
        label: "Treasury readout",
        status: Math.max(...pressures) < 1 ? "ready" : "review",
        currentReadout: `Pressure ${decimalFormatter.format(Math.min(...pressures))}x → ${decimalFormatter.format(Math.max(...pressures))}x · Runway ${decimalFormatter.format(Math.min(...runways))} → ${decimalFormatter.format(Math.max(...runways))} months`,
        implication:
          Math.max(...pressures) < 1
            ? "Treasury is not the immediate blocker in the current compare set."
            : "Treasury pressure is overtaking recognized revenue in part of the compare set."
      },
      {
        key: "fairness_readout",
        label: "Fairness readout",
        status: Math.max(...top10Shares) > 60 ? "blocked" : "review",
        currentReadout: `Top 10% share ${decimalFormatter.format(Math.min(...top10Shares))}% → ${decimalFormatter.format(Math.max(...top10Shares))}%`,
        implication:
          Math.max(...top10Shares) > 60
            ? "Concentration remains the main blocker before a pilot policy can be locked."
            : "Concentration is improving, but still needs explicit founder review."
      },
      {
        key: "truth_posture",
        label: "Truth posture",
        status: coverage.weak > 0 ? "review" : coverage.partial > 0 ? "review" : "ready",
        currentReadout: `${coverage.strong} strong · ${coverage.partial} partial · ${coverage.weak} weak`,
        implication:
          coverage.weak > 0 || coverage.partial > 0
            ? "The compare set is usable for working decisions, but not yet canonical-close."
            : "Truth coverage is uniformly strong across the selected runs."
      },
      {
        key: "best_run",
        label: "Best current run",
        status: bestRun?.verdict === "candidate" ? "ready" : bestRun?.verdict === "risky" ? "review" : "blocked",
        currentReadout: bestRun ? `${bestRun.label} · Net ${currencyFormatter.format(bestRun.summaryMetrics.company_net_treasury_delta_total ?? 0)}` : "No best run",
        implication: bestRun ? `Current strongest run based on verdict, treasury pressure, runway, and concentration ordering.` : "No run available for ranking."
      }
    ]
  };
}

export function buildCompareExecutiveStatusMemo(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope,
  founderQuestionQueue: CompareFounderQuestionRow[]
): CompareExecutiveStatusMemoArtifact {
  if (runs.length === 0) {
    return {
      status: "blocked",
      summary: "No selected runs are available to build an executive status memo.",
      rows: []
    };
  }

  const bestRun =
    runs.find((run) => run.id === recommendedEnvelope.recommendedRunId) ??
    sortRunsForRecommendation(runs)[0];
  const coverage = buildCoverageSummary(runs);
  const top10Shares = runs.map((run) => run.summaryMetrics.reward_concentration_top10_pct ?? 0);
  const pendingFounder = founderQuestionQueue.filter((row) => row.status === "pending_founder").length;
  const blockedFounder = founderQuestionQueue.filter((row) => row.status === "blocked").length;
  const mainBlocker =
    Math.max(...top10Shares) > 60
      ? "Reward concentration"
      : coverage.weak > 0 || coverage.partial > 0
        ? "Truth coverage"
        : pendingFounder > 0
          ? "Founder decision backlog"
          : "No immediate blocker";

  return {
    status: recommendedEnvelope.status,
    summary:
      recommendedEnvelope.status === "blocked"
        ? "The current compare set is still exploratory and should not be treated as a founder-ready pilot package."
        : "The current compare set is strong enough to drive working founder documents, but final closure still depends on explicit decisions and caveats.",
    rows: [
      {
        key: "delivery_state",
        label: "Delivery state",
        status:
          recommendedEnvelope.status === "recommended"
            ? "ready"
            : recommendedEnvelope.status === "review"
              ? "review"
              : "blocked",
        currentReadout:
          recommendedEnvelope.status === "recommended"
            ? "Working founder package can be assembled now."
            : recommendedEnvelope.status === "review"
              ? "Working package is usable, but still review-grade."
              : "Exploration only",
        implication:
          recommendedEnvelope.status === "recommended"
            ? "Simulation outputs are strong enough to support v1 document drafting."
            : recommendedEnvelope.status === "review"
              ? "Documents can be updated on a working basis, but should not be framed as final locked policy."
              : "Do not close Whitepaper v1 or Tokenflow v1 on this compare set."
      },
      {
        key: "working_truth_basis",
        label: "Working truth basis",
        status: coverage.weak > 0 || coverage.partial > 0 ? "review" : "ready",
        currentReadout: `${coverage.strong} strong · ${coverage.partial} partial · ${coverage.weak} weak`,
        implication:
          coverage.weak > 0 || coverage.partial > 0
            ? "Accepted hybrid truth is usable for working drafts, but canonical-gap caveats must stay visible."
            : "Truth coverage is strong enough to support tighter founder claims."
      },
      {
        key: "current_envelope",
        label: "Current strongest envelope",
        status:
          bestRun?.verdict === "candidate"
            ? "ready"
            : bestRun?.verdict === "risky"
              ? "review"
              : "blocked",
        currentReadout: bestRun ? `${bestRun.label} · ${getFounderScenarioPosture(bestRun)}` : "No strongest run",
        implication:
          bestRun
            ? "Use this run as the current working anchor for summary, Whitepaper v1, and Tokenflow v1 updates."
            : "No stable anchor exists yet."
      },
      {
        key: "main_blocker",
        label: "Main blocker",
        status: mainBlocker === "No immediate blocker" ? "ready" : "review",
        currentReadout: mainBlocker,
        implication:
          mainBlocker === "Reward concentration"
            ? "Fairness is still the main closure risk even if treasury remains positive."
            : mainBlocker === "Truth coverage"
              ? "Truth caveats must stay explicit in any founder-facing draft."
              : mainBlocker === "Founder decision backlog"
                ? "Simulation has done its job; closure now depends on explicit founder choices."
                : "No single blocker dominates the current compare set."
      },
      {
        key: "founder_decisions",
        label: "Immediate founder decisions",
        status: blockedFounder > 0 ? "blocked" : pendingFounder > 0 ? "review" : "ready",
        currentReadout: `${pendingFounder} pending · ${blockedFounder} blocked`,
        implication:
          blockedFounder > 0
            ? "At least one decision must be resolved before the current envelope can be promoted."
            : pendingFounder > 0
              ? "The package is ready for founder review, but not all choices are locked."
              : "No outstanding founder decision is currently blocking closure."
      }
    ]
  };
}

export function buildCompareParameterRegistry(
  runs: CompareDecisionSupportRun[],
  parameterRanges: ParameterRangeSynthesisRow[],
  recommendedEnvelope: RecommendedPilotEnvelope
): CompareParameterRegistryRow[] {
  const workingDefaultRun = findWorkingDefaultRun(runs, recommendedEnvelope);

  return parameterRanges.map((row) => {
    const descriptor = getParameterDescriptor(row.parameterKey);
    const recommendedItem = recommendedEnvelope.items.find((item) => item.label === row.label);
    const workingValue = workingDefaultRun
      ? formatParameterValue(
          descriptor,
          workingDefaultRun.parameters[row.parameterKey as keyof CompareDecisionSupportParameters]
        )
      : "n/a";

    return {
      parameterKey: row.parameterKey,
      symbol: descriptor.symbol,
      label: row.label,
      description: descriptor.description,
      testedRange: row.testedValues,
      workingDefault: workingValue,
      currentRecommended: recommendedItem?.value ?? row.recommendedValues,
      decisionOwner: descriptor.decisionOwner,
      classification: classifyParameterRow(row),
      guardrailStatus: row.guardrailStatus
    };
  });
}

export function buildCompareTechnicalImplementationPlan(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope,
  founderQuestionQueue: CompareFounderQuestionRow[]
): CompareTechnicalImplementationPlanArtifact {
  const coverage = buildCoverageSummary(runs);
  const hasWorkingTruthGap = coverage.weak > 0 || coverage.partial > 0;
  const hasFounderDecisionBlocker = founderQuestionQueue.some((row) => row.status === "blocked");
  const hasFounderDecisionReview = founderQuestionQueue.some((row) => row.status === "pending_founder");

  return {
    summary:
      "Technical implementation should now stay focused on packaging and closure. Do not expand engine scope unless a blocker materially prevents Simulation Summary, Whitepaper v1, or Tokenflow v1 from closing.",
    rows: [
      {
        key: "truth_basis_lock",
        label: "Lock working truth basis",
        owner: "Data / Ops / Legal",
        status: hasWorkingTruthGap ? "in_progress" : "ready",
        nextAction:
          hasWorkingTruthGap
            ? "Treat accepted hybrid truth as the working basis and keep canonical-gap caveats explicit in v1 documents."
            : "Use the selected snapshot truth as the founder-facing basis without extra caveat escalation.",
        whyItMatters: "All downstream Simulation Summary, Whitepaper, and Tokenflow drafting depends on a stable truth basis."
      },
      {
        key: "pilot_envelope_lock",
        label: "Lock pilot envelope",
        owner: "Founder / Finance / Product",
        status:
          recommendedEnvelope.status === "blocked"
            ? "blocked"
            : hasFounderDecisionBlocker
              ? "blocked"
              : hasFounderDecisionReview || recommendedEnvelope.status === "review"
                ? "in_progress"
                : "ready",
        nextAction:
          recommendedEnvelope.recommendedRunLabel
            ? `Review and, if accepted, adopt ${recommendedEnvelope.recommendedRunLabel} as the working pilot baseline.`
            : "Re-run comparison until a strongest current envelope exists.",
        whyItMatters: "The chosen envelope is the numeric basis for all v1 tokenomics communication."
      },
      {
        key: "doc_binding",
        label: "Bind founder documents to simulation exports",
        owner: "Product / Strategy / PMO",
        status: "ready",
        nextAction: "Use structured compare exports for Simulation Summary, Whitepaper v1, and Tokenflow v1 drafting instead of copying manual numbers.",
        whyItMatters: "This prevents document drift and keeps all founder-facing material tied to the current compare set."
      },
      {
        key: "exec_package",
        label: "Close founder package",
        owner: "Founder Office / PMO",
        status: hasFounderDecisionBlocker ? "blocked" : "in_progress",
        nextAction: "Finalize Executive Status Memo, Decision Log, and Technical Implementation Plan using the current compare artifacts.",
        whyItMatters: "The brief asks for a decision package, not just scenario UI."
      },
      {
        key: "canonical_followup",
        label: "Canonical fidelity follow-up",
        owner: "Data / Engineering",
        status: "deferred",
        nextAction: "Treat full canonical/event-native closure as post-v1 hardening work unless it becomes a blocking claim issue.",
        whyItMatters: "This is important for later rigor, but it should not expand current scope and delay the brief package."
      }
    ]
  };
}

export function buildCompareFounderQuestionQueue(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope,
  parameterRanges: ParameterRangeSynthesisRow[],
  decisionLog: CompareDecisionLogEntry[]
): CompareFounderQuestionRow[] {
  if (runs.length === 0) {
    return [];
  }

  const coverage = buildCoverageSummary(runs);
  const top10Shares = runs.map((run) => run.summaryMetrics.reward_concentration_top10_pct ?? 0);
  const pendingFounderLevers = buildPendingFounderLevers(parameterRanges);
  const recommendedRun = runs.find((run) => run.id === recommendedEnvelope.recommendedRunId) ?? null;
  const cashoutLevers = parameterRanges
    .filter((row) => row.parameterKey.startsWith("cashout_"))
    .map((row) => `${row.label}: ${row.recommendedValues}`)
    .join(" · ");
  const issuanceLevers = parameterRanges
    .filter((row) => ["k_pc", "k_sp", "cap_user_monthly", "cap_group_monthly"].includes(row.parameterKey))
    .map((row) => `${row.label}: ${row.recommendedValues}`)
    .join(" · ");

  const questions: CompareFounderQuestionRow[] = [
    {
      key: "pilot_baseline_choice",
      status:
        recommendedEnvelope.status === "recommended"
          ? "recommended"
          : recommendedEnvelope.status === "review"
            ? "pending_founder"
            : "blocked",
      question: "Should the current strongest run be promoted into the working pilot baseline?",
      whyNow:
        recommendedEnvelope.recommendedRunLabel
          ? `${recommendedEnvelope.recommendedRunLabel} is currently the least risky envelope in the selected set.`
          : "No strongest run is available yet.",
      decisionOwner: "Founder",
      recommendedDirection:
        recommendedEnvelope.recommendedRunLabel
          ? `Treat ${recommendedEnvelope.recommendedRunLabel} as the working review baseline, not the final production lock.`
          : "Do not lock a baseline until compare produces a stronger candidate.",
      decisionOptions: "Adopt current strongest run · Keep comparison open · Tighten levers and rerun"
    }
  ];

  if (pendingFounderLevers.length > 0) {
    questions.push({
      key: "conditional_policy_levers",
      status: "pending_founder",
      question: "Which conditional policy assumptions should be chosen for Phase 1?",
      whyNow: `The compared runs still vary on ${pendingFounderLevers.join(", ")}.`,
      decisionOwner: "Founder / Finance / Product",
      recommendedDirection: recommendedRun
        ? `Stay close to the current strongest envelope: ${cashoutLevers || "use the least-risk release posture from compare"}.`
        : "Use the least-risk tested assumption set until a stronger compare result exists.",
      decisionOptions: "Tighter release posture · Moderate release posture · More attractive member-facing posture"
    });
  }

  questions.push({
    key: "issuance_envelope_choice",
    status: "pending_founder",
    question: "How aggressive should the Phase 1 issuance envelope be?",
    whyNow: "k_pc, k_sp, and monthly caps materially shift issuance, treasury pressure, and concentration.",
    decisionOwner: "Founder / Tokenomics",
    recommendedDirection: recommendedRun
      ? `Keep issuance close to the least-risk tested envelope: ${issuanceLevers}.`
      : "Prefer the lower-risk issuance range until fairness and payout behavior improve.",
    decisionOptions: "Safety-first envelope · Moderate envelope · Expansion envelope"
  });

  if (Math.max(...top10Shares) > 60) {
    questions.push({
      key: "fairness_gate",
      status: "blocked",
      question: "What fairness threshold must be cleared before the pilot is treated as founder-ready?",
      whyNow: `Top 10% concentration still sits between ${decimalFormatter.format(Math.min(...top10Shares))}% and ${decimalFormatter.format(Math.max(...top10Shares))}% across the selected set.`,
      decisionOwner: "Founder",
      recommendedDirection: "Keep pilot lock blocked until a formal fairness threshold is agreed and the selected envelope clears it.",
      decisionOptions: "Block until concentration improves · Allow pilot with explicit exception · Redesign fairness controls first"
    });
  }

  if (coverage.partial > 0 || coverage.weak > 0) {
    questions.push({
      key: "working_truth_posture",
      status: "pending_founder",
      question: "Can the accepted hybrid snapshot be treated as the working truth basis for v1 documents?",
      whyNow: decisionLog.find((entry) => entry.key === "truth_coverage_gap")?.rationale ?? "Truth coverage is not uniformly strong across the selected set.",
      decisionOwner: "Founder / Data / Legal",
      recommendedDirection: "Use accepted hybrid truth for Simulation Summary, Whitepaper v1, and Tokenflow v1 working drafts, while keeping canonical-gap caveats explicit.",
      decisionOptions: "Use as working basis with caveat · Delay document closure until stronger truth coverage · Narrow claims to fully covered areas only"
    });
  }

  return questions;
}

export function buildCompareDecisionLog(
  runs: CompareDecisionSupportRun[],
  recommendedEnvelope: RecommendedPilotEnvelope,
  parameterRanges: ParameterRangeSynthesisRow[]
): CompareDecisionLogEntry[] {
  const coverage = buildCoverageSummary(runs);
  const proxyObjectives = [
    ...new Set(
      runs.flatMap((run) =>
        run.strategicObjectives
          .filter((objective) => objective.evidence_level !== "direct")
          .map((objective) => `${objective.label ?? objective.objective_key} (${objective.evidence_level})`)
      )
    )
  ];
  const nonCandidateMilestones = [
    ...new Set(
      runs.flatMap((run) =>
        run.milestoneEvaluations
          .filter((milestone) => milestone.policy_status !== "candidate")
          .map((milestone) => `${run.label}: ${milestone.label}`)
      )
    )
  ];
  const pendingFounderLevers = buildPendingFounderLevers(parameterRanges);

  const log: CompareDecisionLogEntry[] = [
    {
      key: "understanding_doc_truth",
      title: "Historical business truth stays fixed across compared runs",
      status: "fixed_truth",
      owner: "Understanding Doc",
      rationale: "Compare reads selected scenarios on top of snapshot truth; scenario overlays do not rewrite imported reward or cashflow history."
    },
    {
      key: "pilot_envelope_recommendation",
      title: "Pilot envelope recommendation from compare",
      status:
        recommendedEnvelope.status === "recommended"
          ? "recommended"
          : recommendedEnvelope.status === "review"
            ? "pending_founder"
            : "blocked",
      owner: "Founder",
      rationale:
        recommendedEnvelope.recommendedRunLabel
          ? `${recommendedEnvelope.recommendedRunLabel} is the strongest current envelope among the selected runs.`
          : recommendedEnvelope.summary
    }
  ];

  if (pendingFounderLevers.length > 0) {
    log.push({
      key: "founder_assumption_levers",
      title: "Conditional policy assumptions still need founder choice",
      status: "pending_founder",
      owner: "Founder",
      rationale: `The compared runs still vary on ${pendingFounderLevers.join(", ")}. These must be explicitly chosen as assumptions rather than treated as historical truth.`
    });
  }

  if (coverage.partial > 0 || coverage.weak > 0) {
    log.push({
      key: "truth_coverage_gap",
      title: "Historical truth coverage is not uniformly strong",
      status: "blocked",
      owner: "Data / Ops",
      rationale: `${coverage.strong} strong, ${coverage.partial} partial, and ${coverage.weak} weak snapshot-truth coverage states are present in the selected runs.`
    });
  }

  if (proxyObjectives.length > 0) {
    log.push({
      key: "strategic_evidence_gap",
      title: "Some strategic goals still rely on proxy or checklist evidence",
      status: "blocked",
      owner: "Data / Legal / Ops",
      rationale: proxyObjectives.join("; ")
    });
  }

  if (nonCandidateMilestones.length > 0) {
    log.push({
      key: "milestone_governance_gap",
      title: "Milestone promotion still needs governance review",
      status: "pending_founder",
      owner: "Founder",
      rationale: nonCandidateMilestones.join("; ")
    });
  }

  return log;
}

export function buildCompareTruthAssumptionMatrix(
  runs: CompareDecisionSupportRun[],
  parameterRanges: ParameterRangeSynthesisRow[]
): CompareTruthAssumptionRow[] {
  const snapshotNames = [...new Set(runs.map((run) => run.snapshotName))];
  const coverage = buildCoverageSummary(runs);

  const baseRows: CompareTruthAssumptionRow[] = [
    {
      key: "snapshot_truth",
      label: "Approved snapshot truth",
      value: snapshotNames.length === 1 ? snapshotNames[0] : `${snapshotNames.length} snapshots selected`,
      classification: "historical_truth",
      note: "Imported reward distributions and recognized revenue support remain the historical basis underneath compare."
    },
    {
      key: "truth_coverage",
      label: "Historical truth coverage",
      value: `${coverage.strong} strong · ${coverage.partial} partial · ${coverage.weak} weak`,
      classification: "derived_assessment",
      note: "Canonical/event-ledger coverage is summarized so founder claims stay calibrated to actual stored truth."
    }
  ];

  const parameterRows = parameterRanges.map<CompareTruthAssumptionRow>((row) => ({
    key: row.parameterKey,
    label: row.label,
    value: row.recommendedValues,
    classification:
      row.guardrailStatus === "allowed"
        ? "scenario_lever"
        : row.guardrailStatus === "conditional"
          ? "scenario_assumption"
          : "locked_boundary",
    note: row.rationale
  }));

  parameterRows.push({
    key: "reward_factor_lock",
    label: "Global / pool reward factors",
    value: "locked to neutral baseline",
    classification: "locked_boundary",
    note: "Generic reward multipliers stay locked so named understanding-doc reward semantics are not distorted."
  });
  parameterRows.push({
    key: "cohort_projection_lock",
    label: "Synthetic cohort projection",
    value: "disabled in founder-safe mode",
    classification: "locked_boundary",
    note: "Synthetic member growth, churn, and reactivation are not treated as faithful historical truth."
  });

  return [...baseRows, ...parameterRows];
}

export function buildCompareDecisionSupportArtifacts(
  runs: CompareDecisionSupportRun[]
): CompareDecisionSupportArtifacts {
  const parameterRanges = buildParameterRangeSynthesis(runs);
  const recommendedEnvelope = buildRecommendedPilotEnvelope(runs, parameterRanges);
  const simulationSummary = buildCompareSimulationSummary(runs, recommendedEnvelope);
  const financialScenarioView = buildCompareFinancialScenarioView(runs);
  const parameterRegistry = buildCompareParameterRegistry(runs, parameterRanges, recommendedEnvelope);
  const decisionLog = buildCompareDecisionLog(runs, recommendedEnvelope, parameterRanges);
  const founderQuestionQueue = buildCompareFounderQuestionQueue(runs, recommendedEnvelope, parameterRanges, decisionLog);
  const executiveStatusMemo = buildCompareExecutiveStatusMemo(
    runs,
    recommendedEnvelope,
    founderQuestionQueue
  );
  const technicalImplementationPlan = buildCompareTechnicalImplementationPlan(
    runs,
    recommendedEnvelope,
    founderQuestionQueue
  );
  const truthAssumptionMatrix = buildCompareTruthAssumptionMatrix(runs, parameterRanges);

  return {
    simulationSummary,
    financialScenarioView,
    parameterRanges,
    parameterRegistry,
    recommendedEnvelope,
    decisionLog,
    founderQuestionQueue,
    executiveStatusMemo,
    technicalImplementationPlan,
    truthAssumptionMatrix
  };
}
