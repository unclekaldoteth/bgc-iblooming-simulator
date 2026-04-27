import {
  formatSummaryMetricValue,
  getSummaryMetricDefinition,
  summaryMetricDefinitions,
  type SummaryMetricKey
} from "./summary-metrics";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency"
});
const yearFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

const summaryMetricKeys = new Set(summaryMetricDefinitions.map((definition) => definition.key));
const fiatMetricKeys = new Set<string>();

const segmentTypeLabels: Record<string, string> = {
  alpha_behavior: "ALPHA Flow",
  member_tier: "ALPHA Issued by Member Group",
  milestone: "Phase Totals",
  source_system: "Source"
};

const segmentKeyLabels: Record<string, string> = {
  actual_spend: "Actual Used",
  bgc: "BGC",
  burn_expire: "Expired / Burned",
  cashout: "Cash-Out",
  ending_balance: "Ending Balance",
  hold: "Held",
  iblooming: "iBLOOMING",
  modeled_spend: "Modeled Used",
  unknown: "Unclassified",
  spend: "Used"
};

const metricLabels: Record<string, string> = {
  actual_sink_utilization_rate: "Actual Internal Use",
  alpha_actual_spent_total: "Actual ALPHA Used",
  alpha_cashout_equivalent_total: "Cash-Out Equivalent",
  alpha_ending_balance_total: "Ending ALPHA Balance",
  alpha_expired_burned_total: "Expired / Burned ALPHA",
  alpha_issued_total: "ALPHA Issued",
  alpha_modeled_spent_total: "Modeled ALPHA Used",
  alpha_opening_balance_total: "Opening ALPHA Balance",
  alpha_spent_total: "ALPHA Used",
  alpha_total: "ALPHA Total",
  forecast_period_is_projected: "Projected Period",
  modeled_sink_utilization_rate: "Modeled Internal Use",
  payout_inflow_ratio: "Treasury Pressure",
  reward_share_pct: "Issued Share",
  reserve_runway_months: "Reserve Runway",
  sink_utilization_rate: "Internal Use",
  usd_equivalent_total: "ALPHA Cash-Out"
};

const policyStatusLabels: Record<string, string> = {
  candidate: "Ready",
  risky: "Needs Review",
  rejected: "Do Not Use"
};

const runStatusLabels: Record<string, string> = {
  COMPLETED: "Completed",
  FAILED: "Failed",
  QUEUED: "Queued",
  RUNNING: "Running"
};

const evidenceLevelLabels: Record<string, string> = {
  checklist: "Checklist Only",
  direct: "Direct Data",
  proxy: "Proxy Estimate"
};

const historicalTruthCoverageLabels: Record<string, string> = {
  strong: "Strong",
  partial: "Some Gaps",
  weak: "Weak",
  available: "Available",
  missing: "Missing"
};

const setupStatusLabels: Record<string, string> = {
  recommended: "Recommended",
  caution: "Assumption",
  locked: "Locked"
};

const decisionLogStatusLabels: Record<string, string> = {
  fixed_truth: "Imported Data",
  recommended: "Recommended",
  pending_founder: "Decision Needed",
  blocked: "Blocked"
};

const decisionGovernanceStatusLabels: Record<string, string> = {
  draft: "Draft",
  proposed: "Proposed",
  accepted: "Accepted",
  rejected: "Rejected",
  deferred: "Deferred"
};

const truthClassificationLabels: Record<string, string> = {
  historical_truth: "Imported Data",
  scenario_lever: "Editable",
  scenario_assumption: "Assumption",
  locked_boundary: "Locked",
  derived_assessment: "Calculated"
};

const snapshotSourceTypeLabels: Record<string, string> = {
  compatibility_csv: "Monthly CSV",
  canonical_csv: "Full Detail CSV",
  canonical_json: "Full Detail JSON",
  canonical_bundle: "Full Detail Bundle",
  hybrid_verified: "Hybrid Data"
};

const snapshotValidationBasisLabels: Record<string, string> = {
  monthly_facts: "Monthly Data",
  canonical_events: "Event Data",
  hybrid_validation: "Hybrid Check"
};

