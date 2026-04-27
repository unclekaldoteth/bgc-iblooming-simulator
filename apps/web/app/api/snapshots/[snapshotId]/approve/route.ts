import { NextResponse } from "next/server";

import { approveSnapshot, getSnapshotById, writeAuditEvent } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.approve"]);

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

  if (!snapshot.dataFingerprint) {
    return NextResponse.json(
      {
        error: "snapshot_missing_data_fingerprint"
      },
      {
        status: 409
      }
    );
  }

  if (!["VALID", "APPROVED"].includes(snapshot.validationStatus)) {
    return NextResponse.json(
      {
        error: "snapshot_not_approvable"
      },
      {
        status: 400
      }
    );
  }

  const approvedSnapshot = await approveSnapshot(snapshotId, authResult.user.id);

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshotId,
    action: "snapshot.approved",
    metadata: {
      validationStatus: approvedSnapshot.validationStatus
    }
  });

  return NextResponse.json({
    snapshot: approvedSnapshot
  });
}
