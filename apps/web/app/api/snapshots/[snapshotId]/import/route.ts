import { NextResponse } from "next/server";

import {
  createSnapshotImportRun,
  getSnapshotById,
  processSnapshotImportRun,
  writeAuditEvent
} from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import { enqueueJob } from "@/lib/queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { snapshotId } = await params;
  const snapshot = await getSnapshotById(snapshotId);
  const shouldProcessInline = Boolean(process.env.VERCEL);

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

  if (snapshot.validationStatus === "APPROVED" && snapshot.dataFingerprint) {
    return NextResponse.json(
      {
        error: "snapshot_approved_immutable"
      },
      {
        status: 409
      }
    );
  }

  const latestImportRun = snapshot.importRuns[0];

  if (latestImportRun?.status === "RUNNING") {
    return NextResponse.json(
      {
        error: "snapshot_import_already_running"
      },
      {
        status: 409
      }
    );
  }

  if (shouldProcessInline) {
    const importRun =
      latestImportRun?.status === "QUEUED"
        ? latestImportRun
        : await createSnapshotImportRun({
            snapshotId: snapshot.id,
            fileUri: snapshot.fileUri,
            requestedByUserId: authResult.user.id
          });

    if (latestImportRun?.status !== "QUEUED") {
      await writeAuditEvent({
        actorUserId: authResult.user.id,
        entityType: "dataset_snapshot",
        entityId: snapshot.id,
        action: "snapshot.import_started_inline",
        metadata: {
          importRunId: importRun.id,
          fileUri: snapshot.fileUri
        }
      });
    }

    const result = await processSnapshotImportRun(importRun.id);

    return NextResponse.json(
      {
        importRun: result.importRun,
        ...(result.ok ? {} : { error: result.reason })
      },
      {
        status: result.ok ? 200 : 422
      }
    );
  }

  if (latestImportRun?.status === "QUEUED") {
    return NextResponse.json(
      {
        error: "snapshot_import_already_running"
      },
      {
        status: 409
      }
    );
  }

  const importRun = await createSnapshotImportRun({
    snapshotId: snapshot.id,
    fileUri: snapshot.fileUri,
    requestedByUserId: authResult.user.id
  });

  await enqueueJob("snapshot.import", {
    snapshotId: snapshot.id,
    importRunId: importRun.id
  });

  await writeAuditEvent({
    actorUserId: authResult.user.id,
    entityType: "dataset_snapshot",
    entityId: snapshot.id,
    action: "snapshot.import_queued",
    metadata: {
      importRunId: importRun.id,
      fileUri: snapshot.fileUri
    }
  });

  return NextResponse.json(
    {
      importRun
    },
    {
      status: 202
    }
  );
}
