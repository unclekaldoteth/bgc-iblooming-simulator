import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { writeAuditEvent } from "@bgc-alpha/db";
import {
  hasBlobReadWriteToken,
  saveUploadedSnapshotFile
} from "@bgc-alpha/db/snapshot-storage";

import { authorizeApiRequest } from "@/lib/auth-session";
import { jsonError } from "@/lib/http";
import {
  isSnapshotUploadPathname,
  maxSnapshotUploadBytes
} from "@/lib/snapshot-upload";

export const runtime = "nodejs";

type SnapshotUploadTokenPayload = {
  actorUserId?: string | null;
  originalName?: string | null;
  size?: number | null;
};

function parseSnapshotUploadTokenPayload(value: string | null | undefined): SnapshotUploadTokenPayload {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    return {
      actorUserId:
        typeof parsed.actorUserId === "string" && parsed.actorUserId.length > 0
          ? parsed.actorUserId
          : null,
      originalName:
        typeof parsed.originalName === "string" && parsed.originalName.length > 0
          ? parsed.originalName
          : null,
      size: typeof parsed.size === "number" && Number.isFinite(parsed.size) ? parsed.size : null
    };
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const authResult = await authorizeApiRequest(["snapshots.write"]);

      if ("response" in authResult) {
        return authResult.response;
      }

      const formData = await request.formData();
      const upload = formData.get("file");

      if (!(upload instanceof File)) {
        throw new Error("Snapshot file is required.");
      }

      const savedFile = await saveUploadedSnapshotFile(upload);

      await writeAuditEvent({
        actorUserId: authResult.user.id,
        entityType: "snapshot_upload",
        entityId: savedFile.savedFilename,
        action: "snapshot.uploaded",
        metadata: {
          originalName: upload.name,
          fileUri: savedFile.fileUri,
          size: savedFile.size
        }
      });

      return NextResponse.json({
        fileUri: savedFile.fileUri,
        fileName: upload.name,
        size: savedFile.size
      });
    }

    const body = (await request.json()) as HandleUploadBody;
    let actorUserId: string | null = null;

    if (body.type === "blob.generate-client-token") {
      const authResult = await authorizeApiRequest(["snapshots.write"]);

      if ("response" in authResult) {
        return authResult.response;
      }

      actorUserId = authResult.user.id;

      if (!isSnapshotUploadPathname(body.payload.pathname)) {
        throw new Error("Only snapshot data uploads inside the snapshots folder are allowed.");
      }
    }

    if (!hasBlobReadWriteToken()) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required for Vercel Blob client uploads.");
    }

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!actorUserId) {
          throw new Error("Snapshot upload authorization is required.");
        }

        if (!isSnapshotUploadPathname(pathname)) {
          throw new Error("Only snapshot data uploads inside the snapshots folder are allowed.");
        }

        const payload = parseSnapshotUploadTokenPayload(clientPayload);

        return {
          allowedContentTypes: [
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
            "application/json",
            "text/json"
          ],
          maximumSizeInBytes: maxSnapshotUploadBytes,
          tokenPayload: JSON.stringify({
            actorUserId,
            originalName: payload.originalName ?? pathname.split("/").pop() ?? pathname,
            size: payload.size ?? null
          } satisfies SnapshotUploadTokenPayload)
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parseSnapshotUploadTokenPayload(tokenPayload);

        await writeAuditEvent({
          actorUserId: payload.actorUserId ?? null,
          entityType: "snapshot_upload",
          entityId: blob.pathname,
          action: "snapshot.uploaded",
          metadata: {
            originalName: payload.originalName ?? blob.pathname,
            fileUri: blob.url,
            size: payload.size ?? null
          }
        });
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
