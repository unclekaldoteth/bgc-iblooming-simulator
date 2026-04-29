import {
  snapshotImportCsvHeaders,
  snapshotImportCsvRowSchema,
  snapshotMemberMonthFactSchema
} from "@bgc-alpha/schemas";

import type {
  SnapshotImportIssueInput,
  SnapshotMemberMonthFactInput,
  SnapshotPoolPeriodFactInput
} from "./snapshots";

type CsvRecord = Record<string, string>;

type ParsedCompatibilityRow = {
  rowRef: string;
  fact: SnapshotMemberMonthFactInput;
  metadata: Record<string, unknown> | null;
  recognizedRevenueUsd: number | null;
  grossMarginUsd: number | null;
  memberJoinPeriod: string | null;
  isAffiliate: boolean | null;
  crossAppActive: boolean | null;
};

export type CompatibilityValidationMode =
  | "legacy_compatibility"
  | "understanding_doc_strict";

type ParseCompatibilityCsvSnapshotOptions = {
  mode?: CompatibilityValidationMode;
};

type ValidateCompatibilitySnapshotFactsOptions = {
  mode?: CompatibilityValidationMode;
  poolPeriodFacts?: SnapshotPoolPeriodFactInput[];
  canonicalSnapshotId?: string | null;
};

type ValidateCanonicalRuleGateBackingOptions = {
  canonicalSourceSnapshotKey?: string | null;
  canonicalEntityCount?: number;
};

type NormalizedSourceSystem = "BGC" | "IBLOOMING" | "OTHER";
type KnownBgcTier = "PATHFINDER" | "VOYAGER" | "EXPLORER" | "PIONEER" | "SPECIAL";
type KnownIbTier = "CP" | "EXECUTIVE_CP";

type PoolBasisByPayoutKeyEntry = {
  fundingAmount: number;
  distributionAmount: number;
  distributionCycle: string;
  unit: string;
  recipientCount: number;
  shareCountTotal: number;
  fundingEntryCount: number;
  distributionEntryCount: number;
};

type BgcTierRule = {
  entryFeeUsd: number;
  pcVolume: number;
  spRewardBasis: number;
  rank: number;
  rrTier1Pct: number;
  grTier2Pct: number;
  grTier3Pct: number;
};

const BGC_TIER_RULES: Record<KnownBgcTier, BgcTierRule> = {
  PATHFINDER: {
    entryFeeUsd: 100,
    pcVolume: 10_000,
    spRewardBasis: 70,
    rank: 1,
    rrTier1Pct: 0.1,
    grTier2Pct: 0,
    grTier3Pct: 0
  },
  VOYAGER: {
    entryFeeUsd: 500,
    pcVolume: 50_000,
    spRewardBasis: 350,
    rank: 2,
    rrTier1Pct: 0.1,
    grTier2Pct: 0.13,
    grTier3Pct: 0.16
  },
  EXPLORER: {
    entryFeeUsd: 1_725,
    pcVolume: 172_500,
    spRewardBasis: 1_207,
    rank: 3,
    rrTier1Pct: 0.12,
    grTier2Pct: 0.14,
    grTier3Pct: 0.17
  },
  PIONEER: {
    entryFeeUsd: 2_875,
    pcVolume: 287_500,
    spRewardBasis: 2_012,
    rank: 4,
    rrTier1Pct: 0.15,
    grTier2Pct: 0.15,
    grTier3Pct: 0.18
  },
  SPECIAL: {
    entryFeeUsd: 11_500,
    pcVolume: 1_150_000,
    spRewardBasis: 8_050,
    rank: 5,
    rrTier1Pct: 0.15,
    grTier2Pct: 0.15,
    grTier3Pct: 0.18
  }
};

const BGC_TIER_BY_ENTRY_FEE = new Map<number, KnownBgcTier>(
  Object.entries(BGC_TIER_RULES).map(([tierCode, rule]) => [rule.entryFeeUsd, tierCode as KnownBgcTier])
);

const KNOWN_IB_TIERS = new Set<KnownIbTier>(["CP", "EXECUTIVE_CP"]);
const CPR_YEAR_1_TAG = "CPR_YEAR_1:ACTIVE";
const CPR_YEAR_2_TAG = "CPR_YEAR_2:ACTIVE";
const WEC_ACHIEVED_TAG = "WEC_60_DAY:ACHIEVED";
const PIONEER_BGC_RANK = BGC_TIER_RULES.PIONEER.rank;
const IB_GRR_RATES = {
  TIER_1: 3,
  TIER_2: 0.8
} as const;
const IB_IRR_RATES = {
  FOUNDATION_TIER_1: 0.6,
  FOUNDATION_TIER_2: 0.25,
  PRO_TIER_1: 5,
  PRO_TIER_2: 2.5,
  EXPERT_TIER_1: 12,
  EXPERT_TIER_2: 5
} as const;

function normalizeHeader(value: string) {
  return value.trim();
}

function parseCsvRecords(text: string): CsvRecord[] {
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

      if (currentRow.some((value) => value.trim() !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  if (currentRow.some((value) => value.trim() !== "")) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const duplicateHeader = headers.find(
    (header, index) => header.length === 0 || headers.indexOf(header) !== index
  );

  if (duplicateHeader) {
    throw new Error(`CSV headers are invalid. Problem header: "${duplicateHeader || "(empty)"}".`);
  }

  return rows.slice(1).map((row, rowIndex) => {
    if (row.length > headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has more columns than the header row.`);
    }

    return headers.reduce<CsvRecord>((record, header, headerIndex) => {
      record[header] = row[headerIndex] ?? "";
      return record;
    }, {});
  });
}

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

function getMetadataFieldValue(
  metadata: Record<string, unknown>,
  primaryFieldName: string,
  aliases: string[] = []
) {
  for (const fieldName of [primaryFieldName, ...aliases]) {
    if (fieldName in metadata) {
      return metadata[fieldName];
    }
  }

  return undefined;
}

function copyMetadataAlias(
  metadata: Record<string, unknown>,
  primaryFieldName: string,
  aliases: string[]
) {
  if (primaryFieldName in metadata) {
    return;
  }

  for (const alias of aliases) {
    if (alias in metadata) {
      metadata[primaryFieldName] = metadata[alias];
      return;
    }
  }
}

function poolCycleBucketKey(periodKey: string, distributionCycle: string) {
  const [yearRaw, monthRaw] = periodKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (distributionCycle === "MONTHLY") {
    return periodKey;
  }

  if (distributionCycle === "QUARTERLY") {
    return `${year}-Q${Math.ceil(month / 3)}`;
  }

  if (distributionCycle === "SEMIANNUAL") {
    return `${year}-H${month <= 6 ? 1 : 2}`;
  }

  return periodKey;
}

function readPoolFactCount(metadata: Record<string, unknown> | null | undefined, key: string) {
  if (!metadata || !isRecord(metadata)) {
    return 0;
  }

  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildPoolBasisByPayoutKey(poolPeriodFacts: SnapshotPoolPeriodFactInput[]) {
  const bucketAccumulator = new Map<
    string,
    PoolBasisByPayoutKeyEntry & {
      payoutPeriodKey: string | null;
    }
  >();

  for (const poolFact of poolPeriodFacts) {
    const bucketKey = `${poolFact.poolCode}::${poolCycleBucketKey(
      poolFact.periodKey,
      poolFact.distributionCycle
    )}`;
    const poolFactMetadata = isRecord(poolFact.metadataJson)
      ? poolFact.metadataJson
      : null;
    const accumulator = bucketAccumulator.get(bucketKey) ?? {
      fundingAmount: 0,
      distributionAmount: 0,
      distributionCycle: poolFact.distributionCycle,
      unit: poolFact.unit,
      recipientCount: 0,
      shareCountTotal: 0,
      fundingEntryCount: 0,
      distributionEntryCount: 0,
      payoutPeriodKey: null
    };

    accumulator.fundingAmount = round2(accumulator.fundingAmount + poolFact.fundingAmount);
    accumulator.distributionAmount = round2(
      accumulator.distributionAmount + poolFact.distributionAmount
    );
    accumulator.fundingEntryCount += readPoolFactCount(poolFactMetadata, "fundingEntryCount");
    accumulator.distributionEntryCount += readPoolFactCount(
      poolFactMetadata,
      "distributionEntryCount"
    );

    if (poolFact.distributionAmount > 0) {
      accumulator.payoutPeriodKey = poolFact.periodKey;
      accumulator.recipientCount = poolFact.recipientCount;
      accumulator.shareCountTotal = poolFact.shareCountTotal;
    }

    bucketAccumulator.set(bucketKey, accumulator);
  }

  return new Map(
    [...bucketAccumulator.entries()]
      .filter(([, entry]) => entry.payoutPeriodKey !== null)
      .map(([bucketKey, entry]) => {
        const poolCode = bucketKey.split("::")[0] ?? "";

        return [
          `${entry.payoutPeriodKey}::${poolCode}`,
          {
            fundingAmount: entry.fundingAmount,
            distributionAmount: entry.distributionAmount,
            distributionCycle: entry.distributionCycle,
            unit: entry.unit,
            recipientCount: entry.recipientCount,
            shareCountTotal: entry.shareCountTotal,
            fundingEntryCount: entry.fundingEntryCount,
            distributionEntryCount: entry.distributionEntryCount
          } satisfies PoolBasisByPayoutKeyEntry
        ] as const;
      })
  );
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

function parseMetadataNumber(value: unknown, fieldName: string, rowRef: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number in extra_json (${rowRef}).`);
  }

  return value;
}

function parseMetadataBoolean(value: unknown, fieldName: string, rowRef: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean in extra_json (${rowRef}).`);
  }

  return value;
}

function parseMetadataString(value: unknown, fieldName: string, rowRef: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string in extra_json (${rowRef}).`);
  }

  return value.trim();
}

function parseMetadataStringArray(value: unknown, fieldName: string, rowRef: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error(`${fieldName} must be an array of non-empty strings in extra_json (${rowRef}).`);
  }

  return value.map((item) => item.trim());
}

