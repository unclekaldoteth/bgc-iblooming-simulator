import { renderCompareReportStyledPdf } from "./pdf/render-compare-report-pdf";

export type CompareReportTone = "accent" | "warning" | "danger" | "info" | "neutral";

export type CompareReportExportRun = {
  id: string;
  ref: string;
  label: string;
  color: string;
  scenarioName: string;
  snapshotName: string;
  status: string;
  statusTone: CompareReportTone;
  verdict: string;
  verdictTone: CompareReportTone;
  completedAt: string;
};

export type CompareReportExportRadar = {
  dimensions: Array<{
    name: string;
    max: number;
  }>;
  series: Array<{
    name: string;
    color: string;
    values: number[];
  }>;
};

export type CompareReportExportCell = {
  primary: string;
  secondary?: string;
  tone?: CompareReportTone;
  emphasis?: "best" | "worst" | "default";
  muted?: boolean;
};

export type CompareReportExportTable = {
  title: string;
  subtitle?: string;
  rowLabel: string;
  rows: Array<{
    label: string;
    cells: CompareReportExportCell[];
  }>;
};

export type CompareReportExport = {
  title: string;
  subtitle: string;
  generatedAt: string;
  runs: CompareReportExportRun[];
  radar: CompareReportExportRadar;
  comparisonTables: CompareReportExportTable[];
};

export function renderCompareReportPdf(report: CompareReportExport) {
  return renderCompareReportStyledPdf(report);
}
