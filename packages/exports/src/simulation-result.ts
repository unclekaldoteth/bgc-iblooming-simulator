import { renderSimulationResultStyledPdf } from "./pdf/render-simulation-result-pdf";

export type SimulationResultExportMetric = {
  key: string;
  label: string;
  value: string;
  description?: string;
};

export type SimulationResultExportFlag = {
  severity: string;
  type: string;
  period: string;
  message: string;
};

export type SimulationResultExportDistributionGroup = {
  title: string;
  rows: Array<{
    segment: string;
    measure: string;
    value: string;
  }>;
};

export type SimulationResultExportObjective = {
  title: string;
  status: string;
  evidence: string;
  score: string;
  primaryMetrics: string[];
  reasons: string[];
};

export type SimulationResultExportMilestone = {
  title: string;
  period: string;
  status: string;
  pressure: string;
  runway: string;
  topShare: string;
  netDelta?: string;
  reasons: string[];
};

export type SimulationResultExportDecisionPack = {
  title: string;
  verdict: string;
  recommendation: string;
  preferredSettings: string[];
  rejectedSettings: string[];
  unresolvedQuestions: string[];
  strategicObjectives: SimulationResultExportObjective[];
  milestoneCheckpoints: SimulationResultExportMilestone[];
};

export type SimulationResultExport = {
  title: string;
  ref: string;
  scenarioName: string;
  snapshotName: string;
  modelVersionName: string;
  status: string;
  createdAt: string;
  completedAt: string;
  summary: SimulationResultExportMetric[];
  treasury: SimulationResultExportMetric[];
  flags: SimulationResultExportFlag[];
  distribution: SimulationResultExportDistributionGroup[];
  decisionPack: SimulationResultExportDecisionPack;
};

function renderMetricTableMarkdown(metrics: SimulationResultExportMetric[]) {
  if (metrics.length === 0) {
    return "No metrics available.";
  }

  return [
    "| Metric | Value | Description |",
    "| --- | --- | --- |",
    ...metrics.map((metric) => `| ${metric.label} | ${metric.value} | ${metric.description ?? ""} |`)
  ].join("\n");
}