function getOptionalMetadataRecord(
  metadata: Record<string, unknown>,
  fieldName: string,
  rowRef: string,
  aliases: string[] = []
) {
  const value = getMetadataFieldValue(metadata, fieldName, aliases);

  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be a JSON object in extra_json (${rowRef}).`);
  }

  return value;
}

function getOptionalMetadataNumber(
  metadata: Record<string, unknown>,
  fieldName: string,
  rowRef: string,
  aliases: string[] = []
) {
  const value = getMetadataFieldValue(metadata, fieldName, aliases);

  if (typeof value === "undefined" || value === null) {
    return null;
  }

  return parseMetadataNumber(value, fieldName, rowRef);
}

function parseFlatCountRecord(record: Record<string, unknown>, fieldName: string, rowRef: string) {
  const parsed: Record<string, number> = {};

  for (const [entryKey, entryValue] of Object.entries(record)) {
    const count = parseMetadataNumber(entryValue, `${fieldName}.${entryKey}`, rowRef);

    if (!Number.isInteger(count)) {
      throw new Error(`${fieldName}.${entryKey} must be an integer count in extra_json (${rowRef}).`);
    }

    parsed[entryKey] = count;
  }

  return parsed;
}

function assertCloseEnough(actual: number, expected: number, fieldName: string, rowRef: string) {
  if (Math.abs(actual - expected) > 0.01) {
    throw new Error(
      `${fieldName} total ${actual.toFixed(2)} does not match column value ${expected.toFixed(2)} (${rowRef}).`
    );
  }
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function normalizeSourceSystemCode(sourceSystem: string): NormalizedSourceSystem {
  const normalized = sourceSystem.trim().toUpperCase();

  if (normalized === "BGC") {
    return "BGC";
  }

  if (normalized === "IBLOOMING") {
    return "IBLOOMING";
  }

  return "OTHER";
}

function getExpectedRulePrefix(sourceSystem: string) {
  const normalized = normalizeSourceSystemCode(sourceSystem);

  if (normalized === "BGC") {
    return "BGC_";
  }

  if (normalized === "IBLOOMING") {
    return "IB_";
  }

  return null;
}

function sumBreakdownRecord(
  metadata: Record<string, unknown>,
  fieldName: string,
  rowRef: string,
  options?: {
    expectedPrefix?: string | null;
  }
) {
  const record = getOptionalMetadataRecord(metadata, fieldName, rowRef);

  if (!record) {
    return null;
  }

  let total = 0;

  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (options?.expectedPrefix && !entryKey.startsWith(options.expectedPrefix)) {
      throw new Error(
        `${fieldName} key "${entryKey}" must start with ${options.expectedPrefix} (${rowRef}).`
      );
    }

    total += parseMetadataNumber(entryValue, `${fieldName}.${entryKey}`, rowRef);
  }

  return total;
}

function normalizeMemberTier(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function isKnownBgcTier(value: string | null): value is KnownBgcTier {
  return value !== null && value in BGC_TIER_RULES;
}

function isKnownIbTier(value: string | null): value is KnownIbTier {
  return value !== null && KNOWN_IB_TIERS.has(value as KnownIbTier);
}

function getActiveRoleTags(metadata: Record<string, unknown> | null, rowRef: string) {
  if (!metadata) {
    return [] as string[];
  }

  const value = getMetadataFieldValue(metadata, "active_roles", ["activeRoles"]);

  if (typeof value === "undefined") {
    return [] as string[];
  }

  return parseMetadataStringArray(value, "active_roles", rowRef);
}

function getSourceCategories(metadata: Record<string, unknown> | null, rowRef: string) {
  if (!metadata) {
    return [] as string[];
  }

  const value = getMetadataFieldValue(metadata, "source_categories");

  if (typeof value === "undefined") {
    return [] as string[];
  }

  return parseMetadataStringArray(value, "source_categories", rowRef);
}

function getRowSemantics(metadata: Record<string, unknown> | null, rowRef: string) {
  if (!metadata) {
    return "compatibility_member_month_fact";
  }

  const value = getMetadataFieldValue(metadata, "row_semantics");

  if (typeof value === "undefined") {
    return "compatibility_member_month_fact";
  }

  return parseMetadataString(value, "row_semantics", rowRef);
}

function isHybridMonthlyOverrideRow(row: ParsedCompatibilityRow) {
  return getRowSemantics(row.metadata, row.rowRef) === "hybrid_monthly_override_fact";
}

function isAggregateCompatibilityRow(row: ParsedCompatibilityRow) {
  if (!row.metadata) {
    return false;
  }

  const value = getMetadataFieldValue(row.metadata, "aggregate_row", ["aggregateRow"]);

  if (typeof value === "undefined" || value === null) {
    return false;
  }

  return parseMetadataBoolean(value, "aggregate_row", row.rowRef);
}

function validateHybridMonthlyOverrideRow(row: ParsedCompatibilityRow) {
  const sourceSystem = normalizeSourceSystemCode(row.fact.sourceSystem);
  const memberTier = normalizeMemberTier(row.fact.memberTier);
  const sourceCategories = getSourceCategories(row.metadata, row.rowRef);
  const recognizedRevenueBasis = row.metadata
    ? getOptionalMetadataRecord(row.metadata, "recognized_revenue_basis", row.rowRef)
    : null;
  const grossMarginBasis = row.metadata
    ? getOptionalMetadataRecord(row.metadata, "gross_margin_basis", row.rowRef)
    : null;

  if (sourceSystem !== "OTHER") {
    throw new Error(`hybrid_monthly_override_fact rows must use source_system=other (${row.rowRef}).`);
  }

  if (memberTier !== null) {
    throw new Error(`hybrid_monthly_override_fact rows must leave member_tier blank (${row.rowRef}).`);
  }

  if (row.fact.groupKey !== "DATA_AGG_OVERRIDE") {
    throw new Error(`hybrid_monthly_override_fact rows must use group_key=DATA_AGG_OVERRIDE (${row.rowRef}).`);
  }

  if (row.fact.memberKey !== `DATA_AGG_OVERRIDE::${row.fact.periodKey}`) {
    throw new Error(
      `hybrid_monthly_override_fact rows must use member_key DATA_AGG_OVERRIDE::${row.fact.periodKey} (${row.rowRef}).`
    );
  }

  if (row.fact.activeMember) {
    throw new Error(`hybrid_monthly_override_fact rows must set active_member=false (${row.rowRef}).`);
  }

  if (row.memberJoinPeriod !== null) {
    throw new Error(`hybrid_monthly_override_fact rows must leave member_join_period blank (${row.rowRef}).`);
  }

  if (row.isAffiliate !== null || row.crossAppActive !== null) {
    throw new Error(
      `hybrid_monthly_override_fact rows must leave is_affiliate and cross_app_active blank (${row.rowRef}).`
    );
  }

  if (!sourceCategories.includes("data_agg_monthly_override")) {
    throw new Error(
      `hybrid_monthly_override_fact rows must include source_categories.data_agg_monthly_override (${row.rowRef}).`
    );
  }

  if (row.recognizedRevenueUsd !== null) {
    if (!recognizedRevenueBasis) {
      throw new Error(
        `hybrid_monthly_override_fact rows with recognized revenue must include recognized_revenue_basis.hybrid_monthly_override_usd (${row.rowRef}).`
      );
    }

    const expectedRecognizedRevenueUsd = getOptionalMetadataNumber(
      recognizedRevenueBasis,
      "hybrid_monthly_override_usd",
      row.rowRef
    );

    if (expectedRecognizedRevenueUsd === null) {
      throw new Error(
        `recognized_revenue_basis.hybrid_monthly_override_usd is required for hybrid_monthly_override_fact rows (${row.rowRef}).`
      );
    }

    assertCloseEnough(
      expectedRecognizedRevenueUsd,
      row.recognizedRevenueUsd,
      "recognized_revenue_basis.hybrid_monthly_override_usd",
      row.rowRef
    );
  }

  if (row.grossMarginUsd !== null) {
    if (!grossMarginBasis) {
      throw new Error(
        `hybrid_monthly_override_fact rows with gross margin must include gross_margin_basis.gross_margin_usd (${row.rowRef}).`
      );
    }

    const expectedGrossMarginUsd = getOptionalMetadataNumber(grossMarginBasis, "gross_margin_usd", row.rowRef);

    if (expectedGrossMarginUsd === null) {
      throw new Error(
        `gross_margin_basis.gross_margin_usd is required for hybrid_monthly_override_fact rows (${row.rowRef}).`
      );
    }

    assertCloseEnough(
      expectedGrossMarginUsd,
      row.grossMarginUsd,
      "gross_margin_basis.gross_margin_usd",
      row.rowRef
    );
  }
}

function getActiveQualificationTags(metadata: Record<string, unknown> | null, rowRef: string) {
  if (!metadata) {
    return [] as string[];
  }

  const value = getMetadataFieldValue(metadata, "active_qualifications", ["activeQualifications"]);

  if (typeof value === "undefined") {
    return [] as string[];
  }

  return parseMetadataStringArray(value, "active_qualifications", rowRef);
}

function getStatusState(metadata: Record<string, unknown> | null, rowRef: string) {
  if (!metadata) {
    return null;
  }

  return getOptionalMetadataRecord(metadata, "status_state", rowRef, ["statusState"]);
}

function extractMetadataNumber(
  metadata: Record<string, unknown> | null,
  rowRef: string,
  fieldName: string,
  aliases: string[] = []
) {
  if (!metadata) {
    return null;
  }

  const value = getMetadataFieldValue(metadata, fieldName, aliases);

  if (typeof value === "undefined" || value === null) {
    return null;
  }

  return parseMetadataNumber(value, fieldName, rowRef);
}

function extractMetadataBoolean(
  metadata: Record<string, unknown> | null,
  rowRef: string,
  fieldName: string,
  aliases: string[] = []
) {
  if (!metadata) {
    return null;
  }

  const value = getMetadataFieldValue(metadata, fieldName, aliases);

  if (typeof value === "undefined" || value === null) {
    return null;
  }

  return parseMetadataBoolean(value, fieldName, rowRef);
}

function extractMetadataPeriod(
  metadata: Record<string, unknown> | null,
  rowRef: string,
  fieldName: string,
  aliases: string[] = []
) {
  if (!metadata) {
    return null;
  }

  const value = getMetadataFieldValue(metadata, fieldName, aliases);

  if (typeof value === "undefined" || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must match YYYY-MM (${rowRef}).`);
  }

  return parseOptionalPeriodField(value, fieldName, rowRef);
}

