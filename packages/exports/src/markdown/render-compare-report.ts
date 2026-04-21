import type { CompareReportExport } from "../compare-report";

function escapeMarkdownCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function renderCellText(primary: string, secondary?: string) {
  return secondary ? `${primary} — ${secondary}` : primary;
}

function renderTable(report: CompareReportExport, table: CompareReportExport["comparisonTables"][number]) {
  const columnLabels = table.columns?.map((column) => column.label) ?? report.runs.map((run) => run.label);
  const rows = [
    `| ${[table.rowLabel, ...columnLabels].join(" | ")} |`,
    `| ${[table.rowLabel, ...columnLabels].map(() => "---").join(" | ")} |`,
    ...table.rows.map((row) => {
      const cells = row.cells.map((cell) => escapeMarkdownCell(renderCellText(cell.primary, cell.secondary)));
      return `| ${[escapeMarkdownCell(row.label), ...cells].join(" | ")} |`;
    })
  ];

  return `## ${table.title}

${table.subtitle ?? ""}

${rows.join("\n")}`;
}

export function renderCompareReportMarkdown(report: CompareReportExport) {
  return `# ${report.title}

${report.subtitle}

- Generated: ${report.generatedAt}

## Selected Runs

${report.runs
  .map(
    (run) =>
      `- ${run.label} (${run.ref}) · Scenario: ${run.scenarioName} · Snapshot: ${run.snapshotName} · Verdict: ${run.verdict} · Status: ${run.status}`
  )
  .join("\n")}

${report.comparisonTables.map((table) => renderTable(report, table)).join("\n\n")}
`;
}
