export const maxSnapshotUploadBytes = 10 * 1024 * 1024;

export function isSnapshotCsvFilename(filename: string) {
  return filename.toLowerCase().endsWith(".csv");
}

export function isSnapshotJsonFilename(filename: string) {
  return filename.toLowerCase().endsWith(".json");
}

export function isSnapshotDataFilename(filename: string) {
  return isSnapshotCsvFilename(filename) || isSnapshotJsonFilename(filename);
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

export function createSnapshotUploadPathname(filename: string) {
  return `snapshots/${Date.now()}-${globalThis.crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

export function isSnapshotUploadPathname(pathname: string) {
  return pathname.startsWith("snapshots/") && isSnapshotDataFilename(pathname.split("/").pop() ?? "");
}