function normalizeCompatibilityMetadataForValidation(
  metadata: Record<string, unknown> | null,
  fact: SnapshotMemberMonthFactInput,
  poolBasisByPayoutKey: Map<string, PoolBasisByPayoutKeyEntry>,
  canonicalSnapshotId: string | null | undefined
) {
  const normalized = metadata ? { ...metadata } : {};

  copyMetadataAlias(normalized, "status_state", ["statusState"]);
  copyMetadataAlias(normalized, "active_roles", ["activeRoles"]);
  copyMetadataAlias(normalized, "active_qualifications", ["activeQualifications"]);
  copyMetadataAlias(normalized, "recognized_revenue_basis", ["recognizedRevenueBasis"]);
  copyMetadataAlias(normalized, "gross_margin_basis", ["grossMarginBasis"]);
  copyMetadataAlias(normalized, "accountability_checks", ["accountabilityChecks"]);
  copyMetadataAlias(normalized, "global_reward_breakdown_usd", ["globalRewardBreakdownUsd"]);
  copyMetadataAlias(normalized, "pool_reward_breakdown_usd", ["poolRewardBreakdownUsd"]);
  copyMetadataAlias(normalized, "cashout_breakdown_usd", ["cashoutBreakdownUsd"]);
  copyMetadataAlias(normalized, "sink_breakdown_usd", ["sinkBreakdownUsd"]);
  copyMetadataAlias(normalized, "pc_breakdown", ["pcBreakdown"]);
  copyMetadataAlias(normalized, "sp_breakdown", ["spBreakdown"]);
  copyMetadataAlias(normalized, "join_counts_by_level", ["joinCountsByLevel"]);
  copyMetadataAlias(normalized, "event_counts", ["eventCounts"]);
  copyMetadataAlias(normalized, "plan_counts", ["planCounts"]);
  copyMetadataAlias(normalized, "pool_funding_basis", ["poolFundingBasis"]);
  copyMetadataAlias(normalized, "pool_share_snapshot", ["poolShareSnapshot"]);
  copyMetadataAlias(normalized, "canonical_rule_gate", ["canonicalRuleGate"]);
  copyMetadataAlias(normalized, "member_join_period", ["memberJoinPeriod"]);
  copyMetadataAlias(normalized, "is_affiliate", ["isAffiliate"]);
  copyMetadataAlias(normalized, "cross_app_active", ["crossAppActive"]);
  copyMetadataAlias(normalized, "recognized_revenue_usd", ["recognizedRevenueUsd"]);
  copyMetadataAlias(normalized, "gross_margin_usd", ["grossMarginUsd"]);

  if (canonicalSnapshotId && !("canonical_snapshot_id" in normalized)) {
    normalized.canonical_snapshot_id = canonicalSnapshotId;
  }

  const recognizedRevenueUsd = extractMetadataNumber(
    normalized,
    "row:metadata",
    "recognized_revenue_usd",
    ["recognizedRevenueUsd"]
  );
  const sourceCategories = Array.isArray(normalized.source_categories)
    ? normalized.source_categories.filter((value): value is string => typeof value === "string")
    : [];

  if (!("recognized_revenue_basis" in normalized)) {
    const normalizedSourceSystem = normalizeSourceSystemCode(fact.sourceSystem);

    if (
      normalizedSourceSystem === "BGC" &&
      recognizedRevenueUsd !== null &&
      (fact.pcVolume > 0 || fact.spRewardBasis > 0 || recognizedRevenueUsd > 0)
    ) {
      normalized.recognized_revenue_basis = {
        entry_fee_usd: round2(recognizedRevenueUsd)
      };
    }

    if (
      normalizedSourceSystem === "IBLOOMING" &&
      (recognizedRevenueUsd !== null || fact.sinkSpendUsd > 0)
    ) {
      const grossSaleUsd = round2(fact.sinkSpendUsd);
      const ibPlatformRevenueUsd =
        recognizedRevenueUsd !== null ? round2(recognizedRevenueUsd) : round2(grossSaleUsd * 0.3);

      normalized.recognized_revenue_basis = {
        gross_sale_usd: grossSaleUsd,
        cp_user_share_usd: round2(grossSaleUsd * 0.7),
        ib_platform_revenue_usd: ibPlatformRevenueUsd,
        platform_take_rate_pct: 30
      };
    }
  }

  if (!("sink_breakdown_usd" in normalized) && fact.sinkSpendUsd > 0) {
    const shouldDerivePcSpend =
      sourceCategories.includes("cp_video_sale") ||
      sourceCategories.includes("imatrix_product_aggregate");

    if (shouldDerivePcSpend) {
      normalized.sink_breakdown_usd = {
        PC_SPEND: round2(fact.sinkSpendUsd)
      };
    }
  }

  const accountabilityChecks = getOptionalMetadataRecord(
    normalized,
    "accountability_checks",
    "row:metadata",
    ["accountabilityChecks"]
  );

  if (fact.sinkSpendUsd > 0) {
    normalized.accountability_checks = {
      ...(accountabilityChecks ?? {}),
      sink_total_usd: round2(fact.sinkSpendUsd)
    };
  }

  if (!("pool_funding_basis" in normalized)) {
    const poolShareSnapshot = getOptionalMetadataRecord(
      normalized,
      "pool_share_snapshot",
      "row:metadata",
      ["poolShareSnapshot"]
    );
    const poolRewardBreakdown = getOptionalMetadataRecord(
      normalized,
      "pool_reward_breakdown_usd",
      "row:metadata",
      ["poolRewardBreakdownUsd"]
    );
    const poolCodes = new Set<string>([
      ...Object.keys(poolShareSnapshot ?? {}),
      ...Object.keys(poolRewardBreakdown ?? {})
    ]);

    if (poolCodes.size > 0) {
      const poolFundingBasis: Record<string, unknown> = {};

      for (const poolCode of poolCodes) {
        const poolBasis = poolBasisByPayoutKey.get(`${fact.periodKey}::${poolCode}`);

        if (!poolBasis) {
          continue;
        }

        poolFundingBasis[poolCode] = {
          funding_amount: round2(poolBasis.fundingAmount),
          distribution_amount: round2(poolBasis.distributionAmount),
          distribution_cycle: poolBasis.distributionCycle,
          unit: poolBasis.unit,
          funding_entry_count: poolBasis.fundingEntryCount,
          distribution_entry_count: poolBasis.distributionEntryCount
        };
      }

      if (Object.keys(poolFundingBasis).length > 0) {
        normalized.pool_funding_basis = poolFundingBasis;
      }
    }
  }

  const poolShareSnapshot = getOptionalMetadataRecord(
    normalized,
    "pool_share_snapshot",
    "row:metadata",
    ["poolShareSnapshot"]
  );

  if (poolShareSnapshot) {
    for (const [poolCode, poolShareValue] of Object.entries(poolShareSnapshot)) {
      if (!isRecord(poolShareValue)) {
        continue;
      }

      const poolBasis = poolBasisByPayoutKey.get(`${fact.periodKey}::${poolCode}`);

      if (!poolBasis) {
        continue;
      }

      if (
        typeof poolShareValue.recipient_count !== "number" ||
        !Number.isFinite(poolShareValue.recipient_count) ||
        poolShareValue.recipient_count <= 0
      ) {
        poolShareValue.recipient_count = poolBasis.recipientCount;
      }

      if (
        typeof poolShareValue.share_count_total !== "number" ||
        !Number.isFinite(poolShareValue.share_count_total) ||
        poolShareValue.share_count_total <= 0
      ) {
        poolShareValue.share_count_total = poolBasis.shareCountTotal;
      }

      if (
        (typeof poolShareValue.recipient_share_count !== "number" ||
          !Number.isFinite(poolShareValue.recipient_share_count) ||
          poolShareValue.recipient_share_count <= 0) &&
        poolShareValue.distribution_mode === "EQUAL_SHARE"
      ) {
        poolShareValue.recipient_share_count = 1;
      }

      if (typeof poolShareValue.distribution_cycle !== "string" || poolShareValue.distribution_cycle.length === 0) {
        poolShareValue.distribution_cycle = poolBasis.distributionCycle;
      }

      if (typeof poolShareValue.unit !== "string" || poolShareValue.unit.length === 0) {
        poolShareValue.unit = poolBasis.unit;
      }
    }
  }

  if (canonicalSnapshotId && !("canonical_rule_gate" in normalized)) {
    const canonicalOnlyRuleFamilies = new Set<string>();
    const globalRewardBreakdown = getOptionalMetadataRecord(
      normalized,
      "global_reward_breakdown_usd",
      "row:metadata",
      ["globalRewardBreakdownUsd"]
    );
    const poolRewardBreakdown = getOptionalMetadataRecord(
      normalized,
      "pool_reward_breakdown_usd",
      "row:metadata",
      ["poolRewardBreakdownUsd"]
    );
    const statusState = getOptionalMetadataRecord(
      normalized,
      "status_state",
      "row:metadata",
      ["statusState"]
    );
    const activeQualifications = getMetadataFieldValue(
      normalized,
      "active_qualifications",
      ["activeQualifications"]
    );

    if (globalRewardBreakdown && "BGC_MIRACLE_CASH" in globalRewardBreakdown) {
      canonicalOnlyRuleFamilies.add("BGC_MIRACLE_CASH_FIRST_10_JOINS");
    }

    if (globalRewardBreakdown && "IB_MIRACLE_CASH" in globalRewardBreakdown) {
      canonicalOnlyRuleFamilies.add("IB_MIRACLE_CASH_FIRST_10_PURCHASES");
    }

    if (
      (Array.isArray(activeQualifications) &&
        activeQualifications.some(
          (qualification) => typeof qualification === "string" && qualification.startsWith("WEC_60_DAY:")
        )) ||
      (statusState && typeof statusState.wec_status === "string" && statusState.wec_status.length > 0)
    ) {
      canonicalOnlyRuleFamilies.add("WEC_60_DAY_EXACT_WINDOW");
    }

    if (poolRewardBreakdown && "IB_GEC_INTERNAL_POOL" in poolRewardBreakdown) {
      canonicalOnlyRuleFamilies.add("IB_GEC_MEMBERSHIP_PROVENANCE");
    }

    if (canonicalOnlyRuleFamilies.size > 0) {
      normalized.canonical_rule_gate = {
        strict_mode: "understanding_doc_strict",
        validated_via: "canonical_json",
        requires_canonical_json: true,
        canonical_only_rule_families: [...canonicalOnlyRuleFamilies].sort()
      };
    }
  }

  return normalized;
}

function hasWecEvidence(row: ParsedCompatibilityRow) {
  const activeRoles = getActiveRoleTags(row.metadata, row.rowRef);
  const activeQualifications = getActiveQualificationTags(row.metadata, row.rowRef);
  const statusState = getStatusState(row.metadata, row.rowRef);

  if (activeRoles.some((role) => role.startsWith("WEC_STATUS:"))) {
    return true;
  }

  if (activeQualifications.includes(WEC_ACHIEVED_TAG)) {
    return true;
  }

  return statusState !== null && typeof statusState.wec_status === "string" && statusState.wec_status.length > 0;
}

function getBgcTierRankFromRow(row: ParsedCompatibilityRow) {
  const tier = normalizeMemberTier(row.fact.memberTier);

  if (!isKnownBgcTier(tier)) {
    return null;
  }

  return BGC_TIER_RULES[tier].rank;
}

function periodToIndex(periodKey: string) {
  const [yearValue, monthValue] = periodKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  return year * 12 + month - 1;
}

function expectedBgcRewardFromJoinCounts(
  joinCountsByLevel: Record<string, number>,
  rewardType: "BGC_RR" | "BGC_GR"
) {
  let expectedAmount = 0;

  for (const [countKey, count] of Object.entries(joinCountsByLevel)) {
    if (count <= 0) {
      continue;
    }

    if (rewardType === "BGC_RR" && countKey.startsWith("RR_")) {
      const level = countKey.replace(/^RR_/, "") as KnownBgcTier;

      if (isKnownBgcTier(level)) {
        const rule = BGC_TIER_RULES[level];
        expectedAmount += rule.spRewardBasis * rule.rrTier1Pct * count;
      }
    }

    if (rewardType === "BGC_GR") {
      const match = /^GR_TIER_(2|3)_(PATHFINDER|VOYAGER|EXPLORER|PIONEER|SPECIAL)$/.exec(countKey);

      if (!match) {
        continue;
      }

      const tier = Number(match[1]) as 2 | 3;
      const level = match[2] as KnownBgcTier;
      const rule = BGC_TIER_RULES[level];
      const rate = tier === 2 ? rule.grTier2Pct : rule.grTier3Pct;
      expectedAmount += rule.spRewardBasis * rate * count;
    }
  }

  return round2(expectedAmount);
}

function expectedIbGrrFromEventCounts(eventCounts: Record<string, number>) {
  return round2(
    (eventCounts.GIM_SIGNUP_TIER_1 ?? 0) * IB_GRR_RATES.TIER_1 +
      (eventCounts.GIM_SIGNUP_TIER_2 ?? 0) * IB_GRR_RATES.TIER_2
  );
}

function expectedIbIrrFromPlanCounts(planCounts: Record<string, number>) {
  return round2(
    Object.entries(IB_IRR_RATES).reduce((total, [countKey, rate]) => total + (planCounts[countKey] ?? 0) * rate, 0)
  );
}

type ParsedPoolFundingBasis = {
  fundingAmount: number;
  distributionAmount: number;
  distributionCycle: string;
  unit: string;
  fundingEntryCount: number | null;
  distributionEntryCount: number | null;
};

type ParsedPoolShareSnapshot = {
  distributionMode: string;
  distributionCycle: string | null;
  unit: string | null;
  recipientCount: number;
  shareCountTotal: number;
  recipientShareCount: number;
  eligibilitySnapshotKey: string | null;
};

