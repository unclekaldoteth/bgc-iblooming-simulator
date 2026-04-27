import type { SnapshotValidationIssueInput } from "@bgc-alpha/db";

const MIN_RECOMMENDED_WINDOW_DAYS = 365;
const MAX_RECOMMENDED_WINDOW_DAYS = 1100;

type SnapshotForValidation = {
  name: string;
  dateFrom: Date;
  dateTo: Date;
  recordCount: number | null;
  importedFactCount: number;
  fileUri: string;
  sourceSystems: string[];
  sourceType?: string | null;
  validatedVia?: string | null;
  latestImportRowCountRaw?: number | null;
  latestImportRowCountImported?: number | null;
};

export function validateSnapshot(snapshot: SnapshotForValidation) {
  const issues: SnapshotValidationIssueInput[] = [];
  const coverageDays = Math.ceil(
    (snapshot.dateTo.getTime() - snapshot.dateFrom.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (snapshot.dateTo < snapshot.dateFrom) {
    issues.push({
      severity: "ERROR",
      issueType: "date_range_invalid",
      message: "Snapshot end date must be on or after the start date."
    });
  }

  if (snapshot.importedFactCount <= 0) {
    issues.push({
      severity: "ERROR",
      issueType: "import_not_completed",
      message: "Import rows into the snapshot before the data check can pass."
    });
  }

  const isHybridValidatedSnapshot =
    snapshot.sourceType === "hybrid_verified" || snapshot.validatedVia === "hybrid_validation";
  const latestImportedRows =
    snapshot.latestImportRowCountImported ??
    snapshot.latestImportRowCountRaw ??
    null;
  const expectedImportedRows =
    latestImportedRows ?? (isHybridValidatedSnapshot ? null : snapshot.recordCount);

  if (
    expectedImportedRows !== null &&
    expectedImportedRows > 0 &&
    snapshot.importedFactCount > 0 &&
    expectedImportedRows !== snapshot.importedFactCount
  ) {
    issues.push({
      severity: "ERROR",
      issueType: "record_count_mismatch",
      message: `Expected imported rows (${expectedImportedRows}) do not match saved monthly rows (${snapshot.importedFactCount}).`
    });
  }

  if (
    isHybridValidatedSnapshot &&
    snapshot.recordCount !== null &&
    snapshot.recordCount > 0 &&
    snapshot.importedFactCount > 0 &&
    snapshot.recordCount !== snapshot.importedFactCount
  ) {
    issues.push({
      severity: "WARNING",
      issueType: "source_record_count_differs_from_import_rows",
      message: `Source rows (${snapshot.recordCount}) differ from imported monthly rows (${snapshot.importedFactCount}); the hybrid check allows this when the latest import count matches.`
    });
  }

  if (snapshot.sourceSystems.length === 0) {
    issues.push({
      severity: "ERROR",
      issueType: "source_system_missing",
      message: "At least one source system must be attached to the snapshot."
    });
  }

  if (new Set(snapshot.sourceSystems).size !== snapshot.sourceSystems.length) {
    issues.push({
      severity: "ERROR",
      issueType: "duplicate_source_system",
      message: "Duplicate source system keys were provided and should be cleaned before approval."
    });
  }

  if (!/^(s3|https?|file):/i.test(snapshot.fileUri)) {
    issues.push({
      severity: "ERROR",
      issueType: "file_uri_scheme",
      message: "Snapshot file URI should use an explicit storage scheme such as https:// or file://."
    });
  }

  if (coverageDays < MIN_RECOMMENDED_WINDOW_DAYS) {
    issues.push({
      severity: "ERROR",
      issueType: "coverage_window_short",
      message: "Snapshot covers less than one year, so it may miss seasonal patterns."
    });
  }

  if (coverageDays > MAX_RECOMMENDED_WINDOW_DAYS) {
    issues.push({
      severity: "WARNING",
      issueType: "coverage_window_large",
      message: "Snapshot covers a very long time window and may mix different business phases."
    });
  }

  return issues;
}
