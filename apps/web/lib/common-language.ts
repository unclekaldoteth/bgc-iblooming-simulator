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
  alpha_behavior: "ALPHA Behavior",
  member_tier: "ALPHA Issued by Member Tier",
  milestone: "Scenario Phase Totals",
  source_system: "Source System"
};

const segmentKeyLabels: Record<string, string> = {
  bgc: "BGC",
  cashout: "Cash-Out",
  hold: "Held",
  iblooming: "iBLOOMING",
  spend: "Used"
};

const metricLabels: Record<string, string> = {
  alpha_cashout_equivalent_total: "Cash-Out Equivalent",
  alpha_issued_total: "ALPHA Issued",
  alpha_spent_total: "ALPHA Spent",
  alpha_total: "ALPHA Total",
  payout_inflow_ratio: "Payout / Inflow",
  reward_share_pct: "Issued Share",
  reserve_runway_months: "Reserve Runway",
  sink_utilization_rate: "Sink Utilization",
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

const dataSetStatusLabels: Record<string, string> = {
  APPROVED: "Approved",
  ARCHIVED: "Archived",
  DRAFT: "Draft",
  INVALID: "Needs Fixes",
  VALID: "Ready for Approval",
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