function parsePoolFundingBasis(
  metadata: Record<string, unknown>,
  rowRef: string
): Map<string, ParsedPoolFundingBasis> {
  const record = getOptionalMetadataRecord(metadata, "pool_funding_basis", rowRef);

  if (!record) {
    return new Map();
  }

  return new Map(
    Object.entries(record).map(([poolCode, poolValue]) => {
      if (!isRecord(poolValue)) {
        throw new Error(`pool_funding_basis.${poolCode} must be a JSON object (${rowRef}).`);
      }

      const fundingAmount = parseMetadataNumber(poolValue.funding_amount, `pool_funding_basis.${poolCode}.funding_amount`, rowRef);
      const distributionAmount = parseMetadataNumber(
        poolValue.distribution_amount,
        `pool_funding_basis.${poolCode}.distribution_amount`,
        rowRef
      );
      const distributionCycle = parseMetadataString(
        poolValue.distribution_cycle,
        `pool_funding_basis.${poolCode}.distribution_cycle`,
        rowRef
      );
      const unit = parseMetadataString(poolValue.unit, `pool_funding_basis.${poolCode}.unit`, rowRef);
      const fundingEntryCount =
        typeof poolValue.funding_entry_count === "undefined" || poolValue.funding_entry_count === null
          ? null
          : parseMetadataNumber(
              poolValue.funding_entry_count,
              `pool_funding_basis.${poolCode}.funding_entry_count`,
              rowRef
            );
      const distributionEntryCount =
        typeof poolValue.distribution_entry_count === "undefined" ||
        poolValue.distribution_entry_count === null
          ? null
          : parseMetadataNumber(
              poolValue.distribution_entry_count,
              `pool_funding_basis.${poolCode}.distribution_entry_count`,
              rowRef
            );

      return [
        poolCode,
        {
          fundingAmount,
          distributionAmount,
          distributionCycle,
          unit,
          fundingEntryCount,
          distributionEntryCount
        }
      ] as const;
    })
  );
}

function parsePoolShareSnapshot(
  metadata: Record<string, unknown>,
  rowRef: string
): Map<string, ParsedPoolShareSnapshot> {
  const record = getOptionalMetadataRecord(metadata, "pool_share_snapshot", rowRef);

  if (!record) {
    return new Map();
  }

  return new Map(
    Object.entries(record).map(([poolCode, poolValue]) => {
      if (!isRecord(poolValue)) {
        throw new Error(`pool_share_snapshot.${poolCode} must be a JSON object (${rowRef}).`);
      }

      const distributionMode = parseMetadataString(
        poolValue.distribution_mode,
        `pool_share_snapshot.${poolCode}.distribution_mode`,
        rowRef
      );
      const recipientCount = parseMetadataNumber(
        poolValue.recipient_count,
        `pool_share_snapshot.${poolCode}.recipient_count`,
        rowRef
      );
      const shareCountTotal = parseMetadataNumber(
        poolValue.share_count_total,
        `pool_share_snapshot.${poolCode}.share_count_total`,
        rowRef
      );
      const recipientShareCount = parseMetadataNumber(
        poolValue.recipient_share_count,
        `pool_share_snapshot.${poolCode}.recipient_share_count`,
        rowRef
      );
      const distributionCycle =
        typeof poolValue.distribution_cycle === "undefined" || poolValue.distribution_cycle === null
          ? null
          : parseMetadataString(
              poolValue.distribution_cycle,
              `pool_share_snapshot.${poolCode}.distribution_cycle`,
              rowRef
            );
      const unit =
        typeof poolValue.unit === "undefined" || poolValue.unit === null
          ? null
          : parseMetadataString(poolValue.unit, `pool_share_snapshot.${poolCode}.unit`, rowRef);
      const eligibilitySnapshotKey =
        typeof poolValue.eligibility_snapshot_key === "undefined" || poolValue.eligibility_snapshot_key === null
          ? null
          : parseMetadataString(
              poolValue.eligibility_snapshot_key,
              `pool_share_snapshot.${poolCode}.eligibility_snapshot_key`,
              rowRef
            );

      return [
        poolCode,
        {
          distributionMode,
          distributionCycle,
          unit,
          recipientCount,
          shareCountTotal,
          recipientShareCount,
          eligibilitySnapshotKey
        }
      ] as const;
    })
  );
}

function validateUnderstandingDocRowFormula(row: ParsedCompatibilityRow) {
  const sourceSystem = normalizeSourceSystemCode(row.fact.sourceSystem);
  const memberTier = normalizeMemberTier(row.fact.memberTier);
  const isAggregateRow = isAggregateCompatibilityRow(row);
  const statusState = getStatusState(row.metadata, row.rowRef);
  const activeRoles = getActiveRoleTags(row.metadata, row.rowRef);
  const activeQualifications = getActiveQualificationTags(row.metadata, row.rowRef);
  const recognizedRevenueBasis = row.metadata
    ? getOptionalMetadataRecord(row.metadata, "recognized_revenue_basis", row.rowRef)
    : null;
  const globalRewardBreakdown = row.metadata
    ? getOptionalMetadataRecord(row.metadata, "global_reward_breakdown_usd", row.rowRef)
    : null;

  if (sourceSystem === "BGC") {
    if (memberTier !== null && !isKnownBgcTier(memberTier)) {
      throw new Error(
        `member_tier must be one of PATHFINDER/VOYAGER/EXPLORER/PIONEER/SPECIAL for bgc rows (${row.rowRef}).`
      );
    }

    if (statusState && "affiliate_level" in statusState) {
      const affiliateLevel = normalizeMemberTier(
        parseMetadataString(statusState.affiliate_level, "status_state.affiliate_level", row.rowRef)
      );

      if (!isKnownBgcTier(affiliateLevel)) {
        throw new Error(`status_state.affiliate_level is not a valid BGC affiliate level (${row.rowRef}).`);
      }

      if (memberTier !== null && affiliateLevel !== memberTier) {
        throw new Error(`status_state.affiliate_level must match member_tier for bgc rows (${row.rowRef}).`);
      }
    }

    if (activeRoles.length > 0 && memberTier !== null) {
      const expectedAffiliateRole = `AFFILIATE_LEVEL:${memberTier}`;

      if (!activeRoles.includes(expectedAffiliateRole)) {
        throw new Error(`active_roles must include ${expectedAffiliateRole} for bgc rows (${row.rowRef}).`);
      }
    }

    if (recognizedRevenueBasis && "gross_sale_usd" in recognizedRevenueBasis) {
      throw new Error(`recognized_revenue_basis.gross_sale_usd is invalid for bgc rows (${row.rowRef}).`);
    }

    const requiresEntryFeeBasis = row.fact.pcVolume > 0 || row.recognizedRevenueUsd !== null;

    if (requiresEntryFeeBasis && !recognizedRevenueBasis) {
      throw new Error(
        `bgc rows with PC/SP/recognized revenue must include recognized_revenue_basis.entry_fee_usd (${row.rowRef}).`
      );
    }

    if (recognizedRevenueBasis) {
      const entryFeeUsd = getOptionalMetadataNumber(recognizedRevenueBasis, "entry_fee_usd", row.rowRef);

      if (entryFeeUsd !== null) {
        const expectedTier = BGC_TIER_BY_ENTRY_FEE.get(entryFeeUsd);

        if (!expectedTier) {
          throw new Error(`recognized_revenue_basis.entry_fee_usd is not a valid BGC price point (${row.rowRef}).`);
        }

        if (memberTier !== null && memberTier !== expectedTier) {
          throw new Error(
            `member_tier must match the BGC level implied by entry_fee_usd (${row.rowRef}).`
          );
        }

        assertCloseEnough(
          BGC_TIER_RULES[expectedTier].pcVolume,
          row.fact.pcVolume,
          "pc_volume",
          row.rowRef
        );
        assertCloseEnough(
          BGC_TIER_RULES[expectedTier].spRewardBasis,
          row.fact.spRewardBasis,
          "sp_reward_basis",
          row.rowRef
        );

        if (row.isAffiliate === false) {
          throw new Error(`bgc join/upgrade rows cannot set is_affiliate=false (${row.rowRef}).`);
        }
      }
    }

    if (activeQualifications.includes(CPR_YEAR_1_TAG) && activeQualifications.includes(CPR_YEAR_2_TAG)) {
      throw new Error(`active_qualifications cannot contain both CPR year tags (${row.rowRef}).`);
    }
  }

  if (sourceSystem === "IBLOOMING") {
    if (row.fact.pcVolume > 0) {
      throw new Error(`pc_volume must be 0 for iblooming rows because PC is a BGC-only unit (${row.rowRef}).`);
    }

    if (memberTier !== null && !isKnownIbTier(memberTier)) {
      throw new Error(`member_tier must be blank, CP, or EXECUTIVE_CP for iblooming rows (${row.rowRef}).`);
    }

    if (statusState && "cp_status" in statusState) {
      const cpStatus = normalizeMemberTier(
        parseMetadataString(statusState.cp_status, "status_state.cp_status", row.rowRef)
      );

      if (!isKnownIbTier(cpStatus)) {
        throw new Error(`status_state.cp_status is not a valid iBLOOMING CP status (${row.rowRef}).`);
      }

      if (memberTier !== null && cpStatus !== memberTier) {
        throw new Error(`status_state.cp_status must match member_tier for iblooming CP rows (${row.rowRef}).`);
      }
    }

    if (recognizedRevenueBasis && "entry_fee_usd" in recognizedRevenueBasis) {
      throw new Error(`recognized_revenue_basis.entry_fee_usd is invalid for iblooming rows (${row.rowRef}).`);
    }

    const hasRecognizedRevenueBasis =
      recognizedRevenueBasis &&
      ["gross_sale_usd", "cp_user_share_usd", "ib_platform_revenue_usd", "platform_take_rate_pct"].some(
        (fieldName) => fieldName in recognizedRevenueBasis
      );

    const requiresPlatformSaleBasis = row.recognizedRevenueUsd !== null || row.fact.sinkSpendUsd > 0;

    if (requiresPlatformSaleBasis && !hasRecognizedRevenueBasis) {
      throw new Error(
        `iblooming rows with recognized revenue or sink spend must include gross sale basis fields (${row.rowRef}).`
      );
    }

    if (recognizedRevenueBasis && hasRecognizedRevenueBasis) {
      const grossSaleUsd = getOptionalMetadataNumber(recognizedRevenueBasis, "gross_sale_usd", row.rowRef);
      const cpUserShareUsd = getOptionalMetadataNumber(
        recognizedRevenueBasis,
        "cp_user_share_usd",
        row.rowRef
      );
      const ibPlatformRevenueUsd = getOptionalMetadataNumber(
        recognizedRevenueBasis,
        "ib_platform_revenue_usd",
        row.rowRef
      );
      const platformTakeRatePct = getOptionalMetadataNumber(
        recognizedRevenueBasis,
        "platform_take_rate_pct",
        row.rowRef
      );

      if (
        grossSaleUsd === null ||
        cpUserShareUsd === null ||
        ibPlatformRevenueUsd === null ||
        platformTakeRatePct === null
      ) {
        throw new Error(
          `iblooming recognized_revenue_basis must include gross_sale_usd, cp_user_share_usd, ib_platform_revenue_usd, and platform_take_rate_pct (${row.rowRef}).`
        );
      }

      assertCloseEnough(cpUserShareUsd + ibPlatformRevenueUsd, grossSaleUsd, "gross sale split", row.rowRef);
      assertCloseEnough(round2(grossSaleUsd * 0.7), cpUserShareUsd, "cp_user_share_usd", row.rowRef);
      assertCloseEnough(
        round2(grossSaleUsd * 0.3),
        ibPlatformRevenueUsd,
        "ib_platform_revenue_usd",
        row.rowRef
      );
      assertCloseEnough(30, platformTakeRatePct, "platform_take_rate_pct", row.rowRef);
      assertCloseEnough(grossSaleUsd, row.fact.sinkSpendUsd, "sink_spend_usd", row.rowRef);

      if (!isAggregateRow && globalRewardBreakdown && "IB_LR" in globalRewardBreakdown) {
        assertCloseEnough(
          round2(ibPlatformRevenueUsd * 0.1),
          parseMetadataNumber(globalRewardBreakdown.IB_LR, "global_reward_breakdown_usd.IB_LR", row.rowRef),
          "global_reward_breakdown_usd.IB_LR",
          row.rowRef
        );
      }

      if (!isAggregateRow && globalRewardBreakdown && "IB_MIRACLE_CASH" in globalRewardBreakdown) {
        assertCloseEnough(
          round2(ibPlatformRevenueUsd * 0.01),
          parseMetadataNumber(
            globalRewardBreakdown.IB_MIRACLE_CASH,
            "global_reward_breakdown_usd.IB_MIRACLE_CASH",
            row.rowRef
          ),
          "global_reward_breakdown_usd.IB_MIRACLE_CASH",
          row.rowRef
        );
      }

      if (!isAggregateRow && globalRewardBreakdown && "IB_CPR" in globalRewardBreakdown) {
        const hasYear1 = activeQualifications.includes(CPR_YEAR_1_TAG);
        const hasYear2 = activeQualifications.includes(CPR_YEAR_2_TAG);

        if (hasYear1 === hasYear2) {
          throw new Error(
            `IB_CPR with platform revenue basis requires exactly one CPR year qualification tag (${row.rowRef}).`
          );
        }

        const expectedRate = hasYear1 ? 0.05 : 0.025;
        assertCloseEnough(
          round2(ibPlatformRevenueUsd * expectedRate),
          parseMetadataNumber(globalRewardBreakdown.IB_CPR, "global_reward_breakdown_usd.IB_CPR", row.rowRef),
          "global_reward_breakdown_usd.IB_CPR",
          row.rowRef
        );
      }
    }

    if (activeQualifications.includes(CPR_YEAR_1_TAG) && activeQualifications.includes(CPR_YEAR_2_TAG)) {
      throw new Error(`active_qualifications cannot contain both CPR year tags (${row.rowRef}).`);
    }
  }
}

