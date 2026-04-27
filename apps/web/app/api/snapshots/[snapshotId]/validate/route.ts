import { NextResponse } from "next/server";

import {
  getSnapshotById,
  markSnapshotValidating,
  setSnapshotValidationResult,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { validateSnapshot } from "@/lib/snapshot-validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.validate"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { snapshotId } = await params;
  const snapshot = await getSnapshotById(snapshotId);

  if (!snapshot) {
    return NextResponse.json(
      {
        error: "snapshot_not_found"
      },
      {
        status: 404
      }
    );
  }

  if (snapshot.archivedAt) {
    return NextResponse.json(
      {
        error: "snapshot_archived"
      },
      {
        status: 409
      }
    );
  }

  const latestImportRun = snapshot.importRuns[0];

  if (latestImportRun && ["QUEUED", "RUNNING"].includes(latestImportRun.status)) {
    return NextResponse.json(
      {
        error: "snapshot_import_in_progress"
      },
      {
        status: 409
      }
    );
  }

  if (snapshot._count.memberMonthFacts === 0) {
    return NextResponse.json(
      {
        error: "snapshot_has_no_imported_rows"
      },
      {
        status: 400
      }
    );
  }

  await markSnapshotValidating(snapshotId);

  const issues = validateSnapshot({
    ...snapshot,
    importedFactCount: snapshot._count.memberMonthFacts,
    latestImportRowCountImported: latestImportRun?.rowCountImported ?? null,
    latestImportRowCountRaw: latestImportRun?.rowCountRaw ?? null,
    sourceType: snapshot.sourceType,
    sourceSystems: Array.isArray(snapshot.sourceSystems)
      ? snapshot.sourceSystems.map((value) => String(value))
      : [],
    validatedVia: snapshot.validatedVia
  });
  const validatedSnapshot = await setSnapshotValidationResult(snapshotId, issues);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshotId,
    action: "snapshot.validated",
    metadata: {
      validationStatus: validatedSnapshot.validationStatus,
      issueCount: issues.length
    }
  });

  return NextResponse.json({
    snapshot: validatedSnapshot,
    issues
  });
}