function renderList(items: string[], emptyMessage: string) {
  if (items.length === 0) {
    return emptyMessage;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function escapeCsvCell(value: string) {
  if (/["\n,]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

function renderCsvRow(cells: string[]) {
  return cells.map(escapeCsvCell).join(",");
}

export function renderSimulationResultMarkdown(report: SimulationResultExport) {
  return `# ${report.title}

## Context

- Ref: ${report.ref}
- Scenario: ${report.scenarioName}
- Snapshot: ${report.snapshotName}
- Model: ${report.modelVersionName}
- Status: ${report.status}
- Created: ${report.createdAt}
- Completed: ${report.completedAt}

## Summary

${renderMetricTableMarkdown(report.summary)}

## Treasury

${renderMetricTableMarkdown(report.treasury)}

## Risk Flags

${
  report.flags.length === 0
    ? "No risk flags."
    : [
        "| Severity | Type | Period | Message |",
        "| --- | --- | --- | --- |",
        ...report.flags.map(
          (flag) => `| ${flag.severity} | ${flag.type} | ${flag.period || "All periods"} | ${flag.message} |`
        )
      ].join("\n")
}

## Distribution

${
  report.distribution.length === 0
    ? "No distribution rows."
    : report.distribution
        .map(
          (group) => `### ${group.title}

| Segment | Measure | Value |
| --- | --- | --- |
${group.rows.map((row) => `| ${row.segment} | ${row.measure} | ${row.value} |`).join("\n")}`
        )
        .join("\n\n")
}

## Decision Pack

### Policy Verdict

- Verdict: ${report.decisionPack.verdict}
- Recommendation: ${report.decisionPack.recommendation}

### Evaluated Scenario Basis

${renderList(report.decisionPack.preferredSettings, "None.")}

### Blockers / Rejection Reasons

${renderList(report.decisionPack.rejectedSettings, "None.")}

### Strategic Goals

${
  report.decisionPack.strategicObjectives.length === 0
    ? "No strategic goals."
    : report.decisionPack.strategicObjectives
        .map(
          (objective) => `#### ${objective.title}

- Status: ${objective.status}
- Evidence: ${objective.evidence}
- Score: ${objective.score}
- Primary metrics:
${objective.primaryMetrics.map((item) => `  - ${item}`).join("\n") || "  - None"}
- Reasons:
${objective.reasons.map((item) => `  - ${item}`).join("\n") || "  - None"}`
        )
        .join("\n\n")
}

### Milestone Checkpoints

${
  report.decisionPack.milestoneCheckpoints.length === 0
    ? "No milestone checkpoints."
    : report.decisionPack.milestoneCheckpoints
        .map(
          (milestone) => `#### ${milestone.title}

- Period: ${milestone.period}
- Status: ${milestone.status}
- Pressure: ${milestone.pressure}
- Runway: ${milestone.runway}
- Top 10% Share: ${milestone.topShare}
- Net Treasury Delta: ${milestone.netDelta ?? "n/a"}
- Reasons:
${milestone.reasons.map((item) => `  - ${item}`).join("\n") || "  - None"}`
        )
        .join("\n\n")
}

### Unresolved Questions

${renderList(report.decisionPack.unresolvedQuestions, "None.")}
`;
}

export function renderSimulationResultCsv(report: SimulationResultExport) {
  const rows = [
    renderCsvRow([
      "section",
      "group",
      "item_key",
      "item_label",
      "status",
      "severity",
      "period",
      "segment",
      "measure",
      "value",
      "description",
      "message"
    ])
  ];

  rows.push(
    renderCsvRow([
      "metadata",
      "",
      "ref",
      "Ref",
      report.status,
      "",
      "",
      "",
      "",
      report.ref,
      "",
      ""
    ])
  );
  rows.push(renderCsvRow(["metadata", "", "scenario", "Scenario", "", "", "", "", "", report.scenarioName, "", ""]));
  rows.push(renderCsvRow(["metadata", "", "snapshot", "Snapshot", "", "", "", "", "", report.snapshotName, "", ""]));
  rows.push(renderCsvRow(["metadata", "", "model", "Model", "", "", "", "", "", report.modelVersionName, "", ""]));
  rows.push(renderCsvRow(["metadata", "", "created_at", "Created", "", "", "", "", "", report.createdAt, "", ""]));
  rows.push(renderCsvRow(["metadata", "", "completed_at", "Completed", "", "", "", "", "", report.completedAt, "", ""]));

  for (const metric of report.summary) {
    rows.push(
      renderCsvRow([
        "summary",
        "metric",
        metric.key,
        metric.label,
        "",
        "",
        "",
        "",
        metric.label,
        metric.value,
        metric.description ?? "",
        ""
      ])
    );
  }

  for (const metric of report.treasury) {
    rows.push(
      renderCsvRow([
        "treasury",
        "metric",
        metric.key,
        metric.label,
        "",
        "",
        "",
        "",
        metric.label,
        metric.value,
        metric.description ?? "",
        ""
      ])
    );
  }

  for (const flag of report.flags) {
    rows.push(
      renderCsvRow([
        "treasury",
        "flag",
        flag.type,
        flag.type,
        "",
        flag.severity,
        flag.period,
        "",
        "",
        "",
        "",
        flag.message
      ])
    );
  }

  for (const group of report.distribution) {
    for (const row of group.rows) {
      rows.push(
        renderCsvRow([
          "distribution",
          group.title,
          row.measure,
          group.title,
          "",
          "",
          "",
          row.segment,
          row.measure,
          row.value,
          "",
          ""
        ])
      );
    }
  }

  rows.push(
    renderCsvRow([
      "decision_pack",
      "verdict",
      "policy_verdict",
      "Policy Verdict",
      report.decisionPack.verdict,
      "",
      "",
      "",
      "",
      report.decisionPack.recommendation,
      "",
      ""
    ])
  );

  for (const item of report.decisionPack.preferredSettings) {
    rows.push(renderCsvRow(["decision_pack", "scenario_basis", item, "Evaluated Scenario Basis", "", "", "", "", "", item, "", ""]));
  }

  for (const item of report.decisionPack.rejectedSettings) {
    rows.push(renderCsvRow(["decision_pack", "blocker", item, "Blocker / Rejection Reason", "", "", "", "", "", item, "", ""]));
  }

  for (const objective of report.decisionPack.strategicObjectives) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "strategic_goal",
        objective.title,
        objective.title,
        objective.status,
        "",
        "",
        "",
        "",
        objective.score,
        objective.evidence,
        objective.reasons.join(" | ")
      ])
    );

    for (const metric of objective.primaryMetrics) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "strategic_goal_primary_metric",
          metric,
          "Primary Metric",
          objective.status,
          "",
          "",
          "",
          objective.title,
          metric,
          objective.evidence,
          ""
        ])
      );
    }
  }

  for (const milestone of report.decisionPack.milestoneCheckpoints) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "milestone",
        milestone.title,
        milestone.title,
        milestone.status,
        "",
        milestone.period,
        "",
        "",
        milestone.pressure,
        `Runway: ${milestone.runway}; Top 10% Share: ${milestone.topShare}; Net Treasury Delta: ${
          milestone.netDelta ?? "n/a"
        }`,
        milestone.reasons.join(" | ")
      ])
    );
  }

  for (const item of report.decisionPack.unresolvedQuestions) {
    rows.push(renderCsvRow(["decision_pack", "unresolved_question", item, "Unresolved Question", "", "", "", "", "", item, "", ""]));
  }

  return rows.join("\n");
}

export function renderSimulationResultPdf(report: SimulationResultExport) {
  return renderSimulationResultStyledPdf(report);
}
