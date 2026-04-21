import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { snapshotImportCsvRowSchema } from "@bgc-alpha/schemas";

const DEFAULT_INPUT_PATH = "examples/bgc-source-bundle-canonical.csv";
const DEFAULT_OUTPUT_DIR = "deliverables/working-basis-latest/snapshots";

const NUMERIC_FIELDS = [
  "pc_volume",
  "sp_reward_basis",
  "global_reward_usd",
  "pool_reward_usd",
  "cashout_usd",
  "sink_spend_usd",
  "recognized_revenue_usd",
  "gross_margin_usd"
] as const;

type NumericField = (typeof NUMERIC_FIELDS)[number];
type CsvRecord = Record<string, string>;
type MetadataRecord = Record<string, unknown>;

function parseArgs(argv: string[]) {
  const args = [...argv];
  let inputPath = DEFAULT_INPUT_PATH;
  let outputDir = DEFAULT_OUTPUT_DIR;
  let dateLabel = new Date().toISOString().slice(0, 10);

  while (args.length > 0) {
    const token = args.shift();

    if (token === "--input") {
      const value = args.shift();

      if (!value) {
        throw new Error("Pass a file path after --input.");
      }

      inputPath = value;
      continue;
    }

    if (token === "--output-dir") {
      const value = args.shift();

      if (!value) {
        throw new Error("Pass a directory path after --output-dir.");
      }

      outputDir = value;
      continue;
    }

    if (token === "--date-label") {
      const value = args.shift();

      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("Pass a YYYY-MM-DD value after --date-label.");
      }

      dateLabel = value;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    inputPath: path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath),
    outputDir: path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir),
    dateLabel
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

      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  if (currentRow.some((value) => value.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function formatCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readCategories(record: CsvRecord) {
  if (!record.extra_json.trim()) {
    return [] as string[];
  }

  const parsed = JSON.parse(record.extra_json) as unknown;

  if (!isRecord(parsed) || !Array.isArray(parsed.source_categories)) {
    return [] as string[];
  }

  return parsed.source_categories.filter((value): value is string => typeof value === "string");
}

function readMetadata(record: CsvRecord): MetadataRecord {
  if (!record.extra_json.trim()) {
    return {};
  }

  const parsed = JSON.parse(record.extra_json) as unknown;
  return isRecord(parsed) ? parsed : {};
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function uniqueStrings(values: Iterable<string>) {
  return [...new Set([...values].filter((value) => value.trim().length > 0))].sort();
}

function formatNumber(value: number) {
  return value.toFixed(2);
}

function buildCollapsedDataAggOverrideRecord(periodKey: string, periodRecords: CsvRecord[]) {
  const totals = buildTotals(periodRecords);
  const metadataList = periodRecords.map(readMetadata);
  const sourceFiles = uniqueStrings(
    metadataList.flatMap((metadata) => readStringArray(metadata.source_files))
  );
  const inputCategories = uniqueStrings(
    metadataList.flatMap((metadata) => readStringArray(metadata.source_categories))
  );
  const hybridOverrideFields = NUMERIC_FIELDS.filter((field) => totals[field] > 0.009);

  const metadata: MetadataRecord = {
    row_semantics: "hybrid_monthly_override_fact",
    source_categories: ["data_agg_monthly_override", "accepted_hybrid_monthly_override"],
    source_input_categories: inputCategories,
    source_files: sourceFiles,
    source_of_truth_reference: "understanding_doc_fixed",
    source_of_truth_note:
      "DATA_AGG monthly override accepted into founder-facing hybrid truth after reconciling against source-backed rows.",
    aggregate_scope: "monthly_cross_system_override",
    top_up_strategy: "collapsed_period_override_from_data_agg",
    data_agg_period_key: periodKey,
    canonical_translation_ready: false,
    hybrid_override_fields: hybridOverrideFields
  };

  if (totals.pc_volume > 0.009) {
    metadata.pc_breakdown = {
      DATA_AGG_MONTHLY_OVERRIDE: Number(totals.pc_volume.toFixed(2))
    };
  }

  if (totals.sp_reward_basis > 0.009) {
    metadata.sp_breakdown = {
      DATA_AGG_MONTHLY_OVERRIDE: Number(totals.sp_reward_basis.toFixed(2))
    };
  }

  if (totals.global_reward_usd > 0.009) {
    metadata.global_reward_breakdown_usd = {
      DATA_AGG_MONTHLY_OVERRIDE: Number(totals.global_reward_usd.toFixed(2))
    };
  }

  if (totals.pool_reward_usd > 0.009) {
    metadata.pool_reward_breakdown_usd = {
      DATA_AGG_MONTHLY_OVERRIDE: Number(totals.pool_reward_usd.toFixed(2))
    };
  }

  if (totals.cashout_usd > 0.009) {
    metadata.cashout_breakdown_usd = {
      DATA_AGG_MONTHLY_OVERRIDE: Number(totals.cashout_usd.toFixed(2))
    };
  }

  if (totals.sink_spend_usd > 0.009) {
    metadata.sink_breakdown_usd = {
      DATA_AGG_MONTHLY_OVERRIDE: Number(totals.sink_spend_usd.toFixed(2))
    };
  }

  if (totals.recognized_revenue_usd > 0.009) {
    metadata.recognized_revenue_basis = {
      hybrid_monthly_override_usd: Number(totals.recognized_revenue_usd.toFixed(2))
    };
  }

  if (totals.gross_margin_usd > 0.009) {
    metadata.gross_margin_basis = {
      gross_margin_usd: Number(totals.gross_margin_usd.toFixed(2))
    };
  }

  if (totals.cashout_usd > 0.009 || totals.sink_spend_usd > 0.009) {
    metadata.accountability_checks = {
      ...(totals.cashout_usd > 0.009
        ? { cashout_total_usd: Number(totals.cashout_usd.toFixed(2)) }
        : {}),
      ...(totals.sink_spend_usd > 0.009
        ? { sink_total_usd: Number(totals.sink_spend_usd.toFixed(2)) }
        : {})
    };
  }

  return {
    period_key: periodKey,
    member_key: `DATA_AGG_OVERRIDE::${periodKey}`,
    source_system: "other",
    member_tier: "",
    group_key: "DATA_AGG_OVERRIDE",
    pc_volume: formatNumber(totals.pc_volume),
    sp_reward_basis: formatNumber(totals.sp_reward_basis),
    global_reward_usd: formatNumber(totals.global_reward_usd),
    pool_reward_usd: formatNumber(totals.pool_reward_usd),
    cashout_usd: formatNumber(totals.cashout_usd),
    sink_spend_usd: formatNumber(totals.sink_spend_usd),
    active_member: "false",
    recognized_revenue_usd: totals.recognized_revenue_usd > 0.009 ? formatNumber(totals.recognized_revenue_usd) : "",
    gross_margin_usd: formatNumber(totals.gross_margin_usd),
    member_join_period: "",
    is_affiliate: "",
    cross_app_active: "",
    extra_json: JSON.stringify(metadata)
  } satisfies CsvRecord;
}

function renderCsv(headers: string[], records: CsvRecord[]) {
  const lines = [headers.join(",")];

  for (const record of records) {
    lines.push(headers.map((header) => formatCsvValue(record[header] ?? "")).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function getPeriodRange(records: CsvRecord[]) {
  const periods = [...new Set(records.map((record) => record.period_key))].sort();

  if (periods.length === 0) {
    return {
      from: null,
      to: null,
      periods: [] as string[]
    };
  }

  return {
    from: periods[0] ?? null,
    to: periods[periods.length - 1] ?? null,
    periods
  };
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}

function buildTotals(records: CsvRecord[]) {
  return Object.fromEntries(
    NUMERIC_FIELDS.map((field) => [
      field,
      Number(records.reduce((sum, record) => sum + readNumber(record[field] ?? "0"), 0).toFixed(8))
    ])
  ) as Record<NumericField, number>;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = `bgc-source-bundle-hybrid-accepted-${args.dateLabel}`;
  const snapshotName = `BGC Source Bundle Hybrid Accepted ${args.dateLabel}`;
  const acceptedPath = path.join(args.outputDir, `${slug}.csv`);
  const quarantinePath = path.join(args.outputDir, `${slug}.quarantine.csv`);
  const manifestPath = path.join(args.outputDir, `${slug}.manifest.json`);
  const summaryPath = path.join(args.outputDir, `${slug}.summary.json`);
  const auditPath = path.join(args.outputDir, `${slug}.audit.md`);

  const text = await readFile(args.inputPath, "utf8");
  const rows = parseCsvRows(text);
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );

  const acceptedRecords: CsvRecord[] = [];
  const quarantinedRecords: Array<CsvRecord & { quarantine_reason: string }> = [];
  const dataAggOverrideRecordsByPeriod = new Map<string, CsvRecord[]>();

  for (const record of records) {
    snapshotImportCsvRowSchema.parse(record);
    const categories = readCategories(record);
    const hasParamsTopUp = categories.includes("params_monthly_topup");
    const hasDataAggOverride = categories.includes("data_agg_monthly_override");

    if (hasDataAggOverride) {
      const bucket = dataAggOverrideRecordsByPeriod.get(record.period_key) ?? [];
      bucket.push(record);
      dataAggOverrideRecordsByPeriod.set(record.period_key, bucket);
      quarantinedRecords.push({
        ...record,
        quarantine_reason: "collapsed_into_data_agg_period_override"
      });
      continue;
    }

    if (hasParamsTopUp && !hasDataAggOverride) {
      quarantinedRecords.push({
        ...record,
        quarantine_reason: "params_topup_without_data_agg_not_accepted_for_founder_truth"
      });
      continue;
    }

    acceptedRecords.push(record);
  }

  const collapsedOverrideRecords = [...dataAggOverrideRecordsByPeriod.entries()]
    .sort(([leftPeriod], [rightPeriod]) => leftPeriod.localeCompare(rightPeriod))
    .map(([periodKey, periodRecords]) => buildCollapsedDataAggOverrideRecord(periodKey, periodRecords));

  acceptedRecords.push(...collapsedOverrideRecords);

  const acceptedCategories = acceptedRecords.flatMap(readCategories);
  const quarantinedCategories = quarantinedRecords.flatMap(readCategories);
  const acceptedSources = acceptedRecords.map((record) => record.source_system.toLowerCase());
  const acceptedPeriodRange = getPeriodRange(acceptedRecords);
  const acceptedTotals = buildTotals(acceptedRecords);
  const quarantineReasons = countBy(quarantinedRecords.map((record) => record.quarantine_reason));
  const dataAggOverridePeriods = [
    ...new Set(
      acceptedRecords
        .filter((record) => readCategories(record).includes("data_agg_monthly_override"))
        .map((record) => record.period_key)
    )
  ].sort();

  const manifest = {
    snapshot_name: snapshotName,
    built_at: new Date().toISOString(),
    sourceType: "hybrid_verified",
    validatedVia: "hybrid_validation",
    truthNotes:
      "Business-rule source of truth remains understanding_doc_fixed. This accepted hybrid snapshot keeps source-backed rows plus DATA_AGG monthly override rows that are founder-relevant. Pure params_monthly_topup rows without DATA_AGG backing are quarantined from founder-facing truth.",
    input_canonical_bundle_path: args.inputPath,
    accepted_snapshot_path: acceptedPath,
    quarantine_path: quarantinePath,
    row_counts: {
      input: records.length,
      accepted: acceptedRecords.length,
      quarantined: quarantinedRecords.length
    },
    period_range: acceptedPeriodRange,
    data_agg_override_periods: dataAggOverridePeriods
  };

  const summary = {
    snapshot_name: snapshotName,
    accepted_row_count: acceptedRecords.length,
    quarantined_row_count: quarantinedRecords.length,
    accepted_period_range: acceptedPeriodRange,
    accepted_rows_by_source_system: countBy(acceptedSources),
    accepted_rows_by_category: countBy(acceptedCategories),
    quarantined_rows_by_category: countBy(quarantinedCategories),
    quarantine_reasons: quarantineReasons,
    accepted_totals: acceptedTotals
  };

  const auditMarkdown = [
    `# ${snapshotName}`,
    "",
    "## Contract",
    "- Accepted hybrid truth keeps source-backed rows plus `data_agg_monthly_override` rows.",
    "- Pure `params_monthly_topup` rows without `data_agg_monthly_override` are quarantined.",
    "- Source type: `hybrid_verified`",
    "- Validated via: `hybrid_validation`",
    "",
    "## Counts",
    `- Input rows: ${records.length}`,
    `- Accepted rows: ${acceptedRecords.length}`,
    `- Quarantined rows: ${quarantinedRecords.length}`,
    `- Period range: ${acceptedPeriodRange.from ?? "-"} to ${acceptedPeriodRange.to ?? "-"}`,
    "",
    "## Key Totals",
    `- pc_volume: ${acceptedTotals.pc_volume.toFixed(2)}`,
    `- sp_reward_basis: ${acceptedTotals.sp_reward_basis.toFixed(2)}`,
    `- global_reward_usd: ${acceptedTotals.global_reward_usd.toFixed(2)}`,
    `- pool_reward_usd: ${acceptedTotals.pool_reward_usd.toFixed(2)}`,
    `- cashout_usd: ${acceptedTotals.cashout_usd.toFixed(2)}`,
    `- sink_spend_usd: ${acceptedTotals.sink_spend_usd.toFixed(2)}`,
    `- recognized_revenue_usd: ${acceptedTotals.recognized_revenue_usd.toFixed(2)}`,
    `- gross_margin_usd: ${acceptedTotals.gross_margin_usd.toFixed(2)}`,
    "",
    "## DATA_AGG Override Coverage",
    `- Override periods: ${dataAggOverridePeriods.length > 0 ? dataAggOverridePeriods.join(", ") : "none"}`,
    "",
    "## Quarantine",
    quarantinedRecords.length > 0
      ? Object.entries(quarantineReasons)
          .map(([reason, count]) => `- ${reason}: ${count}`)
          .join("\n")
      : "- No rows quarantined."
  ].join("\n");

  await mkdir(args.outputDir, { recursive: true });
  await writeFile(acceptedPath, renderCsv(headers, acceptedRecords), "utf8");
  await writeFile(
    quarantinePath,
    renderCsv([...headers, "quarantine_reason"], quarantinedRecords),
    "utf8"
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(auditPath, `${auditMarkdown}\n`, "utf8");

  console.log(`Accepted hybrid snapshot written to ${acceptedPath}`);
  console.log(`Quarantine rows written to ${quarantinePath}`);
  console.log(`Accepted rows: ${acceptedRecords.length}; quarantined rows: ${quarantinedRecords.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