const snapshotFounderReadinessLabels: Record<string, string> = {
  founder_safe: "Ready to Use",
  needs_canonical_closure: "Needs More Data"
};

const scenarioModeLabels: Record<string, string> = {
  founder_safe: "Imported Data Only",
  advanced_forecast: "Add Forecast"
};

const canonicalGapStatusLabels: Record<string, string> = {
  covered: "Available",
  partial: "Some Gaps",
  missing: "Missing",
  strong: "Strong",
  weak: "Weak"
};

const dataSetStatusLabels: Record<string, string> = {
  APPROVED: "Approved",
  ARCHIVED: "Archived",
  DRAFT: "Draft",
  INVALID: "Needs Fixes",
  VALID: "Ready to Approve",
  VALIDATING: "Checking"
};

const importStatusLabels: Record<string, string> = {
  COMPLETED: "Imported",
  FAILED: "Import Failed",
  QUEUED: "Queued",
  RUNNING: "Importing"
};

const riskSeverityLabels: Record<string, string> = {
  ERROR: "Error",
  WARNING: "Warning",
  critical: "Critical",
  info: "Note",
  warning: "Warning"
};

function toTitleCase(value: string) {
  return value
    .replace(/[_\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getCommonMetricLabel(metricKey: string) {
  if (summaryMetricKeys.has(metricKey as SummaryMetricKey)) {
    return getSummaryMetricDefinition(metricKey as SummaryMetricKey).label;
  }

  return metricLabels[metricKey] ?? toTitleCase(metricKey);
}

export function formatCommonMetricValue(metricKey: string, metricValue: number) {
  if (summaryMetricKeys.has(metricKey as SummaryMetricKey)) {
    return formatSummaryMetricValue(metricKey as SummaryMetricKey, metricValue);
  }

  const formatted = numberFormatter.format(metricValue);

  if (fiatMetricKeys.has(metricKey) || metricKey.endsWith("_usd")) {
    return currencyFormatter.format(metricValue);
  }

  if (metricKey.endsWith("_pct")) {
    return `${formatted}%`;
  }

  if (metricKey.endsWith("_ratio") || metricKey.includes("ratio")) {
    return `${formatted}x`;
  }

  if (metricKey.endsWith("_months")) {
    return formatMonthCountLabel(metricValue);
  }

  return formatted;
}

export function formatMonthCountLabel(months: number) {
  const formatted = numberFormatter.format(months);
  return `${formatted} ${Math.abs(months) === 1 ? "month" : "months"}`;
}

export function formatPlanningHorizonLabel(months: number | null | undefined) {
  if (!months) {
    return "current data range";
  }

  const monthLabel = formatMonthCountLabel(months);

  if (months >= 12) {
    const years = months / 12;
    const yearLabel = `${yearFormatter.format(years)} ${
      Math.abs(years - 1) < Number.EPSILON ? "year" : "years"
    }`;
    return `${monthLabel} (${yearLabel})`;
  }

  return monthLabel;
}

export function getSegmentTypeLabel(segmentType: string) {
  return segmentTypeLabels[segmentType] ?? toTitleCase(segmentType);
}

export function getSegmentKeyLabel(segmentKey: string) {
  return segmentKeyLabels[segmentKey] ?? toTitleCase(segmentKey);
}

export function getPolicyStatusLabel(status: string) {
  return policyStatusLabels[status] ?? toTitleCase(status);
}

export function getRunStatusLabel(status: string) {
  return runStatusLabels[status] ?? toTitleCase(status);
}

export function getEvidenceLevelLabel(level: string) {
  return evidenceLevelLabels[level] ?? toTitleCase(level);
}

export function getHistoricalTruthCoverageLabel(status: string) {
  return historicalTruthCoverageLabels[status] ?? toTitleCase(status);
}

export function getSetupStatusLabel(status: string) {
  return setupStatusLabels[status] ?? toTitleCase(status);
}

export function getDecisionLogStatusLabel(status: string) {
  return decisionLogStatusLabels[status] ?? toTitleCase(status);
}

export function getDecisionGovernanceStatusLabel(status: string) {
  return decisionGovernanceStatusLabels[status] ?? toTitleCase(status);
}

export function getTruthClassificationLabel(classification: string) {
  return truthClassificationLabels[classification] ?? toTitleCase(classification);
}

export function getSnapshotSourceTypeLabel(sourceType: string) {
  return snapshotSourceTypeLabels[sourceType] ?? toTitleCase(sourceType);
}

export function getSnapshotValidationBasisLabel(validatedVia: string) {
  return snapshotValidationBasisLabels[validatedVia] ?? toTitleCase(validatedVia);
}

export function getSnapshotFounderReadinessLabel(readiness: string) {
  return snapshotFounderReadinessLabels[readiness] ?? toTitleCase(readiness);
}

export function getScenarioModeLabel(mode: string | null | undefined) {
  return scenarioModeLabels[mode ?? "founder_safe"] ?? toTitleCase(mode ?? "founder_safe");
}

export function getScenarioModeCaveat(mode: string | null | undefined) {
  if (mode !== "advanced_forecast") {
    return null;
  }

  return "Add Forecast uses growth assumptions. Treat the result as an estimate, not observed data.";
}

export function getCanonicalGapStatusLabel(status: string) {
  return canonicalGapStatusLabels[status] ?? toTitleCase(status);
}

export function getDataSetStatusLabel(status: string) {
  return dataSetStatusLabels[status] ?? toTitleCase(status);
}

export function getImportStatusLabel(status: string) {
  return importStatusLabels[status] ?? toTitleCase(status);
}

export function getRiskSeverityLabel(level: string) {
  return riskSeverityLabels[level] ?? toTitleCase(level);
}

export function getRunReference(runId: string) {
  return `Ref ${runId.slice(-6).toUpperCase()}`;
}

export function simplifyResultText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replace(/founder-facing/gi, "team-facing")
    .replace(/founder material/gi, "team material")
    .replace(/founder\/legal lock/gi, "team/legal decision")
    .replace(/founder review/gi, "team review")
    .replace(/\bFounder \/ Strategy\b/g, "Business Team / Strategy")
    .replace(/\bFounder\b/g, "Business Team")
    .replace(/\bfounder\b/g, "team")
    .replace(/canonical\/event-native closure/gi, "stronger source details")
    .replace(/canonical fidelity audit/gi, "source detail check")
    .replace(/canonical fidelity/gi, "source detail")
    .replace(/\bcanonical\b/gi, "source detail")
    .replace(/cashflow lens/gi, "money view")
    .replace(/\bcashflow\b/gi, "money")
    .replace(/recognized revenue support/gi, "uploaded revenue data")
    .replace(/snapshot reward distributions/gi, "uploaded reward data")
    .replace(
      /Phase 1 ALPHA ALPHA flow mechanics are evidenced as an internal non-transferable policy-credit layer\./gi,
      "Phase 1 ALPHA is supported as an internal, non-transferable credit."
    )
    .replace(/ALPHA ALPHA flow/gi, "ALPHA flow")
    .replace(/policy-credit layer/gi, "credit")
    .replace(/\bevidenced\b/gi, "supported")
    .replace(
      /Defines the language boundary for ALPHA before ALPHA flow or Whitepaper claims are written\./gi,
      "Defines what ALPHA is before ALPHA flow or whitepaper claims are written."
    )
    .replace(
      /Observed snapshot periods and forward-looking periods are separated in the result evidence\./gi,
      "Uploaded data months and forecast months are separated in this result."
    )
    .replace(
      /Whitepaper text must cite snapshot truth, scenario parameters, result metrics, flags, and caveats from this pack\./gi,
      "Whitepaper should cite uploaded data, scenario settings, result metrics, warnings, and caveats."
    )
    .replace(/Historical truth coverage is not fully strong/gi, "Uploaded data is not complete enough")
    .replace(/source detail is not fully closed/gi, "Source detail is not complete")
    .replace(/fairness gate/gi, "fairness threshold")
    .replace(/public public token/gi, "public token")
    .replace(/actual sink_spend_usd/gi, "uploaded internal-use data")
    .replace(/sink_spend_usd/gi, "uploaded internal-use data")
    .replace(/modeled sink adoption/gi, "modeled internal-use adoption")
    .replace(/forecast sink adoption/gi, "forecast internal-use adoption")
    .replace(/modeled sink demand/gi, "modeled internal-use demand")
    .replace(/sink adoption/gi, "internal-use adoption")
    .replace(/sink target/gi, "internal-use target")
    .replace(/sink model/gi, "internal-use model")
    .replace(/P1 Token Flow Spec Lock/g, "ALPHA Policy")
    .replace(/P2 Token Flow Ledger/g, "ALPHA Ledger")
    .replace(/P3 Actual vs Forecast Sink/g, "Actual vs Modeled Internal Use")
    .replace(/P3 Forecast Layer/g, "Forecast Settings")
    .replace(/P4 Supply Model/g, "Supply Model")
    .replace(/P4 Allocation/g, "Allocation")
    .replace(/P4 Liquidity \/ Governance \/ Legal/g, "Liquidity / Decision Rules / Legal")
    .replace(/P4 Web3 Tokenomics Extension/g, "Web3 Assumptions")
    .replace(/P5 Whitepaper Evidence Pack/g, "Whitepaper Evidence")
    .replace(/Token Flow/g, "ALPHA Flow")
    .replace(/actual periods/gi, "observed months")
    .replace(/projected periods/gi, "forecast months")
    .replace(/internal_credit/g, "internal credit")
    .replace(/non_transferable/g, "non transferable")
    .replace(/not_on_chain/g, "not on chain")
    .replace(/alpha_internal/g, "internal ALPHA")
    .replace(/not_applicable_internal/g, "not applicable for internal ALPHA")
    .replace(/snapshot_window/g, "uploaded data window")
    .replace(/founder_admin/g, "team admin")
    .replace(/not_started/g, "not started")
    .replace(/policy-token/gi, "ALPHA")
    .replace(/token-flow/gi, "ALPHA flow")
    .replace(/Tokenflow/g, "ALPHA flow")
    .replace(/ALPHA ALPHA flow/gi, "ALPHA flow")
    .replace(
      /Phase 1 ALPHA flow mechanics are supported as an internal non-transferable credit\./gi,
      "Phase 1 ALPHA is supported as an internal, non-transferable credit."
    )
    .replace(
      /Defines the language boundary for ALPHA before ALPHA flow or Whitepaper claims are written\./gi,
      "Defines what ALPHA is before ALPHA flow or whitepaper claims are written."
    )
    .replace(
      /Observed snapshot periods and forward-looking periods are separated[^.]*\./gi,
      "Uploaded data months and forecast months are separated in this result."
    )
    .replace(/result output includes/gi, "Result output includes")
    .replace(/by period/gi, "by month")
    .replace(/uploaded internal-use data is preserved separately from forecast adoption assumptions/gi, "Uploaded internal-use data stays separate from forecast adoption assumptions")
    .replace(/explicit liquidity posture, governance control,/gi, "clear liquidity, decision rules,")
    .replace(/governance control/gi, "decision rules")
    .replace(/weak truth/gi, "weak data")
    .replace(/tokenomics wording/gi, "public token wording")
    .replace(/tokenomics/gi, "token plan")
    .replace(
      /Reward concentration is above the fairness threshold; public public token wording should not claim broad distribution yet\./gi,
      "Reward concentration is high, so public token wording should not claim broad distribution yet."
    )
    .replace(/public public token wording/gi, "public token wording")
    .replace(/net treasury delta/gi, "net cash change")
    .replace(/\bMilestone\b/g, "Phase")
    .replace(/\bmilestone\b/g, "phase")
    .replace(/pilot policy envelope/gi, "recommended setup")
    .replace(/pilot envelope/gi, "recommended setup")
    .replace(/recommended pilot envelope/gi, "recommended setup")
    .replace(/\bRun\b/g, "Result")
    .replace(/\brun\b/g, "result");
}
