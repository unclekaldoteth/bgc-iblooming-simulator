import type PgBoss from "pg-boss";

import {
  failSnapshotImportRun,
  getSnapshotImportRunById,
  markSnapshotImportRunning,
  replaceSnapshotFactsAndCompleteImport,
  writeAuditEvent,
  type SnapshotImportIssueInput,
  type SnapshotMemberMonthFactInput
} from "@bgc-alpha/db";
import { readSnapshotCsvText } from "@bgc-alpha/db/snapshot-storage";
import {
  snapshotImportCsvHeaders,
  snapshotImportCsvRowSchema,
  snapshotImportJobSchema,
  snapshotMemberMonthFactSchema
} from "@bgc-alpha/schemas";

import { parseCsvRecords } from "../lib/parse-csv";

function parseNumericField(value: string, fieldName: string, rowRef: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number (${rowRef}).`);
  }

  return parsed;
}

function parseOptionalNumericField(value: string, fieldName: string, rowRef: string) {
  if (value.trim().length === 0) {
    return null;
  }

  return parseNumericField(value, fieldName, rowRef);
}

function parseBooleanField(value: string, fieldName: string, rowRef: string) {
  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new Error(`${fieldName} must be one of true/false/1/0/yes/no (${rowRef}).`);
}

function parseOptionalBooleanField(value: string, fieldName: string, rowRef: string) {
  if (value.trim().length === 0) {
    return null;
  }

  return parseBooleanField(value, fieldName, rowRef);
}

function parseOptionalPeriodField(value: string, fieldName: string, rowRef: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    throw new Error(`${fieldName} must match YYYY-MM (${rowRef}).`);
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalJsonRecordField(value: string, fieldName: string, rowRef: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldName} must be valid JSON (${rowRef}).`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`${fieldName} must be a JSON object (${rowRef}).`);
  }

  return parsed;
}