function validateCountAwareCompatibilityContract(row: ParsedCompatibilityRow) {
  if (!row.metadata) {
    return;
  }

  if (isAggregateCompatibilityRow(row)) {
    return;
  }

  const globalRewardBreakdown = getOptionalMetadataRecord(row.metadata, "global_reward_breakdown_usd", row.rowRef);
  const poolRewardBreakdown = getOptionalMetadataRecord(row.metadata, "pool_reward_breakdown_usd", row.rowRef);
  const joinCountsByLevel = getOptionalMetadataRecord(row.metadata, "join_counts_by_level", row.rowRef);
  const eventCounts = getOptionalMetadataRecord(row.metadata, "event_counts", row.rowRef);
  const planCounts = getOptionalMetadataRecord(row.metadata, "plan_counts", row.rowRef);
  const parsedJoinCounts = joinCountsByLevel
    ? parseFlatCountRecord(joinCountsByLevel, "join_counts_by_level", row.rowRef)
    : null;
  const parsedEventCounts = eventCounts
    ? parseFlatCountRecord(eventCounts, "event_counts", row.rowRef)
    : null;
  const parsedPlanCounts = planCounts
    ? parseFlatCountRecord(planCounts, "plan_counts", row.rowRef)
    : null;

  if (globalRewardBreakdown && "BGC_RR" in globalRewardBreakdown) {
    if (!parsedJoinCounts) {
      throw new Error(`BGC_RR rows must include join_counts_by_level (${row.rowRef}).`);
    }

    assertCloseEnough(
      expectedBgcRewardFromJoinCounts(parsedJoinCounts, "BGC_RR"),
      parseMetadataNumber(globalRewardBreakdown.BGC_RR, "global_reward_breakdown_usd.BGC_RR", row.rowRef),
      "global_reward_breakdown_usd.BGC_RR",
      row.rowRef
    );
  }

  if (globalRewardBreakdown && "BGC_GR" in globalRewardBreakdown) {
    if (!parsedJoinCounts) {
      throw new Error(`BGC_GR rows must include join_counts_by_level (${row.rowRef}).`);
    }

    assertCloseEnough(
      expectedBgcRewardFromJoinCounts(parsedJoinCounts, "BGC_GR"),
      parseMetadataNumber(globalRewardBreakdown.BGC_GR, "global_reward_breakdown_usd.BGC_GR", row.rowRef),
      "global_reward_breakdown_usd.BGC_GR",
      row.rowRef
    );
  }

  if (globalRewardBreakdown && "IB_GRR" in globalRewardBreakdown) {
    if (!parsedEventCounts) {
      throw new Error(`IB_GRR rows must include event_counts (${row.rowRef}).`);
    }

    assertCloseEnough(
      expectedIbGrrFromEventCounts(parsedEventCounts),
      parseMetadataNumber(globalRewardBreakdown.IB_GRR, "global_reward_breakdown_usd.IB_GRR", row.rowRef),
      "global_reward_breakdown_usd.IB_GRR",
      row.rowRef
    );
  }

  if (globalRewardBreakdown && "IB_IRR" in globalRewardBreakdown) {
    if (!parsedPlanCounts) {
      throw new Error(`IB_IRR rows must include plan_counts (${row.rowRef}).`);
    }

    assertCloseEnough(
      expectedIbIrrFromPlanCounts(parsedPlanCounts),
      parseMetadataNumber(globalRewardBreakdown.IB_IRR, "global_reward_breakdown_usd.IB_IRR", row.rowRef),
      "global_reward_breakdown_usd.IB_IRR",
      row.rowRef
    );
  }

  if (!poolRewardBreakdown) {
    return;
  }

  const poolFundingBasis = parsePoolFundingBasis(row.metadata, row.rowRef);
  const poolShareSnapshot = parsePoolShareSnapshot(row.metadata, row.rowRef);

  for (const [poolCode, distributionValue] of Object.entries(poolRewardBreakdown)) {
    const distributionAmount = parseMetadataNumber(
      distributionValue,
      `pool_reward_breakdown_usd.${poolCode}`,
      row.rowRef
    );
    const fundingBasis = poolFundingBasis.get(poolCode);
    const shareSnapshot = poolShareSnapshot.get(poolCode);

    if (!fundingBasis) {
      throw new Error(`pool_reward_breakdown_usd.${poolCode} requires pool_funding_basis.${poolCode} (${row.rowRef}).`);
    }

    if (!shareSnapshot) {
      throw new Error(`pool_reward_breakdown_usd.${poolCode} requires pool_share_snapshot.${poolCode} (${row.rowRef}).`);
    }

    if (fundingBasis.unit !== "USD") {
      throw new Error(`pool_funding_basis.${poolCode}.unit must be USD for compatibility CSV (${row.rowRef}).`);
    }

    if (shareSnapshot.unit !== null && shareSnapshot.unit !== fundingBasis.unit) {
      throw new Error(`pool_share_snapshot.${poolCode}.unit must match pool_funding_basis.${poolCode}.unit (${row.rowRef}).`);
    }

    if (
      shareSnapshot.distributionCycle !== null &&
      shareSnapshot.distributionCycle !== fundingBasis.distributionCycle
    ) {
      throw new Error(
        `pool_share_snapshot.${poolCode}.distribution_cycle must match pool_funding_basis.${poolCode}.distribution_cycle (${row.rowRef}).`
      );
    }

    if (distributionAmount > fundingBasis.distributionAmount + 0.01) {
      throw new Error(`pool_reward_breakdown_usd.${poolCode} cannot exceed the pool distribution total (${row.rowRef}).`);
    }

    if (fundingBasis.distributionAmount > fundingBasis.fundingAmount + 0.01) {
      throw new Error(`pool_funding_basis.${poolCode}.distribution_amount cannot exceed funding_amount (${row.rowRef}).`);
    }

    if (shareSnapshot.recipientCount <= 0 || shareSnapshot.shareCountTotal <= 0 || shareSnapshot.recipientShareCount <= 0) {
      throw new Error(`pool_share_snapshot.${poolCode} must have positive recipient/share counts (${row.rowRef}).`);
    }

    if (shareSnapshot.distributionMode === "EQUAL_SHARE") {
      assertCloseEnough(
        round2(fundingBasis.distributionAmount / shareSnapshot.recipientCount),
        distributionAmount,
        `pool_reward_breakdown_usd.${poolCode}`,
        row.rowRef
      );

      if (shareSnapshot.shareCountTotal !== shareSnapshot.recipientCount) {
        throw new Error(`EQUAL_SHARE pools require share_count_total to equal recipient_count (${row.rowRef}).`);
      }

      if (shareSnapshot.recipientShareCount !== 1) {
        throw new Error(`EQUAL_SHARE pools require recipient_share_count to equal 1 (${row.rowRef}).`);
      }
    } else if (shareSnapshot.distributionMode === "WEIGHTED_SHARE") {
      assertCloseEnough(
        round2((fundingBasis.distributionAmount * shareSnapshot.recipientShareCount) / shareSnapshot.shareCountTotal),
        distributionAmount,
        `pool_reward_breakdown_usd.${poolCode}`,
        row.rowRef
      );
    } else {
      throw new Error(`Unsupported distribution_mode ${shareSnapshot.distributionMode} in pool_share_snapshot.${poolCode} (${row.rowRef}).`);
    }
  }
}

function detectCanonicalOnlyRuleFamilies(row: ParsedCompatibilityRow) {
  const families = new Set<string>();
  const globalRewardBreakdown = row.metadata
    ? getOptionalMetadataRecord(row.metadata, "global_reward_breakdown_usd", row.rowRef)
    : null;
  const poolRewardBreakdown = row.metadata
    ? getOptionalMetadataRecord(row.metadata, "pool_reward_breakdown_usd", row.rowRef)
    : null;
  const activeQualifications = getActiveQualificationTags(row.metadata, row.rowRef);
  const statusState = getStatusState(row.metadata, row.rowRef);

  if (globalRewardBreakdown && "BGC_MIRACLE_CASH" in globalRewardBreakdown) {
    families.add("BGC_MIRACLE_CASH_FIRST_10_JOINS");
  }

  if (globalRewardBreakdown && "IB_MIRACLE_CASH" in globalRewardBreakdown) {
    families.add("IB_MIRACLE_CASH_FIRST_10_PURCHASES");
  }

  if (
    activeQualifications.some((qualification) => qualification.startsWith("WEC_60_DAY:")) ||
    (statusState && typeof statusState.wec_status === "string" && statusState.wec_status.length > 0)
  ) {
    families.add("WEC_60_DAY_EXACT_WINDOW");
  }

  if (poolRewardBreakdown && "IB_GEC_INTERNAL_POOL" in poolRewardBreakdown) {
    families.add("IB_GEC_MEMBERSHIP_PROVENANCE");
  }

  return [...families.values()].sort();
}

