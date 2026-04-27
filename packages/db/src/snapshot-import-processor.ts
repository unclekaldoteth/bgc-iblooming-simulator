import { writeAuditEvent } from "./audit";
import { replaceCanonicalSnapshotData } from "./canonical";
import {
  looksLikeCanonicalCsvSnapshot,
  parseCanonicalCsvSnapshotText
} from "./canonical-csv";
import { buildDerivedSnapshotDataFromCanonical } from "./canonical-derived";
import {
  countCanonicalSnapshotRows,
  parseCanonicalSnapshotText,
  toReplaceCanonicalSnapshotDataInput
} from "./canonical-payload";
import {
  parseCompatibilityCsvSnapshotText,
  validateCanonicalRuleGateBacking,
  validateCompatibilitySnapshotFacts
} from "./snapshot-import-compatibility";
import {
  failSnapshotImportRun,
  getSnapshotImportRunById,
  markSnapshotImportRunning,
  replaceSnapshotFactsAndCompleteImport
} from "./snapshots";
import { readSnapshotText } from "./snapshot-storage";

type ProcessSnapshotImportRunResult =
  | {
      ok: true;
      importRun: Awaited<ReturnType<typeof replaceSnapshotFactsAndCompleteImport>>;
      rowCountImported: number | null;
    }
  | {
      ok: false;
      importRun: Awaited<ReturnType<typeof failSnapshotImportRun>>;
      reason: string;
    };

