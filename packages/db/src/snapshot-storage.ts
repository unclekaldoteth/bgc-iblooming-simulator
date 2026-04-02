import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const LOCAL_SNAPSHOT_UPLOAD_PREFIX = path.join("storage", "uploads", "snapshots");
const S3_SNAPSHOT_UPLOAD_PREFIX = "uploads/snapshots";
const REQUIRED_S3_ENV_KEYS = [
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY"
] as const;

type S3EnvKey = (typeof REQUIRED_S3_ENV_KEYS)[number];

type SnapshotS3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type SnapshotUploadSource = {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export const maxSnapshotUploadBytes = 10 * 1024 * 1024;

const globalForSnapshotStorage = globalThis as typeof globalThis & {
  snapshotS3Client?: S3Client;
  snapshotS3ClientKey?: string;
};

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string";
}

function resolveWorkspaceRoot() {
  const cwd = process.cwd();

  if (existsSync(path.join(cwd, "pnpm-workspace.yaml"))) {
    return cwd;
  }

  const repoCandidate = path.resolve(cwd, "..", "..");

  if (existsSync(path.join(repoCandidate, "pnpm-workspace.yaml"))) {
    return repoCandidate;
  }

  return cwd;
}

function sanitizeFilename(filename: string) {
  return (
    filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "snapshot.csv"
  );
}

function getMissingS3EnvKeys(envValues: Record<S3EnvKey, string | null>) {
  return REQUIRED_S3_ENV_KEYS.filter((envKey) => !envValues[envKey]);
}

function resolveSnapshotS3Config() {
  const envValues = {
    S3_BUCKET: normalizeEnvValue(process.env.S3_BUCKET),
    S3_REGION: normalizeEnvValue(process.env.S3_REGION),
    S3_ACCESS_KEY_ID: normalizeEnvValue(process.env.S3_ACCESS_KEY_ID),
    S3_SECRET_ACCESS_KEY: normalizeEnvValue(process.env.S3_SECRET_ACCESS_KEY)
  } satisfies Record<S3EnvKey, string | null>;

  const configuredValueCount = Object.values(envValues).filter(Boolean).length;

  if (configuredValueCount === 0) {
    return null;
  }

  const missingEnvKeys = getMissingS3EnvKeys(envValues);

  if (missingEnvKeys.length > 0) {
    throw new Error(
      `Snapshot storage is missing required S3 variables: ${missingEnvKeys.join(", ")}.`
    );
  }

  return {
    bucket: envValues.S3_BUCKET!,
    region: envValues.S3_REGION!,
    accessKeyId: envValues.S3_ACCESS_KEY_ID!,
    secretAccessKey: envValues.S3_SECRET_ACCESS_KEY!
  } satisfies SnapshotS3Config;
}

function getSnapshotS3Client(config: SnapshotS3Config) {
  const clientKey = [config.region, config.accessKeyId, config.bucket].join("::");

  if (
    !globalForSnapshotStorage.snapshotS3Client ||
    globalForSnapshotStorage.snapshotS3ClientKey !== clientKey
  ) {
    globalForSnapshotStorage.snapshotS3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    globalForSnapshotStorage.snapshotS3ClientKey = clientKey;
  }

  return globalForSnapshotStorage.snapshotS3Client;
}

function createSavedFilename(originalName: string) {
  return `${Date.now()}-${randomUUID()}-${sanitizeFilename(originalName)}`;
}

function buildSnapshotObjectKey(savedFilename: string) {
  return `${S3_SNAPSHOT_UPLOAD_PREFIX}/${savedFilename}`;
}

function buildS3Uri(bucket: string, key: string) {
  return `s3://${bucket}/${key}`;
}

function parseS3Uri(fileUri: string) {
  const parsed = new URL(fileUri);
  const bucket = parsed.hostname;
  const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (!bucket || !key) {
    throw new Error(`Snapshot file URI is not a valid S3 object path: ${fileUri}`);
  }

  return { bucket, key };
}

async function readBodyAsUtf8(body: unknown) {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToString" in body &&
    typeof body.transformToString === "function"
  ) {
    return body.transformToString("utf8");
  }

  return new Response(body as BodyInit).text();
}

export function getSnapshotUploadDirectory() {
  return path.join(resolveWorkspaceRoot(), LOCAL_SNAPSHOT_UPLOAD_PREFIX);
}

export async function saveUploadedSnapshotCsv(file: SnapshotUploadSource) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.");
  }

  if (file.size <= 0) {
    throw new Error("Upload a non-empty CSV file.");
  }

  if (file.size > maxSnapshotUploadBytes) {
    throw new Error("CSV upload exceeds the 10 MB limit.");
  }

  const savedFilename = createSavedFilename(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const s3Config = resolveSnapshotS3Config();

  if (s3Config) {
    const objectKey = buildSnapshotObjectKey(savedFilename);
    const client = getSnapshotS3Client(s3Config);

    await client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: objectKey,
        Body: bytes,
        ContentLength: file.size,
        ContentType: "text/csv",
        Metadata: {
          originalname: file.name
        }
      })
    );

    return {
      fileUri: buildS3Uri(s3Config.bucket, objectKey),
      savedFilename,
      size: file.size
    };
  }

  if (isVercelRuntime()) {
    throw new Error(
      "Snapshot uploads require S3 storage in Vercel. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY on both the web app and worker."
    );
  }

  const uploadDirectory = getSnapshotUploadDirectory();
  await mkdir(uploadDirectory, { recursive: true });

  const absolutePath = path.join(uploadDirectory, savedFilename);

  await writeFile(absolutePath, bytes);

  return {
    absolutePath,
    fileUri: pathToFileURL(absolutePath).href,
    savedFilename,
    size: file.size
  };
}

export async function readSnapshotCsvText(fileUri: string) {
  if (fileUri.startsWith("s3://")) {
    const s3Config = resolveSnapshotS3Config();

    if (!s3Config) {
      throw new Error(
        "Reading s3:// snapshot files requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY."
      );
    }

    const { bucket, key } = parseS3Uri(fileUri);
    const client = getSnapshotS3Client(s3Config);
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    return readBodyAsUtf8(response.Body);
  }

  if (fileUri.startsWith("file://")) {
    return readFile(fileURLToPath(fileUri), "utf8");
  }

  if (/^https?:\/\//i.test(fileUri)) {
    const response = await fetch(fileUri, { method: "GET", cache: "no-store" });

    if (!response.ok) {
      throw new Error(
        `Snapshot import could not download ${fileUri} (${response.status} ${response.statusText}).`
      );
    }

    return response.text();
  }

  if (/^[a-z]+:\/\//i.test(fileUri)) {
    throw new Error(`Snapshot import does not support the URI scheme for ${fileUri}.`);
  }

  const resolvedPath = path.isAbsolute(fileUri) ? fileUri : path.resolve(process.cwd(), fileUri);
  return readFile(resolvedPath, "utf8");
}