function validateCanonicalOnlyRuleGates(row: ParsedCompatibilityRow) {
  if (!row.metadata) {
    return;
  }

  const canonicalOnlyFamilies = detectCanonicalOnlyRuleFamilies(row);

  if (canonicalOnlyFamilies.length === 0) {
    return;
  }

  const canonicalSnapshotId =
    "canonical_snapshot_id" in row.metadata
      ? parseMetadataString(row.metadata.canonical_snapshot_id, "canonical_snapshot_id", row.rowRef)
      : null;

  if (!canonicalSnapshotId) {
    throw new Error(
      `Rows containing canonical-only rule families must include canonical_snapshot_id (${row.rowRef}).`
    );
  }

  const gate = getOptionalMetadataRecord(row.metadata, "canonical_rule_gate", row.rowRef);

  if (!gate) {
    throw new Error(
      `Rows containing canonical-only rule families must include canonical_rule_gate and be validated via canonical JSON (${row.rowRef}).`
    );
  }

  const validatedVia = parseMetadataString(gate.validated_via, "canonical_rule_gate.validated_via", row.rowRef);
  const strictMode = parseMetadataString(gate.strict_mode, "canonical_rule_gate.strict_mode", row.rowRef);
  const requiresCanonicalJson = parseMetadataBoolean(
    gate.requires_canonical_json,
    "canonical_rule_gate.requires_canonical_json",
    row.rowRef
  );
  const listedFamilies = parseMetadataStringArray(
    gate.canonical_only_rule_families,
    "canonical_rule_gate.canonical_only_rule_families",
    row.rowRef
  ).sort();

  if (validatedVia !== "canonical_json") {
    throw new Error(`canonical_rule_gate.validated_via must be canonical_json (${row.rowRef}).`);
  }

  if (strictMode !== "understanding_doc_strict") {
    throw new Error(`canonical_rule_gate.strict_mode must be understanding_doc_strict (${row.rowRef}).`);
  }

  if (!requiresCanonicalJson) {
    throw new Error(`canonical_rule_gate.requires_canonical_json must be true (${row.rowRef}).`);
  }

  if (
    listedFamilies.length !== canonicalOnlyFamilies.length ||
    listedFamilies.some((family, index) => family !== canonicalOnlyFamilies[index])
  ) {
    throw new Error(
      `canonical_rule_gate.canonical_only_rule_families must match the canonical-only rule families present on the row (${row.rowRef}).`
    );
  }
}

function validateCompatibilityRowMetadata(
  row: ParsedCompatibilityRow,
  mode: CompatibilityValidationMode
) {
  const issues: SnapshotImportIssueInput[] = [];
  const { metadata, fact, rowRef, recognizedRevenueUsd, grossMarginUsd } = row;

  if (!metadata) {
    if (mode === "understanding_doc_strict") {
      validateUnderstandingDocRowFormula(row);
    }
    return issues;
  }

  if ("row_semantics" in metadata) {
    const rowSemantics = parseMetadataString(metadata.row_semantics, "row_semantics", rowRef);

    if (
      rowSemantics !== "compatibility_member_month_fact" &&
      rowSemantics !== "hybrid_monthly_override_fact"
    ) {
      throw new Error(
        `row_semantics must equal "compatibility_member_month_fact" or "hybrid_monthly_override_fact" in extra_json (${rowRef}).`
      );
    }
  }

  if ("source_of_truth_reference" in metadata) {
    const sourceOfTruth = parseMetadataString(
      metadata.source_of_truth_reference,
      "source_of_truth_reference",
      rowRef
    );

    if (sourceOfTruth !== "understanding_doc_fixed") {
      throw new Error(`source_of_truth_reference must equal "understanding_doc_fixed" in extra_json (${rowRef}).`);
    }
  }

  if ("canonical_translation_ready" in metadata) {
    parseMetadataBoolean(metadata.canonical_translation_ready, "canonical_translation_ready", rowRef);
  }

  if ("business_event_family" in metadata) {
    parseMetadataStringArray(metadata.business_event_family, "business_event_family", rowRef);
  }

  if ("active_roles" in metadata) {
    parseMetadataStringArray(metadata.active_roles, "active_roles", rowRef);
  }

  if ("active_qualifications" in metadata) {
    parseMetadataStringArray(metadata.active_qualifications, "active_qualifications", rowRef);
  }

  if ("canonical_entities_expected" in metadata) {
    parseMetadataStringArray(metadata.canonical_entities_expected, "canonical_entities_expected", rowRef);
  }

  const expectedRulePrefix = getExpectedRulePrefix(fact.sourceSystem);
  const globalBreakdownTotal = sumBreakdownRecord(metadata, "global_reward_breakdown_usd", rowRef, {
    expectedPrefix: expectedRulePrefix
  });
  const poolBreakdownTotal = sumBreakdownRecord(metadata, "pool_reward_breakdown_usd", rowRef, {
    expectedPrefix: expectedRulePrefix
  });
  const cashoutBreakdownTotal = sumBreakdownRecord(metadata, "cashout_breakdown_usd", rowRef);
  const sinkBreakdownTotal = sumBreakdownRecord(metadata, "sink_breakdown_usd", rowRef);
  const pcBreakdownTotal = sumBreakdownRecord(metadata, "pc_breakdown", rowRef);
  const spBreakdownTotal = sumBreakdownRecord(metadata, "sp_breakdown", rowRef);

  if (globalBreakdownTotal === null && fact.globalRewardUsd > 0) {
    issues.push({
      severity: "WARNING",
      issueType: "missing_rule_tagged_breakdown",
      message: "extra_json is missing global_reward_breakdown_usd while global_reward_usd is non-zero.",
      rowRef
    });
  }

  if (poolBreakdownTotal === null && fact.poolRewardUsd > 0) {
    issues.push({
      severity: "WARNING",
      issueType: "missing_rule_tagged_breakdown",
      message: "extra_json is missing pool_reward_breakdown_usd while pool_reward_usd is non-zero.",
      rowRef
    });
  }

  if (cashoutBreakdownTotal === null && fact.cashoutUsd > 0) {
    issues.push({
      severity: "ERROR",
      issueType: "missing_rule_tagged_breakdown",
      message: "extra_json is missing cashout_breakdown_usd while cashout_usd is non-zero.",
      rowRef
    });
  }

  if (sinkBreakdownTotal === null && fact.sinkSpendUsd > 0) {
    issues.push({
      severity: "ERROR",
      issueType: "missing_rule_tagged_breakdown",
      message: "extra_json is missing sink_breakdown_usd while sink_spend_usd is non-zero.",
      rowRef
    });
  }

  if (pcBreakdownTotal === null && fact.pcVolume > 0) {
    issues.push({
      severity: "WARNING",
      issueType: "missing_rule_tagged_breakdown",
      message: "extra_json is missing pc_breakdown while pc_volume is non-zero.",
      rowRef
    });
  }

  if (spBreakdownTotal === null && fact.spRewardBasis > 0) {
    issues.push({
      severity: "WARNING",
      issueType: "missing_rule_tagged_breakdown",
      message: "extra_json is missing sp_breakdown while sp_reward_basis is non-zero.",
      rowRef
    });
  }

  if (globalBreakdownTotal !== null) {
    assertCloseEnough(globalBreakdownTotal, fact.globalRewardUsd, "global_reward_breakdown_usd", rowRef);
  }

  if (poolBreakdownTotal !== null) {
    assertCloseEnough(poolBreakdownTotal, fact.poolRewardUsd, "pool_reward_breakdown_usd", rowRef);
  }

  if (cashoutBreakdownTotal !== null) {
    assertCloseEnough(cashoutBreakdownTotal, fact.cashoutUsd, "cashout_breakdown_usd", rowRef);
  }

  if (sinkBreakdownTotal !== null) {
    assertCloseEnough(sinkBreakdownTotal, fact.sinkSpendUsd, "sink_breakdown_usd", rowRef);
  }

  if (pcBreakdownTotal !== null) {
    assertCloseEnough(pcBreakdownTotal, fact.pcVolume, "pc_breakdown", rowRef);
  }

  if (spBreakdownTotal !== null) {
    assertCloseEnough(spBreakdownTotal, fact.spRewardBasis, "sp_breakdown", rowRef);
  }

  const recognizedRevenueBasis = getOptionalMetadataRecord(metadata, "recognized_revenue_basis", rowRef);

  if (recognizedRevenueBasis && recognizedRevenueUsd !== null) {
    const normalizedSourceSystem = normalizeSourceSystemCode(fact.sourceSystem);

    if (normalizedSourceSystem === "IBLOOMING" && "platform_revenue_usd" in recognizedRevenueBasis) {
      throw new Error(
        "recognized_revenue_basis.platform_revenue_usd is no longer accepted for iblooming rows; use recognized_revenue_basis.ib_platform_revenue_usd instead."
      );
    }

    const expectedRecognizedRevenueUsd =
      normalizedSourceSystem === "BGC"
        ? getOptionalMetadataNumber(recognizedRevenueBasis, "entry_fee_usd", rowRef)
        : getOptionalMetadataNumber(recognizedRevenueBasis, "ib_platform_revenue_usd", rowRef);

    if (expectedRecognizedRevenueUsd !== null) {
      assertCloseEnough(expectedRecognizedRevenueUsd, recognizedRevenueUsd, "recognized_revenue_basis", rowRef);
    }
  }

  const grossMarginBasis = getOptionalMetadataRecord(metadata, "gross_margin_basis", rowRef);

  if (grossMarginBasis && grossMarginUsd !== null) {
    const expectedGrossMarginUsd = getOptionalMetadataNumber(grossMarginBasis, "gross_margin_usd", rowRef);

    if (expectedGrossMarginUsd !== null) {
      assertCloseEnough(expectedGrossMarginUsd, grossMarginUsd, "gross_margin_basis", rowRef);
    }
  }

  const accountabilityChecks = getOptionalMetadataRecord(metadata, "accountability_checks", rowRef);

  if (accountabilityChecks) {
    for (const fieldName of [
      "global_reward_breakdown_matches_total",
      "pool_reward_breakdown_matches_total",
      "gross_sale_split_matches_sink_total"
    ] as const) {
      if (fieldName in accountabilityChecks) {
        const matches = parseMetadataBoolean(accountabilityChecks[fieldName], fieldName, rowRef);

        if (!matches) {
          throw new Error(`${fieldName} is marked false in extra_json (${rowRef}).`);
        }
      }
    }

    const cashoutTotalUsd = getOptionalMetadataNumber(accountabilityChecks, "cashout_total_usd", rowRef);
    const sinkTotalUsd = getOptionalMetadataNumber(accountabilityChecks, "sink_total_usd", rowRef);

    if (cashoutTotalUsd !== null) {
      assertCloseEnough(cashoutTotalUsd, fact.cashoutUsd, "accountability_checks.cashout_total_usd", rowRef);
    }

    if (sinkTotalUsd !== null) {
      assertCloseEnough(sinkTotalUsd, fact.sinkSpendUsd, "accountability_checks.sink_total_usd", rowRef);
    }
  }

  if (mode === "understanding_doc_strict") {
    if (isHybridMonthlyOverrideRow(row)) {
      validateHybridMonthlyOverrideRow(row);
    } else {
      validateUnderstandingDocRowFormula(row);
      validateCountAwareCompatibilityContract(row);
      validateCanonicalOnlyRuleGates(row);
    }
  }
  return issues;
}