function looksLikeJsonSnapshot(text: string, fileUri: string) {
  const trimmed = text.trimStart();

  return /\.json(?:$|[?#])/i.test(fileUri) || trimmed.startsWith("{") || trimmed.startsWith("[");
}

export async function processSnapshotImportRun(
  importRunId: string
): Promise<ProcessSnapshotImportRunResult> {
  const importRun = await getSnapshotImportRunById(importRunId);

  if (!importRun) {
    throw new Error(`Import run ${importRunId} was not found.`);
  }

  await markSnapshotImportRunning(importRun.id);

  let rowCountRaw = 0;

  try {
    const snapshotText = await readSnapshotText(importRun.fileUri);

    if (looksLikeJsonSnapshot(snapshotText, importRun.fileUri)) {
      const payload = parseCanonicalSnapshotText(snapshotText);
      const derivedData = buildDerivedSnapshotDataFromCanonical(payload, {
        snapshotDateFrom: importRun.snapshot.dateFrom,
        snapshotDateTo: importRun.snapshot.dateTo
      });

      rowCountRaw = countCanonicalSnapshotRows(payload);

      if (rowCountRaw === 0) {
        throw new Error("Canonical snapshot import file does not contain any canonical entities.");
      }

      const derivedValidation = validateCompatibilitySnapshotFacts(
        derivedData.memberMonthFacts,
        {
          mode: "understanding_doc_strict",
          poolPeriodFacts: derivedData.poolPeriodFacts,
          canonicalSnapshotId: payload.snapshot_id
        }
      );

      if (derivedValidation.issues.some((issue) => issue.severity === "ERROR")) {
        const failedRun = await failSnapshotImportRun(importRun.id, {
          message: "Canonical snapshot import failed due to derived fact issues.",
          rowCountRaw,
          rowCountImported: derivedData.memberMonthFacts.length,
          issues: derivedValidation.issues
        });

        await writeAuditEvent({
          actorUserId: importRun.requestedByUserId,
          entityType: "dataset_snapshot",
          entityId: importRun.snapshotId,
          action: "snapshot.import_failed",
          metadata: {
            importRunId: failedRun.id,
            issueCount: derivedValidation.issues.length
          }
        });

        return {
          ok: false,
          importRun: failedRun,
          reason: "Canonical snapshot import failed due to derived fact issues."
        };
      }

      await replaceCanonicalSnapshotData(
        toReplaceCanonicalSnapshotDataInput(importRun.snapshotId, importRun.id, payload)
      );

      const completedRun = await replaceSnapshotFactsAndCompleteImport(
        importRun.id,
        importRun.snapshotId,
        derivedData.memberMonthFacts,
        {
          rowCountRaw,
          rowCountImported: derivedData.memberMonthFacts.length,
          rewardSourcePeriodFacts: derivedData.rewardSourcePeriodFacts,
          poolPeriodFacts: derivedData.poolPeriodFacts,
          canonicalSourceSnapshotKey: payload.snapshot_id,
          notes: `Imported canonical snapshot payload with ${rowCountRaw} canonical entities and derived ${derivedData.memberMonthFacts.length} compatibility member-period facts in understanding_doc_strict mode.${
            derivedValidation.issues.length > 0 ? ` Import warnings: ${derivedValidation.issues.length}.` : ""
          }`,
          issues: derivedValidation.issues
        }
      );

      await writeAuditEvent({
        actorUserId: importRun.requestedByUserId,
        entityType: "dataset_snapshot",
        entityId: importRun.snapshotId,
        action: "snapshot.import_completed",
        metadata: {
          importRunId: completedRun.id,
          importFormat: "canonical_json",
          rowCountImported: completedRun.rowCountImported
        }
      });

      return {
        ok: true,
        importRun: completedRun,
        rowCountImported: completedRun.rowCountImported
      };
    }

    if (looksLikeCanonicalCsvSnapshot(snapshotText)) {
      const payload = parseCanonicalCsvSnapshotText(snapshotText);
      const derivedData = buildDerivedSnapshotDataFromCanonical(payload, {
        snapshotDateFrom: importRun.snapshot.dateFrom,
        snapshotDateTo: importRun.snapshot.dateTo
      });

      rowCountRaw = countCanonicalSnapshotRows(payload);

      if (rowCountRaw === 0) {
        throw new Error("Full detail CSV import file does not contain any source detail rows.");
      }

      const derivedValidation = validateCompatibilitySnapshotFacts(
        derivedData.memberMonthFacts,
        {
          mode: "understanding_doc_strict",
          poolPeriodFacts: derivedData.poolPeriodFacts,
          canonicalSnapshotId: payload.snapshot_id
        }
      );

      if (derivedValidation.issues.some((issue) => issue.severity === "ERROR")) {
        const failedRun = await failSnapshotImportRun(importRun.id, {
          message: "Full detail CSV import failed due to derived fact issues.",
          rowCountRaw,
          rowCountImported: derivedData.memberMonthFacts.length,
          issues: derivedValidation.issues
        });

        await writeAuditEvent({
          actorUserId: importRun.requestedByUserId,
          entityType: "dataset_snapshot",
          entityId: importRun.snapshotId,
          action: "snapshot.import_failed",
          metadata: {
            importRunId: failedRun.id,
            issueCount: derivedValidation.issues.length
          }
        });

        return {
          ok: false,
          importRun: failedRun,
          reason: "Full detail CSV import failed due to derived fact issues."
        };
      }

      await replaceCanonicalSnapshotData(
        toReplaceCanonicalSnapshotDataInput(importRun.snapshotId, importRun.id, payload)
      );

      const completedRun = await replaceSnapshotFactsAndCompleteImport(
        importRun.id,
        importRun.snapshotId,
        derivedData.memberMonthFacts,
        {
          rowCountRaw,
          rowCountImported: derivedData.memberMonthFacts.length,
          rewardSourcePeriodFacts: derivedData.rewardSourcePeriodFacts,
          poolPeriodFacts: derivedData.poolPeriodFacts,
          canonicalSourceSnapshotKey: payload.snapshot_id,
          sourceType: "canonical_csv",
          validatedVia: "canonical_events",
          notes: `Imported full detail CSV with ${rowCountRaw} source detail rows and derived ${derivedData.memberMonthFacts.length} monthly simulation rows in understanding_doc_strict mode.${
            derivedValidation.issues.length > 0 ? ` Import warnings: ${derivedValidation.issues.length}.` : ""
          }`,
          issues: derivedValidation.issues
        }
      );

      await writeAuditEvent({
        actorUserId: importRun.requestedByUserId,
        entityType: "dataset_snapshot",
        entityId: importRun.snapshotId,
        action: "snapshot.import_completed",
        metadata: {
          importRunId: completedRun.id,
          importFormat: "canonical_csv",
          rowCountImported: completedRun.rowCountImported
        }
      });

      return {
        ok: true,
        importRun: completedRun,
        rowCountImported: completedRun.rowCountImported
      };
    }

    const { rowCountRaw: parsedRowCountRaw, facts, issues } = parseCompatibilityCsvSnapshotText(
      snapshotText,
      {
        mode: "understanding_doc_strict"
      }
    );
    rowCountRaw = parsedRowCountRaw;
    const canonicalGateBackingIssues = validateCanonicalRuleGateBacking(facts, {
      canonicalEntityCount: 0,
      canonicalSourceSnapshotKey: null
    });
    const importIssues = [...issues, ...canonicalGateBackingIssues];

    if (importIssues.some((issue) => issue.severity === "ERROR")) {
      const failedRun = await failSnapshotImportRun(importRun.id, {
        message: "Snapshot import failed due to CSV issues.",
        rowCountRaw,
        rowCountImported: facts.length,
        issues: importIssues
      });

      await writeAuditEvent({
        actorUserId: importRun.requestedByUserId,
        entityType: "dataset_snapshot",
        entityId: importRun.snapshotId,
        action: "snapshot.import_failed",
        metadata: {
          importRunId: failedRun.id,
          issueCount: importIssues.length
        }
      });

      return {
        ok: false,
        importRun: failedRun,
        reason: "Snapshot import failed due to CSV issues."
      };
    }

    await replaceCanonicalSnapshotData({
      snapshotId: importRun.snapshotId,
      importRunId: importRun.id,
      members: [],
      memberAliases: [],
      roleHistory: [],
      offers: [],
      businessEvents: [],
      pcEntries: [],
      spEntries: [],
      rewardObligations: [],
      poolEntries: [],
      cashoutEvents: [],
      qualificationWindows: [],
      qualificationStatusHistory: []
    });

    const completedRun = await replaceSnapshotFactsAndCompleteImport(
      importRun.id,
      importRun.snapshotId,
      facts,
      {
        rowCountRaw,
        rowCountImported: facts.length,
        canonicalSourceSnapshotKey: null,
        notes: `Imported ${facts.length} compatibility member-month facts from CSV input in understanding_doc_strict mode.${
          importIssues.length > 0 ? ` Import warnings: ${importIssues.length}.` : ""
        }`,
        issues: importIssues
      }
    );

    await writeAuditEvent({
      actorUserId: importRun.requestedByUserId,
      entityType: "dataset_snapshot",
      entityId: importRun.snapshotId,
      action: "snapshot.import_completed",
      metadata: {
        importRunId: completedRun.id,
        importFormat: "legacy_member_month_csv",
        rowCountImported: completedRun.rowCountImported
      }
    });

    return {
      ok: true,
      importRun: completedRun,
      rowCountImported: completedRun.rowCountImported
    };
  } catch (error) {
    const failedRun = await failSnapshotImportRun(importRun.id, {
      message: error instanceof Error ? error.message : "snapshot_import_failed",
      rowCountRaw,
      rowCountImported: 0,
      issues: [
        {
          severity: "ERROR",
          issueType: "snapshot_import_failed",
          message: error instanceof Error ? error.message : "Snapshot import failed unexpectedly.",
          rowRef: null
        }
      ]
    });

    await writeAuditEvent({
      actorUserId: importRun.requestedByUserId,
      entityType: "dataset_snapshot",
      entityId: importRun.snapshotId,
      action: "snapshot.import_failed",
      metadata: {
        importRunId: failedRun.id,
        message: failedRun.notes
      }
    });

    return {
      ok: false,
      importRun: failedRun,
      reason: failedRun.notes ?? "Snapshot import failed."
    };
  }
}
