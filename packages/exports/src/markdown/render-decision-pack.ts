import type { DecisionPack } from "@bgc-alpha/schemas";

const metricValueFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const metricCurrencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency"
});

const policyStatusLabels: Record<string, string> = {
  candidate: "Ready",
  risky: "Needs Review",
  rejected: "Do Not Use"
};

const evidenceLevelLabels: Record<string, string> = {
  checklist: "Checklist Only",
  direct: "Direct Data",
  proxy: "Proxy Estimate"
};

const objectiveLabels: Record<string, string> = {
  active_user: "Active-User Growth",
  affiliate: "Affiliate Acquisition",
  ops_cost: "Operational Cost Reduction",
  revenue: "Revenue Growth",
  tax: "Tax Optimization"
};

function getPolicyStatusLabel(value: string) {
  return policyStatusLabels[value] ?? value;
}

function getEvidenceLevelLabel(value: string) {
  return evidenceLevelLabels[value] ?? value;
}

function getObjectiveLabel(value: string) {
  return objectiveLabels[value] ?? value;
}

function formatMetricValue(value: number, unit: string) {
  const formatted = metricValueFormatter.format(value);

  if (unit === "usd") return metricCurrencyFormatter.format(value);
  if (unit === "percent") return `${formatted}%`;
  if (unit === "ratio") return `${formatted}x`;
  if (unit === "months") return `${formatted} mo`;

  return formatted;
}

export function renderDecisionPackMarkdown(pack: DecisionPack) {
  return `# ${pack.title}

## Decision Status

${getPolicyStatusLabel(pack.policy_status)}

## Recommendation

${pack.recommendation}

## Settings Used

${pack.preferred_settings.map((item) => `- ${item}`).join("\n")}

## Blockers

${pack.rejected_settings.map((item) => `- ${item}`).join("\n")}

## Goal Details

${
  pack.strategic_objectives.length === 0
    ? "No goal details were generated for this result."
    : pack.strategic_objectives
        .map(
          (objective) => `### ${objective.label}

- Status: ${getPolicyStatusLabel(objective.status)}
- Score: ${objective.score}
- Data Support: ${getEvidenceLevelLabel(objective.evidence_level)}
- Main metrics:
${objective.primary_metrics
  .map((metric) => `  - ${metric.label}: ${formatMetricValue(metric.value, metric.unit)}`)
  .join("\n")}
- Reasons:
${objective.reasons.map((reason) => `  - ${reason}`).join("\n")}`
        )
        .join("\n\n")
}

## Phase Checks

${
  pack.milestone_evaluations.length === 0
    ? "No phase checks were generated for this result."
    : pack.milestone_evaluations
        .map(
          (milestone) => `### ${milestone.label}

- Period: ${milestone.start_period_key} to ${milestone.end_period_key}
- Status: ${getPolicyStatusLabel(milestone.policy_status)}
- Treasury pressure: ${milestone.summary_metrics.payout_inflow_ratio}
- Reserve runway (months): ${milestone.summary_metrics.reserve_runway_months}
- Reward concentration top 10%: ${milestone.summary_metrics.reward_concentration_top10_pct}
- Net cash change: ${metricCurrencyFormatter.format(milestone.summary_metrics.company_net_treasury_delta_total)}
- Strong goals: ${milestone.strong_objectives.map(getObjectiveLabel).join(", ") || "none"}
- Weak goals: ${milestone.weak_objectives.map(getObjectiveLabel).join(", ") || "none"}
- Reasons:
${milestone.reasons.map((reason) => `  - ${reason}`).join("\n")}`
        )
        .join("\n\n")
}

## Open Questions

${pack.unresolved_questions.map((item) => `- ${item}`).join("\n")}
`;
}