function buildMemberBgcRankTimeline(rows: ParsedCompatibilityRow[]) {
  const rowsByMember = new Map<string, ParsedCompatibilityRow[]>();

  for (const row of rows) {
    const sourceSystem = normalizeSourceSystemCode(row.fact.sourceSystem);

    if (sourceSystem !== "BGC") {
      continue;
    }

    const bucket = rowsByMember.get(row.fact.memberKey) ?? [];
    bucket.push(row);
    rowsByMember.set(row.fact.memberKey, bucket);
  }

  const timelineByMember = new Map<string, Array<{ periodIndex: number; periodKey: string; rank: number }>>();

  for (const [memberKey, memberRows] of rowsByMember.entries()) {
    const rankByPeriod = new Map<string, number>();

    for (const row of memberRows) {
      const currentRank = getBgcTierRankFromRow(row);

      if (currentRank === null) {
        continue;
      }

      const existingRank = rankByPeriod.get(row.fact.periodKey) ?? 0;
      rankByPeriod.set(row.fact.periodKey, Math.max(existingRank, currentRank));
    }

    const timeline = Array.from(rankByPeriod.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([periodKey, rank]) => ({
        periodKey,
        periodIndex: periodToIndex(periodKey),
        rank
      }));

    timelineByMember.set(memberKey, timeline);
  }

  return timelineByMember;
}

function getMemberBgcRankAtOrBefore(
  timelineByMember: Map<string, Array<{ periodIndex: number; periodKey: string; rank: number }>>,
  memberKey: string,
  periodKey: string
) {
  const timeline = timelineByMember.get(memberKey);

  if (!timeline || timeline.length === 0) {
    return null;
  }

  const targetIndex = periodToIndex(periodKey);
  let lastRank: number | null = null;

  for (const point of timeline) {
    if (point.periodIndex > targetIndex) {
      break;
    }

    lastRank = point.rank;
  }

  return lastRank;
}

function validateCompatibilityMemberHistory(rows: ParsedCompatibilityRow[]) {
  const issues: SnapshotImportIssueInput[] = [];
  const rowsByMemberSource = new Map<string, ParsedCompatibilityRow[]>();
  const rowsByMember = new Map<string, ParsedCompatibilityRow[]>();
  const ibJoinPeriodByMember = new Map<string, string>();
  const bgcRankTimeline = buildMemberBgcRankTimeline(rows);

  for (const row of rows) {
    if (isHybridMonthlyOverrideRow(row)) {
      continue;
    }

    const memberSourceKey = `${row.fact.memberKey}::${normalizeSourceSystemCode(row.fact.sourceSystem)}`;
    const memberSourceRows = rowsByMemberSource.get(memberSourceKey) ?? [];
    memberSourceRows.push(row);
    rowsByMemberSource.set(memberSourceKey, memberSourceRows);

    const memberRows = rowsByMember.get(row.fact.memberKey) ?? [];
    memberRows.push(row);
    rowsByMember.set(row.fact.memberKey, memberRows);

    if (normalizeSourceSystemCode(row.fact.sourceSystem) === "IBLOOMING" && row.memberJoinPeriod) {
      const existingJoinPeriod = ibJoinPeriodByMember.get(row.fact.memberKey);

      if (!existingJoinPeriod || row.memberJoinPeriod.localeCompare(existingJoinPeriod) < 0) {
        ibJoinPeriodByMember.set(row.fact.memberKey, row.memberJoinPeriod);
      }
    }
  }

  for (const [memberSourceKey, memberRowsRaw] of rowsByMemberSource.entries()) {
    const memberRows = memberRowsRaw.slice().sort((left, right) => left.fact.periodKey.localeCompare(right.fact.periodKey));
    const [memberKey, sourceSystem] = memberSourceKey.split("::");
    let canonicalJoinPeriod: string | null = null;
    let highestBgcRankSeen = 0;

    for (const row of memberRows) {
      if (row.memberJoinPeriod !== null) {
        if (canonicalJoinPeriod === null) {
          canonicalJoinPeriod = row.memberJoinPeriod;
        } else if (canonicalJoinPeriod !== row.memberJoinPeriod) {
          issues.push({
            severity: "ERROR",
            issueType: "member_join_period_inconsistent",
            message: `member_join_period must stay immutable for ${memberKey}/${sourceSystem}.`,
            rowRef: row.rowRef
          });
        }
      }

      const effectiveJoinPeriod = row.memberJoinPeriod ?? canonicalJoinPeriod;

      if (effectiveJoinPeriod !== null && periodToIndex(row.fact.periodKey) < periodToIndex(effectiveJoinPeriod)) {
        issues.push({
          severity: "ERROR",
          issueType: "member_join_period_after_activity",
          message: `period_key cannot be earlier than member_join_period for ${memberKey}/${sourceSystem}.`,
          rowRef: row.rowRef
        });
      }

      if (sourceSystem === "BGC") {
        const memberTier = normalizeMemberTier(row.fact.memberTier);

        if (memberTier !== null) {
          if (!isKnownBgcTier(memberTier)) {
            issues.push({
              severity: "ERROR",
              issueType: "bgc_member_tier_invalid",
              message: `BGC member_tier must be a documented affiliate level.`,
              rowRef: row.rowRef
            });
          } else {
            const currentRank = BGC_TIER_RULES[memberTier].rank;

            if (currentRank < highestBgcRankSeen) {
              issues.push({
                severity: "ERROR",
                issueType: "bgc_tier_regression",
                message: `BGC affiliate level cannot regress across periods for ${memberKey}.`,
                rowRef: row.rowRef
              });
            } else {
              highestBgcRankSeen = currentRank;
            }
          }
        }
      }
    }
  }

  for (const [memberKey, memberRowsRaw] of rowsByMember.entries()) {
    const memberRows = memberRowsRaw.slice().sort((left, right) => left.fact.periodKey.localeCompare(right.fact.periodKey));
    let wecAchievedPeriod: string | null = null;

    for (const row of memberRows) {
      const activeQualifications = getActiveQualificationTags(row.metadata, row.rowRef);
      const hasYear1 = activeQualifications.includes(CPR_YEAR_1_TAG);
      const hasYear2 = activeQualifications.includes(CPR_YEAR_2_TAG);

      if (hasYear1 && hasYear2) {
        issues.push({
          severity: "ERROR",
          issueType: "cpr_qualification_conflict",
          message: `CPR year 1 and year 2 qualifications cannot be active at the same time for ${memberKey}.`,
          rowRef: row.rowRef
        });
      }

      if (hasYear1 || hasYear2) {
        const ibJoinPeriod =
          ibJoinPeriodByMember.get(memberKey) ??
          (normalizeSourceSystemCode(row.fact.sourceSystem) === "IBLOOMING" ? row.memberJoinPeriod : null);

        if (!ibJoinPeriod) {
          issues.push({
            severity: "ERROR",
            issueType: "cpr_join_period_missing",
            message: `CPR qualification cannot be validated without an iblooming member_join_period for ${memberKey}.`,
            rowRef: row.rowRef
          });
        } else {
          const monthsSinceJoin = periodToIndex(row.fact.periodKey) - periodToIndex(ibJoinPeriod);
          const expectedYear = monthsSinceJoin < 12 ? 1 : 2;

          if (hasYear1 && expectedYear !== 1) {
            issues.push({
              severity: "ERROR",
              issueType: "cpr_year_transition_invalid",
              message: `CPR year 1 cannot stay active once the iblooming join age reaches 12 months for ${memberKey}.`,
              rowRef: row.rowRef
            });
          }

          if (hasYear2 && expectedYear !== 2) {
            issues.push({
              severity: "ERROR",
              issueType: "cpr_year_transition_invalid",
              message: `CPR year 2 cannot activate before the iblooming join age reaches 12 months for ${memberKey}.`,
              rowRef: row.rowRef
            });
          }
        }
      }

      if (hasWecEvidence(row)) {
        const bgcRank = getMemberBgcRankAtOrBefore(bgcRankTimeline, memberKey, row.fact.periodKey);

        if (bgcRank === null || bgcRank < PIONEER_BGC_RANK) {
          issues.push({
            severity: "ERROR",
            issueType: "wec_tier_ineligible",
            message: `WEC status/qualification is only valid after the member reaches Pioneer or Special in BGC (${memberKey}).`,
            rowRef: row.rowRef
          });
        }

        if (wecAchievedPeriod === null) {
          wecAchievedPeriod = row.fact.periodKey;
        }
      }
    }

    if (wecAchievedPeriod !== null) {
      for (const row of memberRows) {
        if (normalizeSourceSystemCode(row.fact.sourceSystem) !== "BGC") {
          continue;
        }

        if (row.fact.periodKey.localeCompare(wecAchievedPeriod) > 0 && !hasWecEvidence(row)) {
          issues.push({
            severity: "ERROR",
            issueType: "wec_permanence_broken",
            message: `WEC status is permanent once achieved and must remain visible on subsequent BGC rows for ${memberKey}.`,
            rowRef: row.rowRef
          });
        }
      }
    }
  }

  return issues;
}