export async function registerSnapshotImportJob(boss: PgBoss) {
  await boss.createQueue("snapshot.import");
  await boss.work("snapshot.import", async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    const payload = snapshotImportJobSchema.parse(job.data ?? {});
    const importRun = await getSnapshotImportRunById(payload.importRunId);

    if (!importRun) {
      return { ok: false, reason: `Import run ${payload.importRunId} was not found.` };
    }

    await markSnapshotImportRunning(importRun.id);

    let rowCountRaw = 0;

    try {
      const csvText = await readSnapshotCsvText(importRun.fileUri);
      const records = parseCsvRecords(csvText);
      rowCountRaw = records.length;

      if (records.length === 0) {
        throw new Error("CSV import file does not contain any data rows.");
      }

      const seenKeys = new Set<string>();
      const issues: SnapshotImportIssueInput[] = [];
      const facts: SnapshotMemberMonthFactInput[] = [];

      for (const [index, record] of records.entries()) {
        const rowRef = `row:${index + 2}`;

        for (const header of snapshotImportCsvHeaders) {
          if (!(header in record)) {
            issues.push({
              severity: "ERROR",
              issueType: "missing_required_column",
              message: `Required import column "${header}" is missing.`,
              rowRef
            });
          }
        }

        const rawRow = snapshotImportCsvRowSchema.safeParse(record);

        if (!rawRow.success) {
          issues.push({
            severity: "ERROR",
            issueType: "row_schema_invalid",
            message: rawRow.error.issues[0]?.message ?? "CSV row is invalid.",
            rowRef
          });
          continue;
        }

        try {
          const recognizedRevenueUsd = parseOptionalNumericField(
            rawRow.data.recognized_revenue_usd,
            "recognized_revenue_usd",
            rowRef
          );
          const grossMarginUsd = parseOptionalNumericField(
            rawRow.data.gross_margin_usd,
            "gross_margin_usd",
            rowRef
          );
          const memberJoinPeriod = parseOptionalPeriodField(
            rawRow.data.member_join_period,
            "member_join_period",
            rowRef
          );
          const isAffiliate = parseOptionalBooleanField(
            rawRow.data.is_affiliate,
            "is_affiliate",
            rowRef
          );
          const crossAppActive = parseOptionalBooleanField(
            rawRow.data.cross_app_active,
            "cross_app_active",
            rowRef
          );
          const extraJson = parseOptionalJsonRecordField(
            rawRow.data.extra_json,
            "extra_json",
            rowRef
          );
          const metadataJsonEntries = Object.entries({
            recognizedRevenueUsd,
            grossMarginUsd,
            memberJoinPeriod,
            isAffiliate,
            crossAppActive
          }).filter(([, value]) => value !== null);
          const derivedMetadata =
            metadataJsonEntries.length > 0 ? Object.fromEntries(metadataJsonEntries) : null;
          const metadataJson =
            extraJson || derivedMetadata
              ? {
                  ...(extraJson ?? {}),
                  ...(derivedMetadata ?? {})
                }
              : null;
          const parsedFact = snapshotMemberMonthFactSchema.parse({
            periodKey: rawRow.data.period_key.trim(),
            memberKey: rawRow.data.member_key.trim(),
            sourceSystem: rawRow.data.source_system.trim(),
            memberTier: rawRow.data.member_tier.trim() || null,
            groupKey: rawRow.data.group_key.trim() || null,
            pcVolume: parseNumericField(rawRow.data.pc_volume, "pc_volume", rowRef),
            spRewardBasis: parseNumericField(
              rawRow.data.sp_reward_basis,
              "sp_reward_basis",
              rowRef
            ),
            globalRewardUsd: parseNumericField(
              rawRow.data.global_reward_usd,
              "global_reward_usd",
              rowRef
            ),
            poolRewardUsd: parseNumericField(rawRow.data.pool_reward_usd, "pool_reward_usd", rowRef),
            cashoutUsd: parseNumericField(rawRow.data.cashout_usd, "cashout_usd", rowRef),
            sinkSpendUsd: parseNumericField(rawRow.data.sink_spend_usd, "sink_spend_usd", rowRef),
            activeMember: parseBooleanField(rawRow.data.active_member, "active_member", rowRef),
            metadataJson
          });
          const fact: SnapshotMemberMonthFactInput = {
            ...parsedFact,
            metadataJson: metadataJson as SnapshotMemberMonthFactInput["metadataJson"]
          };

          const uniqueKey = [
            fact.periodKey,
            fact.memberKey,
            fact.sourceSystem
          ].join("::");

          if (seenKeys.has(uniqueKey)) {
            issues.push({
              severity: "ERROR",
              issueType: "duplicate_member_month_fact",
              message: "Duplicate period/member/source row detected within the CSV import.",
              rowRef
            });
            continue;
          }

          seenKeys.add(uniqueKey);
          facts.push(fact);
        } catch (error) {
          issues.push({
            severity: "ERROR",
            issueType: "row_value_invalid",
            message: error instanceof Error ? error.message : "CSV row contains invalid values.",
            rowRef
          });
        }
      }

      if (issues.length > 0) {
        const failedRun = await failSnapshotImportRun(importRun.id, {
          message: "Snapshot import failed due to CSV issues.",
          rowCountRaw,
          rowCountImported: facts.length,
          issues
        });

        await writeAuditEvent({
          actorUserId: importRun.requestedByUserId,
          entityType: "dataset_snapshot",
          entityId: importRun.snapshotId,
          action: "snapshot.import_failed",
          metadata: {
            importRunId: failedRun.id,
            issueCount: issues.length
          }
        });

        return { ok: false, reason: "Snapshot import failed due to CSV issues." };
      }

      const completedRun = await replaceSnapshotFactsAndCompleteImport(importRun.id, importRun.snapshotId, facts, {
        rowCountRaw,
        rowCountImported: facts.length,
        notes: `Imported ${facts.length} canonical member-month facts.`
      });

      await writeAuditEvent({
        actorUserId: importRun.requestedByUserId,
        entityType: "dataset_snapshot",
        entityId: importRun.snapshotId,
        action: "snapshot.import_completed",
        metadata: {
          importRunId: completedRun.id,
          rowCountImported: completedRun.rowCountImported
        }
      });

      console.log("[worker] import snapshot", {
        snapshotId: importRun.snapshotId,
        importRunId: completedRun.id,
        rowCountImported: completedRun.rowCountImported
      });

      return {
        ok: true,
        importRunId: completedRun.id,
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
        reason: failedRun.notes ?? "Snapshot import failed."
      };
    }
  });
}
