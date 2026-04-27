import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fixtureCsvPath() {
  const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(fixtureDir, "../../../../examples/sample-faithful-snapshot.csv");
}

function exampleCsvPath(fileName: string) {
  const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(fixtureDir, `../../../../examples/${fileName}`);
}

function loadFixtureLines() {
  return readFileSync(fixtureCsvPath(), "utf8").split("\n");
}

function replaceFirstMatchingLine(
  lines: string[],
  matcher: (line: string) => boolean,
  transform: (line: string) => string
) {
  const lineIndex = lines.findIndex(matcher);

  if (lineIndex === -1) {
    throw new Error("Fixture target line was not found.");
  }

  const nextLine = transform(lines[lineIndex]);

  if (nextLine === lines[lineIndex]) {
    throw new Error("Fixture transform did not change the target line.");
  }

  lines[lineIndex] = nextLine;
  return lines;
}

export function loadValidCompatibilityCsvFixture() {
  return readFileSync(fixtureCsvPath(), "utf8");
}

export function loadInvalidAllErrorTypesCsvFixture() {
  return readFileSync(exampleCsvPath("sample-invalid-snapshot-all-error-types.csv"), "utf8");
}

export function loadCanonicalSnapshotFixture() {
  return readFileSync(exampleCsvPath("sample-canonical-snapshot.json"), "utf8");
}

export function loadFullDetailCsvSnapshotFixture() {
  return readFileSync(exampleCsvPath("sample-source-detail-all-green.csv"), "utf8");
}

export function buildInvalidFormulaCsvFixture() {
  const lines = loadFixtureLines();

  return replaceFirstMatchingLine(
    lines,
    (line) => line.startsWith("2025-01,AFF-ALPHA,bgc,PATHFINDER,FOUNDERS,10000,70,146.047"),
    (line) =>
      line.replace(
        "2025-01,AFF-ALPHA,bgc,PATHFINDER,FOUNDERS,10000,70,146.047",
        "2025-01,AFF-ALPHA,bgc,PATHFINDER,FOUNDERS,9999,70,146.047"
      )
  ).join("\n");
}

export function buildInvalidHistoryCsvFixture() {
  const lines = loadFixtureLines();

  return replaceFirstMatchingLine(
    lines,
    (line) =>
      line.startsWith("2026-01,CP-DELTA,iblooming,CP,CP_CREATOR,0,0,0,0,0,100,true,30,,2025-01"),
    (line) =>
      line.replace(
        "2026-01,CP-DELTA,iblooming,CP,CP_CREATOR,0,0,0,0,0,100,true,30,,2025-01,false,false",
        "2026-01,CP-DELTA,iblooming,CP,CP_CREATOR,0,0,0,0,0,100,true,30,,2025-02,false,false"
      )
  ).join("\n");
}

export function buildInvalidPoolCsvFixture() {
  const lines = loadFixtureLines();

  return replaceFirstMatchingLine(
    lines,
    (line) => line.startsWith("2025-12,AFF-ALPHA,iblooming,,FOUNDERS,0,0,14.15,24.62"),
    (line) => line.replace('"funding_amount"":30.7', '"funding_amount"":20')
  ).join("\n");
}

export function buildInvalidLegacyKeyCsvFixture() {
  const lines = loadFixtureLines();

  return replaceFirstMatchingLine(
    lines,
    (line) =>
      line.startsWith("2025-01,CP-DELTA,iblooming,CP,CP_CREATOR,0,0,0,0,0,100,true,30"),
    (line) => line.replace("ib_platform_revenue_usd", "platform_revenue_usd")
  ).join("\n");
}

export function buildInvalidCanonicalGateCsvFixture() {
  const lines = loadFixtureLines();

  return replaceFirstMatchingLine(
    lines,
    (line) => line.startsWith("2025-01,AFF-ALPHA,bgc,PATHFINDER,FOUNDERS,10000,70,146.047"),
    (line) => line.replace('"validated_via"":""canonical_json""', '"validated_via"":""csv""')
  ).join("\n");
}