function validatePoolConservation(rows: ParsedCompatibilityRow[]) {
  const issues: SnapshotImportIssueInput[] = [];
  const poolAggregates = new Map<
    string,
    {
      periodKey: string;
      poolCode: string;
      distributionCycle: string;
      distributionMode: string;
      fundingAmount: number;
      distributionAmount: number;
      recipientCount: number;
      shareCountTotal: number;
      uniqueRecipients: Set<string>;
      summedRecipientShareCount: number;
      summedRowDistributionAmount: number;
      fundingEntryCount: number | null;
      distributionEntryCount: number | null;
      rowRefs: string[];
    }
  >();

  for (const row of rows) {
    if (isAggregateCompatibilityRow(row)) {
      continue;
    }

    if (!row.metadata) {
      continue;
    }

    const poolRewardBreakdown = getOptionalMetadataRecord(row.metadata, "pool_reward_breakdown_usd", row.rowRef);

    if (!poolRewardBreakdown) {
      continue;
    }

    const poolFundingBasis = parsePoolFundingBasis(row.metadata, row.rowRef);
    const poolShareSnapshot = parsePoolShareSnapshot(row.metadata, row.rowRef);

    for (const [poolCode, distributionValue] of Object.entries(poolRewardBreakdown)) {
      const fundingBasis = poolFundingBasis.get(poolCode);
      const shareSnapshot = poolShareSnapshot.get(poolCode);

      if (!fundingBasis || !shareSnapshot) {
        continue;
      }

      const aggregateKey = `${row.fact.periodKey}::${poolCode}`;
      const distributionAmount = parseMetadataNumber(
        distributionValue,
        `pool_reward_breakdown_usd.${poolCode}`,
        row.rowRef
      );
      const aggregate =
        poolAggregates.get(aggregateKey) ?? {
          periodKey: row.fact.periodKey,
          poolCode,
          distributionCycle: fundingBasis.distributionCycle,
          distributionMode: shareSnapshot.distributionMode,
          fundingAmount: fundingBasis.fundingAmount,
          distributionAmount: fundingBasis.distributionAmount,
          recipientCount: shareSnapshot.recipientCount,
          shareCountTotal: shareSnapshot.shareCountTotal,
          uniqueRecipients: new Set<string>(),
          summedRecipientShareCount: 0,
          summedRowDistributionAmount: 0,
          fundingEntryCount: fundingBasis.fundingEntryCount,
          distributionEntryCount: fundingBasis.distributionEntryCount,
          rowRefs: []
        };

      if (
        aggregate.distributionCycle !== fundingBasis.distributionCycle ||
        aggregate.distributionMode !== shareSnapshot.distributionMode ||
        Math.abs(aggregate.fundingAmount - fundingBasis.fundingAmount) > 0.01 ||
        Math.abs(aggregate.distributionAmount - fundingBasis.distributionAmount) > 0.01 ||
        aggregate.recipientCount !== shareSnapshot.recipientCount ||
        Math.abs(aggregate.shareCountTotal - shareSnapshot.shareCountTotal) > 0.01
      ) {
        issues.push({
          severity: "ERROR",
          issueType: "pool_basis_inconsistent",
          message: `Pool basis metadata is inconsistent across rows for ${poolCode} in ${row.fact.periodKey}.`,
          rowRef: row.rowRef
        });
        continue;
      }

      aggregate.uniqueRecipients.add(row.fact.memberKey);
      aggregate.summedRecipientShareCount = round2(
        aggregate.summedRecipientShareCount + shareSnapshot.recipientShareCount
      );
      aggregate.summedRowDistributionAmount = round2(
        aggregate.summedRowDistributionAmount + distributionAmount
      );
      aggregate.rowRefs.push(row.rowRef);
      poolAggregates.set(aggregateKey, aggregate);
    }
  }

  for (const aggregate of poolAggregates.values()) {
    if (aggregate.distributionAmount > aggregate.fundingAmount + 0.01) {
      issues.push({
        severity: "ERROR",
        issueType: "pool_distribution_exceeds_funding",
        message: `Pool distribution cannot exceed funding for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
        rowRef: aggregate.rowRefs[0] ?? null
      });
    }

    if (Math.abs(aggregate.summedRowDistributionAmount - aggregate.distributionAmount) > 0.01) {
      issues.push({
        severity: "ERROR",
        issueType: "pool_distribution_total_mismatch",
        message: `Summed row distributions do not match pool distribution total for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
        rowRef: aggregate.rowRefs[0] ?? null
      });
    }

    if (Math.abs(aggregate.distributionAmount - aggregate.fundingAmount) > 0.01) {
      issues.push({
        severity: "ERROR",
        issueType: "pool_funding_not_fully_distributed",
        message: `Compatibility CSV pool rows must represent fully distributed pools for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
        rowRef: aggregate.rowRefs[0] ?? null
      });
    }

    if (aggregate.uniqueRecipients.size !== aggregate.recipientCount) {
      issues.push({
        severity: "ERROR",
        issueType: "pool_recipient_count_mismatch",
        message: `Unique recipient count does not match pool share snapshot for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
        rowRef: aggregate.rowRefs[0] ?? null
      });
    }

    if (aggregate.distributionMode === "EQUAL_SHARE") {
      if (Math.abs(aggregate.shareCountTotal - aggregate.recipientCount) > 0.01) {
        issues.push({
          severity: "ERROR",
          issueType: "pool_equal_share_total_invalid",
          message: `EQUAL_SHARE pools must have share_count_total equal to recipient_count for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
          rowRef: aggregate.rowRefs[0] ?? null
        });
      }

      if (Math.abs(aggregate.summedRecipientShareCount - aggregate.recipientCount) > 0.01) {
        issues.push({
          severity: "ERROR",
          issueType: "pool_equal_share_recipient_mismatch",
          message: `EQUAL_SHARE pools must contribute one share per recipient for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
          rowRef: aggregate.rowRefs[0] ?? null
        });
      }
    }

    if (aggregate.distributionMode === "WEIGHTED_SHARE") {
      if (Math.abs(aggregate.summedRecipientShareCount - aggregate.shareCountTotal) > 0.01) {
        issues.push({
          severity: "ERROR",
          issueType: "pool_weighted_share_total_mismatch",
          message: `Summed recipient share counts do not match share_count_total for ${aggregate.poolCode} in ${aggregate.periodKey}.`,
          rowRef: aggregate.rowRefs[0] ?? null
        });
      }
    }
  }

  return issues;
}

function buildParsedCompatibilityRowFromFact(
  fact: SnapshotMemberMonthFactInput,
  rowIndex: number,
  poolBasisByPayoutKey: Map<string, PoolBasisByPayoutKeyEntry>,
  canonicalSnapshotId: string | null | undefined
): ParsedCompatibilityRow {
  const rowRef = `row:${rowIndex + 1}`;
  const metadata = normalizeCompatibilityMetadataForValidation(
    isRecord(fact.metadataJson) ? fact.metadataJson : null,
    fact,
    poolBasisByPayoutKey,
    canonicalSnapshotId
  );
  fact.metadataJson = metadata as SnapshotMemberMonthFactInput["metadataJson"];
  const row: ParsedCompatibilityRow = {
    rowRef,
    fact,
    metadata,
    recognizedRevenueUsd: extractMetadataNumber(
      metadata,
      rowRef,
      "recognized_revenue_usd",
      ["recognizedRevenueUsd"]
    ),
    grossMarginUsd: extractMetadataNumber(
      metadata,
      rowRef,
      "gross_margin_usd",
      ["grossMarginUsd"]
    ),
    memberJoinPeriod: extractMetadataPeriod(
      metadata,
      rowRef,
      "member_join_period",
      ["memberJoinPeriod"]
    ),
    isAffiliate: extractMetadataBoolean(metadata, rowRef, "is_affiliate", ["isAffiliate"]),
    crossAppActive: extractMetadataBoolean(
      metadata,
      rowRef,
      "cross_app_active",
      ["crossAppActive"]
    )
  };
  const canonicalOnlyRuleFamilies = detectCanonicalOnlyRuleFamilies(row);

  if (
    canonicalOnlyRuleFamilies.length > 0 &&
    canonicalSnapshotId &&
    row.metadata &&
    !("canonical_rule_gate" in row.metadata)
  ) {
    row.metadata.canonical_rule_gate = {
      strict_mode: "understanding_doc_strict",
      validated_via: "canonical_json",
      requires_canonical_json: true,
      canonical_only_rule_families: [...canonicalOnlyRuleFamilies].sort()
    };
  }

  return row;
}

export function validateCanonicalRuleGateBacking(
  facts: SnapshotMemberMonthFactInput[],
  options: ValidateCanonicalRuleGateBackingOptions = {}
) {
  const issues: SnapshotImportIssueInput[] = [];
  const canonicalEntityCount = options.canonicalEntityCount ?? 0;
  const canonicalSourceSnapshotKey = options.canonicalSourceSnapshotKey ?? null;

  for (const [index, fact] of facts.entries()) {
    const metadata = isRecord(fact.metadataJson) ? fact.metadataJson : null;
    const rowRef = `row:${index + 1}`;

    if (!metadata) {
      continue;
    }

    const gate = getOptionalMetadataRecord(metadata, "canonical_rule_gate", rowRef);

    if (!gate) {
      continue;
    }

    const validatedVia = parseMetadataString(gate.validated_via, "canonical_rule_gate.validated_via", rowRef);
    const requiresCanonicalJson = parseMetadataBoolean(
      gate.requires_canonical_json,
      "canonical_rule_gate.requires_canonical_json",
      rowRef
    );

    if (validatedVia !== "canonical_json" || !requiresCanonicalJson) {
      continue;
    }

    const rowCanonicalSnapshotId =
      "canonical_snapshot_id" in metadata
        ? parseMetadataString(metadata.canonical_snapshot_id, "canonical_snapshot_id", rowRef)
        : null;

    if (canonicalEntityCount <= 0) {
      issues.push({
        severity: "ERROR",
        issueType: "canonical_gate_unbacked",
        message:
          "Rows with canonical_rule_gate.validated_via=canonical_json require stored canonical snapshot data; compatibility CSV cannot self-attest canonical-only rule families.",
        rowRef
      });
      continue;
    }

    if (!canonicalSourceSnapshotKey || !rowCanonicalSnapshotId || rowCanonicalSnapshotId !== canonicalSourceSnapshotKey) {
      issues.push({
        severity: "ERROR",
        issueType: "canonical_gate_snapshot_mismatch",
        message:
          "Rows with canonical_rule_gate.validated_via=canonical_json must match the snapshot canonicalSourceSnapshotKey.",
        rowRef
      });
    }
  }

  return issues;
}

export function validateCompatibilitySnapshotFacts(
  facts: SnapshotMemberMonthFactInput[],
  options: ValidateCompatibilitySnapshotFactsOptions = {}
) {
  const mode = options.mode ?? "understanding_doc_strict";
  const issues: SnapshotImportIssueInput[] = [];
  const validatedRows: ParsedCompatibilityRow[] = [];
  const seenKeys = new Set<string>();
  const poolBasisByPayoutKey = buildPoolBasisByPayoutKey(options.poolPeriodFacts ?? []);

  for (const [index, fact] of facts.entries()) {
    try {
      snapshotMemberMonthFactSchema.parse(fact);
      const row = buildParsedCompatibilityRowFromFact(
        fact,
        index,
        poolBasisByPayoutKey,
        options.canonicalSnapshotId
      );

      issues.push(...validateCompatibilityRowMetadata(row, mode));

      const uniqueKey = [fact.periodKey, fact.memberKey, fact.sourceSystem].join("::");

      if (seenKeys.has(uniqueKey)) {
        issues.push({
          severity: "ERROR",
          issueType: "duplicate_member_month_fact",
          message: "Duplicate period/member/source fact detected within the snapshot data.",
          rowRef: row.rowRef
        });
        continue;
      }

      seenKeys.add(uniqueKey);
      validatedRows.push(row);
    } catch (error) {
      issues.push({
        severity: "ERROR",
        issueType: "row_value_invalid",
        message: error instanceof Error ? error.message : "Snapshot fact contains invalid values.",
        rowRef: `row:${index + 1}`
      });
    }
  }

  if (mode === "understanding_doc_strict") {
    issues.push(...validateCompatibilityMemberHistory(validatedRows));
    issues.push(...validatePoolConservation(validatedRows));
  }

  return {
    rowCountRaw: facts.length,
    facts: validatedRows.map((row) => row.fact),
    issues
  };
}

export function parseCompatibilityCsvSnapshotText(
  snapshotText: string,
  options: ParseCompatibilityCsvSnapshotOptions = {}
) {
  const mode = options.mode ?? "understanding_doc_strict";
  const records = parseCsvRecords(snapshotText);

  if (records.length === 0) {
    throw new Error("CSV import file does not contain any data rows.");
  }

  const seenKeys = new Set<string>();
  const issues: SnapshotImportIssueInput[] = [];
  const validatedRows: ParsedCompatibilityRow[] = [];

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
      const isAffiliate = parseOptionalBooleanField(rawRow.data.is_affiliate, "is_affiliate", rowRef);
      const crossAppActive = parseOptionalBooleanField(
        rawRow.data.cross_app_active,
        "cross_app_active",
        rowRef
      );
      const extraJson = parseOptionalJsonRecordField(rawRow.data.extra_json, "extra_json", rowRef);
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
        spRewardBasis: parseNumericField(rawRow.data.sp_reward_basis, "sp_reward_basis", rowRef),
        globalRewardUsd: parseNumericField(rawRow.data.global_reward_usd, "global_reward_usd", rowRef),
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
      const row = buildParsedCompatibilityRowFromFact(
        fact,
        index + 1,
        new Map(),
        null
      );

      issues.push(...validateCompatibilityRowMetadata(row, mode));

      const uniqueKey = [fact.periodKey, fact.memberKey, fact.sourceSystem].join("::");

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
      validatedRows.push(row);
    } catch (error) {
      issues.push({
        severity: "ERROR",
        issueType: "row_value_invalid",
        message: error instanceof Error ? error.message : "CSV row contains invalid values.",
        rowRef
      });
    }
  }

  if (mode === "understanding_doc_strict") {
    issues.push(...validateCompatibilityMemberHistory(validatedRows));
    issues.push(...validatePoolConservation(validatedRows));
  }

  return {
    rowCountRaw: records.length,
    facts: validatedRows.map((row) => row.fact),
    issues
  };
}
