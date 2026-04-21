import { readFile } from "node:fs/promises";
import path from "node:path";

import { snapshotImportCsvRowSchema } from "@bgc-alpha/schemas";

const DEFAULT_INPUT_PATH = "examples/bgc-source-bundle-canonical.csv";
const EXPECTED_SOURCE_FILES = [
  "2024 Global Profit Sharing from Turnover - Sheet1.csv",
  "2025 1st Half Global Profit Sharing from Turnover - Sheet1.csv",
  "BGC New & Upgrade Affiliates - Upgrade.csv",
  "Copy of BGC New & Upgrade Affiliates - Newly Joined.csv",
  "CP Videos Sold - Sheet1.csv",
  "WEP - World Executive Program Application Form (Responses) - Form Responses 1.csv",
  "iMatrix Records - Sheet1.csv",
  "Copy of SIMULATION SHEETS v0.1 - PARAMS.csv",
  "Copy of SIMULATION SHEETS v0.1 - DATA_AGG.csv"
] as const;
const EXPECTED_SOURCE_CATEGORIES = [
  "global_profit_2024_summary",
  "global_profit_2025_first_half_distribution",
  "affiliate_upgrade",
  "affiliate_newly_joined",
  "cp_video_sale",
  "wep_application",
  "imatrix_product_aggregate",
  "params_monthly_topup",
  "data_agg_monthly_override"
] as const;

function parseArgs(argv: string[]) {
  const [inputArg] = argv;

  return {
    inputPath: path.isAbsolute(inputArg ?? "")
      ? (inputArg as string)
      : path.resolve(process.cwd(), inputArg ?? DEFAULT_INPUT_PATH)
  };
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  const source = text.replace(/^\uFEFF/, "");
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      currentCell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      currentCell = "";
      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) => row.some((value) => value.trim().length > 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function almostEqual(left: number, right: number, epsilon = 0.01) {
  return Math.abs(left - right) <= epsilon;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = await readFile(args.inputPath, "utf8");
  const rows = parseCsvRows(text);
  const header = rows[0] ?? [];
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(header.map((column, index) => [column.trim(), row[index] ?? ""]))
  );
  const sourceFilesFound = new Set<string>();
  const sourceCategoriesFound = new Set<string>();
  const pcSpendMappingFailures: string[] = [];
  const dataAggPeriodTotals = new Map<
    string,
    {
      pcVolume: number;
      cashoutUsd: number;
      rowCount: number;
    }
  >();

  for (const record of records) {
    const parsed = snapshotImportCsvRowSchema.parse(record);

    if (!parsed.extra_json.trim()) {
      continue;
    }

    const extraJson = JSON.parse(parsed.extra_json) as unknown;

    if (!isRecord(extraJson)) {
      throw new Error("extra_json must parse to an object for every populated row.");
    }

    const sourceFiles = Array.isArray(extraJson.source_files) ? extraJson.source_files : [];
    const sourceCategories = Array.isArray(extraJson.source_categories)
      ? extraJson.source_categories
      : [];

    for (const sourceFile of sourceFiles) {
      if (typeof sourceFile === "string") {
        sourceFilesFound.add(sourceFile);
      }
    }

    for (const sourceCategory of sourceCategories) {
      if (typeof sourceCategory === "string") {
        sourceCategoriesFound.add(sourceCategory);
      }
    }

    if (sourceCategories.includes("data_agg_monthly_override")) {
      const periodTotals = dataAggPeriodTotals.get(parsed.period_key) ?? {
        pcVolume: 0,
        cashoutUsd: 0,
        rowCount: 0
      };
      periodTotals.pcVolume += readNumber(parsed.pc_volume) ?? 0;
      periodTotals.cashoutUsd += readNumber(parsed.cashout_usd) ?? 0;
      periodTotals.rowCount += 1;
      dataAggPeriodTotals.set(parsed.period_key, periodTotals);
    }

    const sinkSpendUsd = readNumber(parsed.sink_spend_usd) ?? 0;
    const requiresPcSpendBreakdown =
      sinkSpendUsd > 0 &&
      sourceCategories.some(
        (sourceCategory) =>
          sourceCategory === "cp_video_sale" || sourceCategory === "imatrix_product_aggregate"
      );

    if (requiresPcSpendBreakdown) {
      const sinkBreakdown = isRecord(extraJson.sink_breakdown_usd) ? extraJson.sink_breakdown_usd : null;
      const pcSpendUsd = sinkBreakdown ? readNumber(sinkBreakdown.PC_SPEND) : null;

      if (pcSpendUsd === null || !almostEqual(pcSpendUsd, sinkSpendUsd)) {
        pcSpendMappingFailures.push(
          `${parsed.period_key}/${parsed.member_key}/${parsed.source_system}`
        );
      }
    }
  }

  const missingFiles = EXPECTED_SOURCE_FILES.filter((value) => !sourceFilesFound.has(value));
  const isAcceptedHybridArtifact = sourceCategoriesFound.has("accepted_hybrid_monthly_override");
  const missingCategories = EXPECTED_SOURCE_CATEGORIES.filter((value) => {
    if (value === "params_monthly_topup" && isAcceptedHybridArtifact) {
      return false;
    }

    return !sourceCategoriesFound.has(value);
  });
  const missingAcceptedHybridCategory =
    isAcceptedHybridArtifact || !args.inputPath.includes("hybrid-accepted")
      ? null
      : "accepted_hybrid_monthly_override";
  const dataAggCoverageFailures = [...dataAggPeriodTotals.entries()]
    .filter(([, totals]) => totals.cashoutUsd > 0 && totals.pcVolume <= 0)
    .map(([periodKey]) => periodKey);

  if (
    missingFiles.length > 0 ||
    missingCategories.length > 0 ||
    missingAcceptedHybridCategory !== null ||
    pcSpendMappingFailures.length > 0 ||
    dataAggCoverageFailures.length > 0
  ) {
    throw new Error(
      [
        missingFiles.length > 0 ? `Missing source files: ${missingFiles.join(", ")}` : null,
        missingCategories.length > 0
          ? `Missing source categories: ${missingCategories.join(", ")}`
          : null,
        missingAcceptedHybridCategory
          ? `Missing source categories: ${missingAcceptedHybridCategory}`
          : null,
        pcSpendMappingFailures.length > 0
          ? `Missing or mismatched sink_breakdown_usd.PC_SPEND on rows: ${pcSpendMappingFailures.slice(0, 10).join(", ")}${pcSpendMappingFailures.length > 10 ? " ..." : ""}`
          : null,
        dataAggCoverageFailures.length > 0
          ? `DATA_AGG override periods have cashout but zero pc_volume: ${dataAggCoverageFailures.join(", ")}`
          : null
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  console.log(`Verified ${records.length} canonical rows in ${args.inputPath}`);
  console.log(`Source files covered: ${EXPECTED_SOURCE_FILES.length}`);
  console.log(`Source categories covered: ${EXPECTED_SOURCE_CATEGORIES.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
