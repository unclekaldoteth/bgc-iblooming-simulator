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

export type SimulationResultExportHistoricalTruthCoverage = {
  status: string;
  summary: string;
  rows: Array<{
    label: string;
    status: string;
    detail: string;
  }>;
};

export type SimulationResultExportSetupItem = {
  label: string;
  value: string;
  status: string;
  rationale: string;
};

export type SimulationResultExportDecisionLogEntry = {
  title: string;
  status: string;
  owner: string;
  rationale: string;
  governanceStatus?: string | null;
  resolutionNote?: string | null;
  reviewedAt?: string | null;
};

export type SimulationResultExportTruthAssumptionItem = {
  label: string;
  classification: string;
  value: string;
  note: string;
};

export type SimulationResultExportCanonicalGapAudit = {
  readiness: string;
  summary: string;
  rows: Array<{
    label: string;
    status: string;
    detail: string;
  }>;
};

export type SimulationResultExportTokenFlowEvidence = {
  readiness: string;
  summary: string;
  rows: Array<{
    label: string;
    status: string;
    value: string;
    detail: string;
  }>;
  caveats: string[];
};

export type SimulationResultExportDecisionPack = {
  title: string;
  verdict: string;
  recommendation: string;
  preferredSettings: string[];
  rejectedSettings: string[];
  unresolvedQuestions: string[];
  historicalTruthCoverage: SimulationResultExportHistoricalTruthCoverage | null;
  canonicalGapAudit: SimulationResultExportCanonicalGapAudit | null;
  tokenFlowEvidence: SimulationResultExportTokenFlowEvidence | null;
  recommendedSetup: {
    title: string;
    summary: string;
    items: SimulationResultExportSetupItem[];
    warnings: string[];
  } | null;
  adoptedBaselineSummary: string | null;
  decisionLog: SimulationResultExportDecisionLogEntry[];
  truthAssumptionMatrix: SimulationResultExportTruthAssumptionItem[];
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

## Warnings

${
  report.flags.length === 0
    ? "No warnings."
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

### Decision Summary

- Decision: ${report.decisionPack.verdict}
- Recommendation: ${report.decisionPack.recommendation}

### Settings Used

${renderList(report.decisionPack.preferredSettings, "None.")}

### Blockers

${renderList(report.decisionPack.rejectedSettings, "None.")}

### Data Completeness

${
  !report.decisionPack.historicalTruthCoverage
    ? "No imported data coverage summary yet."
    : `- Coverage: ${report.decisionPack.historicalTruthCoverage.status}
- Summary: ${report.decisionPack.historicalTruthCoverage.summary}

| Data Area | Status | Detail |
| --- | --- | --- |
${report.decisionPack.historicalTruthCoverage.rows.map((row) => `| ${row.label} | ${row.status} | ${row.detail} |`).join("\n")}`
}

### Source Detail Check

${
  !report.decisionPack.canonicalGapAudit
    ? "No source detail check."
    : `- Readiness: ${report.decisionPack.canonicalGapAudit.readiness}
- Summary: ${report.decisionPack.canonicalGapAudit.summary}

| Source Area | Status | Detail |
| --- | --- | --- |
${report.decisionPack.canonicalGapAudit.rows.map((row) => `| ${row.label} | ${row.status} | ${row.detail} |`).join("\n")}`
}

### ALPHA Evidence

${
  !report.decisionPack.tokenFlowEvidence
    ? "No ALPHA evidence summary."
    : `- Readiness: ${report.decisionPack.tokenFlowEvidence.readiness}
- Summary: ${report.decisionPack.tokenFlowEvidence.summary}

| Evidence Area | Status | Value | Detail |
| --- | --- | --- | --- |
${report.decisionPack.tokenFlowEvidence.rows.map((row) => `| ${row.label} | ${row.status} | ${row.value} | ${row.detail} |`).join("\n")}

${renderList(report.decisionPack.tokenFlowEvidence.caveats, "No ALPHA evidence caveats.")}`
}

### Recommended Setup

${
  !report.decisionPack.recommendedSetup
    ? "No structured recommended setup."
    : `${report.decisionPack.adoptedBaselineSummary ? `- Current baseline: ${report.decisionPack.adoptedBaselineSummary}\n` : ""}- Title: ${report.decisionPack.recommendedSetup.title}
- Summary: ${report.decisionPack.recommendedSetup.summary}

| Setup Item | Value | Status | Why |
| --- | --- | --- | --- |
${report.decisionPack.recommendedSetup.items.map((item) => `| ${item.label} | ${item.value} | ${item.status} | ${item.rationale} |`).join("\n")}

Warnings:
${renderList(report.decisionPack.recommendedSetup.warnings, "None.")}`
}

### Decision Log

${
  report.decisionPack.decisionLog.length === 0
    ? "No structured decision log."
    : [
        "| Decision Item | Suggested Status | Review Status | Owner | Reason / Decision Note |",
        "| --- | --- | --- | --- | --- |",
        ...report.decisionPack.decisionLog.map(
          (entry) => `| ${entry.title} | ${entry.status} | ${entry.governanceStatus ?? "Draft"} | ${entry.owner} | ${entry.resolutionNote ?? entry.rationale} |`
        )
      ].join("\n")
}

### Data vs Assumptions

${
  report.decisionPack.truthAssumptionMatrix.length === 0
    ? "No data vs assumptions matrix yet."
    : [
        "| Item | Status | Value | Note |",
        "| --- | --- | --- | --- |",
        ...report.decisionPack.truthAssumptionMatrix.map(
          (item) => `| ${item.label} | ${item.classification} | ${item.value} | ${item.note} |`
        )
      ].join("\n")
}

### Goal Details

${
  report.decisionPack.strategicObjectives.length === 0
    ? "No strategic goals."
    : report.decisionPack.strategicObjectives
        .map(
          (objective) => `#### ${objective.title}

- Status: ${objective.status}
- Data Support: ${objective.evidence}
- Score: ${objective.score}
- Main metrics:
${objective.primaryMetrics.map((item) => `  - ${item}`).join("\n") || "  - None"}
- Reasons:
${objective.reasons.map((item) => `  - ${item}`).join("\n") || "  - None"}`
        )
        .join("\n\n")
}

### Phase Checkpoints

${
  report.decisionPack.milestoneCheckpoints.length === 0
    ? "No phase checkpoints."
    : report.decisionPack.milestoneCheckpoints
        .map(
          (milestone) => `#### ${milestone.title}

- Period: ${milestone.period}
- Status: ${milestone.status}
- Pressure: ${milestone.pressure}
- Runway: ${milestone.runway}
- Top 10% Share: ${milestone.topShare}
- Net Cash Change: ${milestone.netDelta ?? "n/a"}
- Reasons:
${milestone.reasons.map((item) => `  - ${item}`).join("\n") || "  - None"}`
        )
        .join("\n\n")
}

### Open Questions

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
      "Decision Summary",
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
    rows.push(renderCsvRow(["decision_pack", "settings_used", item, "Settings Used", "", "", "", "", "", item, "", ""]));
  }

  for (const item of report.decisionPack.rejectedSettings) {
    rows.push(renderCsvRow(["decision_pack", "blocker", item, "Blocker", "", "", "", "", "", item, "", ""]));
  }

  if (report.decisionPack.historicalTruthCoverage) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "historical_truth_coverage",
        "overall",
        "Data Completeness",
        report.decisionPack.historicalTruthCoverage.status,
        "",
        "",
        "",
        "",
        report.decisionPack.historicalTruthCoverage.summary,
        "",
        ""
      ])
    );

    for (const row of report.decisionPack.historicalTruthCoverage.rows) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "historical_truth_coverage_row",
          row.label,
          row.label,
          row.status,
          "",
          "",
          "",
          "",
          row.detail,
          "",
          ""
        ])
      );
    }
  }

  if (report.decisionPack.canonicalGapAudit) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "source_detail_check",
        "overall",
        "Source Detail Check",
        report.decisionPack.canonicalGapAudit.readiness,
        "",
        "",
        "",
        "",
        report.decisionPack.canonicalGapAudit.summary,
        "",
        ""
      ])
    );

    for (const row of report.decisionPack.canonicalGapAudit.rows) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "source_detail_check_row",
          row.label,
          row.label,
          row.status,
          "",
          "",
          "",
          "",
          row.detail,
          "",
          ""
        ])
      );
    }
  }

  if (report.decisionPack.tokenFlowEvidence) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "token_flow_evidence",
        "overall",
        "ALPHA Evidence",
        report.decisionPack.tokenFlowEvidence.readiness,
        "",
        "",
        "",
        "",
        report.decisionPack.tokenFlowEvidence.summary,
        "",
        ""
      ])
    );

    for (const row of report.decisionPack.tokenFlowEvidence.rows) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "token_flow_evidence_row",
          row.label,
          row.label,
          row.status,
          "",
          "",
          "",
          "",
          row.value,
          row.detail,
          ""
        ])
      );
    }

    for (const caveat of report.decisionPack.tokenFlowEvidence.caveats) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "token_flow_caveat",
          caveat,
          "ALPHA Evidence Caveat",
          "",
          "",
          "",
          "",
          "",
          caveat,
          "",
          ""
        ])
      );
    }
  }

  if (report.decisionPack.recommendedSetup) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "recommended_setup",
        report.decisionPack.recommendedSetup.title,
        report.decisionPack.recommendedSetup.title,
        "",
        "",
        "",
        "",
        "",
        report.decisionPack.recommendedSetup.summary,
        "",
        ""
      ])
    );

    if (report.decisionPack.adoptedBaselineSummary) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "adopted_baseline",
          "current_baseline",
          "Current Pilot Baseline",
          "",
          "",
          "",
          "",
          "",
          report.decisionPack.adoptedBaselineSummary,
          "",
          ""
        ])
      );
    }

    for (const item of report.decisionPack.recommendedSetup.items) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "recommended_setup_item",
          item.label,
          item.label,
          item.status,
          "",
          "",
          "",
          "",
          item.value,
          item.rationale,
          ""
        ])
      );
    }

    for (const warning of report.decisionPack.recommendedSetup.warnings) {
      rows.push(
        renderCsvRow([
          "decision_pack",
          "recommended_setup_warning",
          warning,
          "Recommended Setup Warning",
          "",
          "Warning",
          "",
          "",
          "",
          warning,
          "",
          ""
        ])
      );
    }
  }

  for (const entry of report.decisionPack.decisionLog) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "decision_log",
        entry.title,
        entry.title,
        entry.status,
        "",
        "",
        "",
        entry.owner,
        entry.resolutionNote ?? entry.rationale,
        entry.governanceStatus ?? "",
        ""
      ])
    );
  }

  for (const item of report.decisionPack.truthAssumptionMatrix) {
    rows.push(
      renderCsvRow([
        "decision_pack",
        "truth_assumption_matrix",
        item.label,
        item.label,
        item.classification,
        "",
        "",
        "",
        "",
        item.value,
        item.note,
        ""
      ])
    );
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
        `Runway: ${milestone.runway}; Top 10% Share: ${milestone.topShare}; Net Cash Change: ${
          milestone.netDelta ?? "n/a"
        }`,
        milestone.reasons.join(" | ")
      ])
    );
  }

  for (const item of report.decisionPack.unresolvedQuestions) {
    rows.push(renderCsvRow(["decision_pack", "open_question", item, "Open Question", "", "", "", "", "", item, "", ""]));
  }

  return rows.join("\n");
}

export function renderSimulationResultPdf(report: SimulationResultExport) {
  return renderSimulationResultStyledPdf(report);
}
