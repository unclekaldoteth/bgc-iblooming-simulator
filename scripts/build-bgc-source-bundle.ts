import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { snapshotImportCsvHeaders, snapshotImportCsvRowSchema } from "@bgc-alpha/schemas";

const RAW_FILE_NAMES = {
  global2024: "2024 Global Profit Sharing from Turnover - Sheet1.csv",
  global2025: "2025 1st Half Global Profit Sharing from Turnover - Sheet1.csv",
  upgrades: "BGC New & Upgrade Affiliates - Upgrade.csv",
  newlyJoined: "Copy of BGC New & Upgrade Affiliates - Newly Joined.csv",
  cpVideos: "CP Videos Sold - Sheet1.csv",
  wep: "WEP - World Executive Program Application Form (Responses) - Form Responses 1.csv",
  imatrix: "iMatrix Records - Sheet1.csv",
  params: "Copy of SIMULATION SHEETS v0.1 - PARAMS.csv",
  dataAgg: "Copy of SIMULATION SHEETS v0.1 - DATA_AGG.csv"
} as const;

const OPTIONAL_HEADERS = [
  "recognized_revenue_usd",
  "gross_margin_usd",
  "member_join_period",
  "is_affiliate",
  "cross_app_active",
  "extra_json"
] as const;

const OUTPUT_HEADERS = [...snapshotImportCsvHeaders, ...OPTIONAL_HEADERS] as const;
const DEFAULT_OUTPUT_PATH = "examples/bgc-source-bundle-canonical.csv";
const GLOBAL_2024_PERIOD = "2024-12";
const GLOBAL_2025_PERIOD = "2025-06";
const PARAMS_TEMPLATE_PATH = "examples/params-tab-simulator-proxy-10-member.csv";
const PARAMS_POOL_REWARD_CUTOFF = "2025-03";
const NUMERIC_TOP_UP_FIELDS = [
  "pcVolume",
  "spRewardBasis",
  "globalRewardUsd",
  "poolRewardUsd",
  "cashoutUsd",
  "sinkSpendUsd",
  "recognizedRevenueUsd",
  "grossMarginUsd"
] as const;

const TOP_UP_FIELD_DISTRIBUTION_FALLBACKS: Record<NumericTopUpField, NumericTopUpField[]> = {
  pcVolume: ["recognizedRevenueUsd", "spRewardBasis", "cashoutUsd", "globalRewardUsd", "grossMarginUsd"],
  spRewardBasis: ["globalRewardUsd", "cashoutUsd", "recognizedRevenueUsd", "pcVolume", "grossMarginUsd"],
  globalRewardUsd: ["cashoutUsd", "spRewardBasis", "recognizedRevenueUsd", "pcVolume", "grossMarginUsd"],
  poolRewardUsd: ["globalRewardUsd", "spRewardBasis", "cashoutUsd", "recognizedRevenueUsd", "pcVolume"],
  cashoutUsd: ["globalRewardUsd", "spRewardBasis", "recognizedRevenueUsd", "pcVolume", "grossMarginUsd"],
  sinkSpendUsd: ["recognizedRevenueUsd", "pcVolume", "spRewardBasis", "cashoutUsd", "globalRewardUsd"],
  recognizedRevenueUsd: ["pcVolume", "grossMarginUsd", "spRewardBasis", "cashoutUsd", "globalRewardUsd"],
  grossMarginUsd: ["recognizedRevenueUsd", "pcVolume", "spRewardBasis", "cashoutUsd", "globalRewardUsd"]
};

type BgcJoinRule = {
  entryFeeUsd: number;
  pcVolume: number;
  spRewardBasis: number;
};

const BGC_JOIN_RULES_BY_TIER: Record<string, BgcJoinRule> = {
  pathfinder: {
    entryFeeUsd: 100,
    pcVolume: 10_000,
    spRewardBasis: 70
  },
  voyager: {
    entryFeeUsd: 500,
    pcVolume: 50_000,
    spRewardBasis: 350
  },
  explorer: {
    entryFeeUsd: 1_725,
    pcVolume: 172_500,
    spRewardBasis: 1_207
  },
  pioneer: {
    entryFeeUsd: 2_875,
    pcVolume: 287_500,
    spRewardBasis: 2_012
  },
  special: {
    entryFeeUsd: 11_500,
    pcVolume: 1_150_000,
    spRewardBasis: 8_050
  }
};

const BGC_JOIN_RULES_BY_ENTRY_FEE = new Map<number, BgcJoinRule>(
  Object.values(BGC_JOIN_RULES_BY_TIER).map((rule) => [rule.entryFeeUsd, rule])
);

type OutputHeader = (typeof OUTPUT_HEADERS)[number];

type CanonicalFact = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier: string;
  groupKey: string;
  pcVolume: number;
  spRewardBasis: number;
  globalRewardUsd: number;
  poolRewardUsd: number;
  cashoutUsd: number;
  sinkSpendUsd: number;
  activeMember: boolean;
  recognizedRevenueUsd: number | null;
  grossMarginUsd: number | null;
  memberJoinPeriod: string | null;
  isAffiliate: boolean | null;
  crossAppActive: boolean | null;
  extraJson: Record<string, unknown> | null;
};

type RawUpgradeRow = {
  userNo: string;
  displayName: string;
  month: string;
  previousLevel: string;
  currentLevel: string;
  isUpgraded: string;
};

type RawWepRow = {
  timestamp: string;
  name: string;
  blooGlobalId: string;
  email: string;
  confirmToStartWep: string;
};

type RawNewlyJoinedRow = {
  userNo: string;
  createdAt: string;
  month: string;
  displayName: string;
  levelName: string;
  entryValueUsd: string;
  totalEntryFeePerMonthUsd: string;
  allocationToRewardUsd: string;
};

type RawCpRow = {
  userName: string;
  level: string;
  priceUsd: string;
  purchaseDate: string;
  iBloomingProfit: string;
};

type ParamsMonthlyMetric = {
  periodKey: string;
  pcVolume: number;
  spRewardBasis: number;
  globalRewardUsd: number;
  poolRewardUsd: number;
  cashoutUsd: number;
  sinkSpendUsd: number;
  recognizedRevenueUsd: number;
  grossMarginUsd: number;
};

type ParamsTemplateRow = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier: string;
  groupKey: string;
  activeMember: boolean;
  memberJoinPeriod: string | null;
  isAffiliate: boolean | null;
  crossAppActive: boolean | null;
  pcVolume: number;
  spRewardBasis: number;
  globalRewardUsd: number;
  poolRewardUsd: number;
  cashoutUsd: number;
  sinkSpendUsd: number;
  recognizedRevenueUsd: number;
  grossMarginUsd: number;
};

type FactMap = Map<string, CanonicalFact>;

type NameResolver = {
  resolve: (name: string) => string | null;
};

type NumericTopUpField = (typeof NUMERIC_TOP_UP_FIELDS)[number];

type NumericTopUpValueMap = Record<NumericTopUpField, number>;

function parseArgs(argv: string[]) {
  const args = [...argv];
  let inputDir = process.cwd();
  let outputPath = DEFAULT_OUTPUT_PATH;

  while (args.length > 0) {
    const token = args.shift();

    if (token === "--input-dir") {
      const value = args.shift();

      if (!value) {
        throw new Error("Pass a directory after --input-dir.");
      }

      inputDir = path.resolve(value);
      continue;
    }

    if (token === "--output") {
      const value = args.shift();

      if (!value) {
        throw new Error("Pass a file path after --output.");
      }

      outputPath = value;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    inputDir,
    outputPath: path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath)
  };
}

function roundNumber(value: number, precision = 8) {
  return Number(value.toFixed(precision));
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

async function readCsvRows(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return parseCsvRows(text);
}

function ensurePeriodKey(value: string, context: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(`Invalid period key "${value}" (${context}).`);
  }

  return value;
}

function normalizeMemberId(value: string) {
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const match = /^B?(\d{9})$/.exec(compact);

  return match ? `B${match[1]}` : null;
}

function normalizeTier(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized === "-") {
    return "";
  }

  return normalized.replace(/\s+/g, "-");
}

function normalizeNameKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeTokenKey(value: string) {
  const normalized = normalizeNameKey(value);

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .join(" ");
}

function resolveBgcJoinRule(entryFeeUsd: number, memberTier: string) {
  const byEntryFee = BGC_JOIN_RULES_BY_ENTRY_FEE.get(entryFeeUsd);

  if (byEntryFee) {
    return byEntryFee;
  }

  const normalizedTier = normalizeTier(memberTier);
  return normalizedTier ? (BGC_JOIN_RULES_BY_TIER[normalizedTier] ?? null) : null;
}

function stableHash(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}

function buildSyntheticMemberKey(prefix: string, seed: string) {
  return `${prefix}-${stableHash(seed)}`.toUpperCase();
}

function parseNumber(value: string, context: string) {
  const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();

  if (!cleaned || cleaned === "-" || cleaned === " -") {
    return 0;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number "${value}" (${context}).`);
  }

  return parsed;
}

function parseBooleanString(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return null;
}

function readNumericFactField(fact: CanonicalFact, field: NumericTopUpField) {
  return fact[field] ?? 0;
}

function readMetricValue(metric: ParamsMonthlyMetric, field: NumericTopUpField) {
  return metric[field];
}

function buildTemplateTotalsByField(monthTemplateRows: ParamsTemplateRow[]): NumericTopUpValueMap {
  return Object.fromEntries(
    NUMERIC_TOP_UP_FIELDS.map((field) => [
      field,
      roundNumber(monthTemplateRows.reduce((sum, row) => sum + row[field], 0))
    ])
  ) as NumericTopUpValueMap;
}

function resolveTopUpDistributionBasisField(
  field: NumericTopUpField,
  templateTotals: NumericTopUpValueMap
) {
  const candidateFields = [field, ...TOP_UP_FIELD_DISTRIBUTION_FALLBACKS[field]];

  for (const candidateField of candidateFields) {
    if (templateTotals[candidateField] > 0) {
      return candidateField;
    }
  }

  return null;
}

function allocateGapAcrossRows(
  totalGap: number,
  monthTemplateRows: ParamsTemplateRow[],
  basisField: NumericTopUpField | null
) {
  if (monthTemplateRows.length === 0 || totalGap <= 0) {
    return [] as number[];
  }

  const weights =
    basisField === null
      ? monthTemplateRows.map(() => 1)
      : monthTemplateRows.map((row) => Math.max(0, row[basisField]));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const normalizedWeights =
    totalWeight > 0 ? weights.map((value) => value / totalWeight) : monthTemplateRows.map(() => 1 / monthTemplateRows.length);

  let remainder = roundNumber(totalGap);

  return monthTemplateRows.map((_, index) => {
    if (index === monthTemplateRows.length - 1) {
      return roundNumber(remainder);
    }

    const allocation = roundNumber(totalGap * normalizedWeights[index]);
    remainder = roundNumber(remainder - allocation);
    return allocation;
  });
}

function parsePeriodFromUsDate(value: string) {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);

  if (!match) {
    throw new Error(`Invalid US date "${value}".`);
  }

  return ensurePeriodKey(`${match[3]}-${match[1].padStart(2, "0")}`, value);
}

function parsePeriodFromIsoDateTime(value: string) {
  const match = /^\s*(\d{4})-(\d{2})/.exec(value);

  if (!match) {
    throw new Error(`Invalid ISO datetime "${value}".`);
  }

  return ensurePeriodKey(`${match[1]}-${match[2]}`, value);
}

function monthNameToPeriodKey(year: number, value: string) {
  const monthMap = new Map<string, string>([
    ["jan", "01"],
    ["feb", "02"],
    ["mar", "03"],
    ["apr", "04"],
    ["may", "05"],
    ["jun", "06"],
    ["jul", "07"],
    ["aug", "08"],
    ["sep", "09"],
    ["oct", "10"],
    ["nov", "11"],
    ["dec", "12"]
  ]);
  const month = monthMap.get(value.trim().slice(0, 3).toLowerCase());

  if (!month) {
    throw new Error(`Invalid month label "${value}".`);
  }

  return `${year}-${month}`;
}

function makeFactKey(fact: Pick<CanonicalFact, "periodKey" | "memberKey" | "sourceSystem">) {
  return `${fact.periodKey}::${fact.memberKey}::${fact.sourceSystem}`;
}

function createEmptyFact(base: Pick<CanonicalFact, "periodKey" | "memberKey" | "sourceSystem">) {
  return {
    ...base,
    memberTier: "",
    groupKey: "",
    pcVolume: 0,
    spRewardBasis: 0,
    globalRewardUsd: 0,
    poolRewardUsd: 0,
    cashoutUsd: 0,
    sinkSpendUsd: 0,
    activeMember: false,
    recognizedRevenueUsd: null,
    grossMarginUsd: null,
    memberJoinPeriod: null,
    isAffiliate: null,
    crossAppActive: null,
    extraJson: null
  };
}

function addOptionalAmount(current: number | null, value: number) {
  return current === null ? roundNumber(value) : roundNumber(current + value);
}

function preferString(current: string, incoming: string) {
  return incoming.trim().length > 0 ? incoming.trim() : current;
}

function getTierRank(value: string) {
  const normalized = normalizeTier(value);
  const ranks: Record<string, number> = {
    pathfinder: 1,
    voyager: 2,
    explorer: 3,
    starter: 3,
    pioneer: 4,
    builder: 4,
    special: 5,
    leader: 5
  };

  return ranks[normalized] ?? 0;
}

function preferTier(current: string, incoming: string) {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  return getTierRank(incoming) >= getTierRank(current) ? incoming : current;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeJsonValues(current: unknown, incoming: unknown): unknown {
  if (current === undefined) {
    return cloneJsonValue(incoming);
  }

  if (Array.isArray(current) || Array.isArray(incoming)) {
    const currentItems = Array.isArray(current) ? current : [current];
    const incomingItems = Array.isArray(incoming) ? incoming : [incoming];
    const seen = new Set<string>();
    const merged: unknown[] = [];

    for (const item of [...currentItems, ...incomingItems]) {
      const key = JSON.stringify(item);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(cloneJsonValue(item));
    }

    return merged;
  }

  if (
    typeof current === "object" &&
    current !== null &&
    typeof incoming === "object" &&
    incoming !== null
  ) {
    const result: Record<string, unknown> = {
      ...(current as Record<string, unknown>)
    };

    for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
      result[key] = mergeJsonValues(result[key], value);
    }

    return result;
  }

  if (current === incoming) {
    return cloneJsonValue(current);
  }

  return mergeJsonValues([current], [incoming]);
}

function mergeExtraJson(
  current: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null | undefined
) {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return cloneJsonValue(incoming);
  }

  return mergeJsonValues(current, incoming) as Record<string, unknown>;
}

function ensureExtraJsonRecord(
  extraJson: Record<string, unknown> | null,
  key: string
): Record<string, unknown> {
  const target =
    extraJson && typeof extraJson[key] === "object" && extraJson[key] !== null && !Array.isArray(extraJson[key])
      ? (extraJson[key] as Record<string, unknown>)
      : {};

  if (!extraJson) {
    throw new Error(`extraJson must exist before ensuring nested record ${key}.`);
  }

  extraJson[key] = target;
  return target;
}

function addExtraJsonNumericValue(
  fact: CanonicalFact,
  key: string,
  nestedKey: string,
  amount: number
) {
  fact.extraJson ??= {};
  const target = ensureExtraJsonRecord(fact.extraJson, key);
  const currentValue = typeof target[nestedKey] === "number" ? target[nestedKey] : 0;
  target[nestedKey] = roundNumber(currentValue + amount);
}

function upsertFact(
  facts: FactMap,
  base: Pick<CanonicalFact, "periodKey" | "memberKey" | "sourceSystem">,
  updates: Partial<CanonicalFact>
) {
  const key = makeFactKey(base);
  const fact = facts.get(key) ?? createEmptyFact(base);

  fact.memberTier = preferTier(fact.memberTier, normalizeTier(updates.memberTier ?? ""));
  fact.groupKey = preferString(fact.groupKey, updates.groupKey ?? "");
  fact.pcVolume = roundNumber(fact.pcVolume + (updates.pcVolume ?? 0));
  fact.spRewardBasis = roundNumber(fact.spRewardBasis + (updates.spRewardBasis ?? 0));
  fact.globalRewardUsd = roundNumber(fact.globalRewardUsd + (updates.globalRewardUsd ?? 0));
  fact.poolRewardUsd = roundNumber(fact.poolRewardUsd + (updates.poolRewardUsd ?? 0));
  fact.cashoutUsd = roundNumber(fact.cashoutUsd + (updates.cashoutUsd ?? 0));
  fact.sinkSpendUsd = roundNumber(fact.sinkSpendUsd + (updates.sinkSpendUsd ?? 0));

  if (typeof updates.recognizedRevenueUsd === "number") {
    fact.recognizedRevenueUsd = addOptionalAmount(
      fact.recognizedRevenueUsd,
      updates.recognizedRevenueUsd
    );
  }

  if (typeof updates.grossMarginUsd === "number") {
    fact.grossMarginUsd = addOptionalAmount(fact.grossMarginUsd, updates.grossMarginUsd);
  }

  if (updates.memberJoinPeriod) {
    fact.memberJoinPeriod = updates.memberJoinPeriod;
  }

  if (updates.activeMember === true) {
    fact.activeMember = true;
  }

  if (updates.isAffiliate === true) {
    fact.isAffiliate = true;
  }

  if (updates.crossAppActive === true) {
    fact.crossAppActive = true;
  }

  fact.extraJson = mergeExtraJson(fact.extraJson, updates.extraJson);

  facts.set(key, fact);
  return fact;
}

function buildNameResolver(upgrades: RawUpgradeRow[], wepRows: RawWepRow[]): NameResolver {
  const exactNameToId = new Map<string, string | null>();
  const tokenNameToId = new Map<string, string | null>();

  const register = (name: string, memberId: string | null) => {
    if (!memberId) {
      return;
    }

    const exactKey = normalizeNameKey(name);
    const tokenKey = normalizeTokenKey(name);

    for (const [map, key] of [
      [exactNameToId, exactKey],
      [tokenNameToId, tokenKey]
    ] as const) {
      if (!key) {
        continue;
      }

      const current = map.get(key);

      if (current === undefined) {
        map.set(key, memberId);
        continue;
      }

      if (current !== memberId) {
        map.set(key, null);
      }
    }
  };

  for (const row of upgrades) {
    register(row.displayName, normalizeMemberId(row.userNo));
  }

  for (const row of wepRows) {
    register(row.name, normalizeMemberId(row.blooGlobalId));
  }

  return {
    resolve(name: string) {
      const exactKey = normalizeNameKey(name);
      const tokenKey = normalizeTokenKey(name);
      const exactMatch = exactNameToId.get(exactKey);

      if (typeof exactMatch === "string") {
        return exactMatch;
      }

      const tokenMatch = tokenNameToId.get(tokenKey);
      return typeof tokenMatch === "string" ? tokenMatch : null;
    }
  };
}

function parseUpgradeRows(rows: string[][]) {
  const header = rows[1] ?? [];

  return rows.slice(2).map((row) => {
    const record = Object.fromEntries(
      header.map((column, index) => [column.trim(), row[index] ?? ""])
    );

    return {
      userNo: record.user_no ?? "",
      displayName: record.display_name ?? "",
      month: record.month ?? "",
      previousLevel: record.previous_level ?? "",
      currentLevel: record.current_level ?? "",
      isUpgraded: record.is_upgraded ?? ""
    } satisfies RawUpgradeRow;
  });
}

function parseWepRows(rows: string[][]) {
  const header = rows[0] ?? [];

  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(
      header.map((column, index) => [column.trim(), row[index] ?? ""])
    );

    return {
      timestamp: record.Timestamp ?? "",
      name: record.Name ?? "",
      blooGlobalId: record["Bloo Global ID"] ?? "",
      email: record.Email ?? "",
      confirmToStartWep: record["Confirm to start WEP"] ?? ""
    } satisfies RawWepRow;
  });
}

function parseNewlyJoinedRows(rows: string[][]) {
  const header = rows[1] ?? [];

  return rows.slice(2).map((row) => {
    const record = Object.fromEntries(
      header.map((column, index) => [column.trim(), row[index] ?? ""])
    );

    return {
      userNo: record.user_no ?? "",
      createdAt: record.created_at ?? "",
      month: record.month ?? "",
      displayName: record.display_name ?? "",
      levelName: record.level_name ?? "",
      entryValueUsd: record.entry_fee_user_usd ?? record[""] ?? row[5] ?? "",
      totalEntryFeePerMonthUsd: record.total_entry_fee_per_month ?? row[6] ?? "",
      allocationToRewardUsd: record["allocation to reward (70%)"] ?? row[7] ?? ""
    } satisfies RawNewlyJoinedRow;
  });
}

function parseCpRows(rows: string[][]) {
  const header = rows[0] ?? [];

  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(
      header.map((column, index) => [column.trim(), row[index] ?? ""])
    );

    return {
      userName: record["User Name"] ?? "",
      level: record.Level ?? "",
      priceUsd: record["Price (US$)"] ?? "",
      purchaseDate: record["Purchase Date"] ?? "",
      iBloomingProfit: record["iBlooming Profit"] ?? ""
    } satisfies RawCpRow;
  });
}

function readParamsScalar(rows: string[][], paramName: string, fallback: number) {
  for (const row of rows) {
    const index = row.findIndex((value) => value.trim() === paramName);

    if (index >= 0) {
      const nextValue = row[index + 1] ?? "";
      return parseNumber(nextValue, `PARAMS scalar ${paramName}`);
    }
  }

  return fallback;
}

function parseParamsMonthlyMetrics(rows: string[][]) {
  const metrics = new Map<string, ParamsMonthlyMetric>();
  const pcUnit = readParamsScalar(rows, "PC_UNIT", 100);
  const cashoutRate = readParamsScalar(rows, "cashout_rate", 1);

  for (const row of rows) {
    const periodKeyRaw = row[14]?.trim() ?? "";

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKeyRaw)) {
      continue;
    }

    const periodKey = ensurePeriodKey(periodKeyRaw, `PARAMS period ${periodKeyRaw}`);
    const globalRewardUsd = parseNumber(row[2] ?? "", `PARAMS GPSP ${periodKey}`);
    const poolRewardUsd =
      periodKey <= PARAMS_POOL_REWARD_CUTOFF
        ? parseNumber(row[6] ?? "", `PARAMS WEC 3% ${periodKey}`)
        : 0;
    const recognizedRevenueUsd = parseNumber(row[15] ?? "", `PARAMS entry fee ${periodKey}`);
    const pcVolume = parseNumber(row[16] ?? "", `PARAMS PC issued ${periodKey}`);
    const pcSpentUnits = parseNumber(row[20] ?? "", `PARAMS PC spent ${periodKey}`);
    const sinkSpendUsd = pcUnit > 0 ? roundNumber(pcSpentUnits / pcUnit) : 0;
    const spRewardBasis = roundNumber((globalRewardUsd + poolRewardUsd) * 10);
    const cashoutUsd = roundNumber((globalRewardUsd + poolRewardUsd) * cashoutRate);
    const grossMarginUsd = roundNumber(recognizedRevenueUsd * 0.35);

    metrics.set(periodKey, {
      periodKey,
      pcVolume,
      spRewardBasis,
      globalRewardUsd,
      poolRewardUsd,
      cashoutUsd,
      sinkSpendUsd,
      recognizedRevenueUsd,
      grossMarginUsd
    });
  }

  return metrics;
}

function parseDataAggMonthlyMetrics(rows: string[][]) {
  const metrics = new Map<string, ParamsMonthlyMetric>();

  // DATA_AGG header is on row index 3 (line 4): Month, Total_PC, Total_SP, Rewards_USD, Cashout_USD, Active_Members, EntryFee_USD_from_PC, ...
  // Data rows start from row index 4 onwards
  const headerRowIndex = rows.findIndex(
    (row) => row[0]?.trim() === "Month" && (row[1]?.trim() ?? "").includes("Total_PC")
  );

  if (headerRowIndex < 0) {
    console.warn("[DATA_AGG] Could not find header row, skipping.");
    return metrics;
  }

  for (const row of rows.slice(headerRowIndex + 1)) {
    const periodKeyRaw = row[0]?.trim() ?? "";

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKeyRaw)) {
      continue;
    }

    const periodKey = ensurePeriodKey(periodKeyRaw, `DATA_AGG period ${periodKeyRaw}`);
    const pcVolume = parseNumber(row[1] ?? "", `DATA_AGG Total_PC ${periodKey}`);
    const spRaw = parseNumber(row[2] ?? "", `DATA_AGG Total_SP ${periodKey}`);
    const rewardsUsd = parseNumber(row[3] ?? "", `DATA_AGG Rewards_USD ${periodKey}`);
    const cashoutUsd = parseNumber(row[4] ?? "", `DATA_AGG Cashout_USD ${periodKey}`);
    // Active_Members is row[5] — informational, not directly used in metrics
    const entryFeeUsd = parseNumber(row[6] ?? "", `DATA_AGG EntryFee_USD ${periodKey}`);

    // Skip rows where all values are zero (future placeholder months)
    if (pcVolume <= 0 && spRaw <= 0 && rewardsUsd <= 0 && cashoutUsd <= 0 && entryFeeUsd <= 0) {
      continue;
    }

    // DATA_AGG treats Rewards_USD as global reward (GPSP-equivalent)
    const globalRewardUsd = rewardsUsd;
    // Pool reward is not broken out in DATA_AGG; will be inherited from PARAMS if available
    const poolRewardUsd = 0;
    const spRewardBasis = spRaw > 0 ? spRaw : roundNumber(globalRewardUsd * 10);
    const recognizedRevenueUsd = entryFeeUsd;
    const grossMarginUsd = roundNumber(recognizedRevenueUsd * 0.35);
    // sinkSpendUsd not directly available in DATA_AGG; derive from SP_gap if negative
    const sinkSpendUsd = 0;

    metrics.set(periodKey, {
      periodKey,
      pcVolume,
      spRewardBasis,
      globalRewardUsd,
      poolRewardUsd,
      cashoutUsd,
      sinkSpendUsd,
      recognizedRevenueUsd,
      grossMarginUsd
    });
  }

  return metrics;
}

function mergeDataAggIntoParamsMetrics(
  paramsMetrics: Map<string, ParamsMonthlyMetric>,
  dataAggMetrics: Map<string, ParamsMonthlyMetric>
) {
  for (const [periodKey, dataAggMetric] of dataAggMetrics.entries()) {
    const paramsMetric = paramsMetrics.get(periodKey);

    if (!paramsMetric) {
      // DATA_AGG has data for a period PARAMS doesn't — use it directly
      paramsMetrics.set(periodKey, dataAggMetric);
      continue;
    }

    // DATA_AGG provides more authoritative aggregate values for certain fields.
    // Override PARAMS with DATA_AGG where DATA_AGG has non-zero values.
    // Keep PARAMS' poolRewardUsd and sinkSpendUsd if DATA_AGG doesn't provide them.
    paramsMetrics.set(periodKey, {
      periodKey,
      pcVolume: dataAggMetric.pcVolume > 0 ? dataAggMetric.pcVolume : paramsMetric.pcVolume,
      spRewardBasis: dataAggMetric.spRewardBasis > 0 ? dataAggMetric.spRewardBasis : paramsMetric.spRewardBasis,
      globalRewardUsd: dataAggMetric.globalRewardUsd > 0 ? dataAggMetric.globalRewardUsd : paramsMetric.globalRewardUsd,
      poolRewardUsd: paramsMetric.poolRewardUsd,  // Keep PARAMS value — DATA_AGG doesn't break this out
      cashoutUsd: dataAggMetric.cashoutUsd > 0 ? dataAggMetric.cashoutUsd : paramsMetric.cashoutUsd,
      sinkSpendUsd: paramsMetric.sinkSpendUsd,     // Keep PARAMS value — DATA_AGG doesn't have PC Spent
      recognizedRevenueUsd: dataAggMetric.recognizedRevenueUsd > 0 ? dataAggMetric.recognizedRevenueUsd : paramsMetric.recognizedRevenueUsd,
      grossMarginUsd: dataAggMetric.grossMarginUsd > 0 ? dataAggMetric.grossMarginUsd : paramsMetric.grossMarginUsd
    });
  }
}

function parseParamsTemplateRows(rows: string[][]) {
  const header = rows[0] ?? [];

  return rows
    .slice(1)
    .map((row) => Object.fromEntries(header.map((column, index) => [column.trim(), row[index] ?? ""])))
    .filter((record) => record.period_key && record.member_key && record.source_system)
    .map((record) => ({
      periodKey: ensurePeriodKey(record.period_key, `PARAMS template ${record.period_key}`),
      memberKey: record.member_key,
      sourceSystem: record.source_system,
      memberTier: record.member_tier,
      groupKey: record.group_key,
      activeMember: parseBooleanString(record.active_member) ?? true,
      memberJoinPeriod: record.member_join_period || null,
      isAffiliate: parseBooleanString(record.is_affiliate),
      crossAppActive: parseBooleanString(record.cross_app_active),
      pcVolume: parseNumber(record.pc_volume, `PARAMS template pc_volume ${record.member_key}`),
      spRewardBasis: parseNumber(
        record.sp_reward_basis,
        `PARAMS template sp_reward_basis ${record.member_key}`
      ),
      globalRewardUsd: parseNumber(
        record.global_reward_usd,
        `PARAMS template global_reward_usd ${record.member_key}`
      ),
      poolRewardUsd: parseNumber(
        record.pool_reward_usd,
        `PARAMS template pool_reward_usd ${record.member_key}`
      ),
      cashoutUsd: parseNumber(record.cashout_usd, `PARAMS template cashout_usd ${record.member_key}`),
      sinkSpendUsd: parseNumber(
        record.sink_spend_usd,
        `PARAMS template sink_spend_usd ${record.member_key}`
      ),
      recognizedRevenueUsd: parseNumber(
        record.recognized_revenue_usd,
        `PARAMS template recognized_revenue_usd ${record.member_key}`
      ),
      grossMarginUsd: parseNumber(
        record.gross_margin_usd,
        `PARAMS template gross_margin_usd ${record.member_key}`
      )
    } satisfies ParamsTemplateRow));
}

function addGlobal2024Facts(facts: FactMap, rows: string[][]) {
  const countRows = new Map<string, number>();
  const bonusRows = new Map<string, number>();
  let inCountSection = false;
  let inBonusSection = false;

  for (const row of rows) {
    const firstCell = row[0]?.trim() ?? "";
    const secondCell = row[1]?.trim() ?? "";

    if (firstCell === "Level" && secondCell === "No of Members") {
      inCountSection = true;
      inBonusSection = false;
      continue;
    }

    if (firstCell === "Level" && secondCell === "Bonus per member") {
      inCountSection = false;
      inBonusSection = true;
      continue;
    }

    if (inCountSection) {
      if (!firstCell) {
        inCountSection = false;
        continue;
      }

      countRows.set(firstCell, parseNumber(secondCell, `2024 count ${firstCell}`));
    }

    if (inBonusSection) {
      if (!firstCell) {
        inBonusSection = false;
        continue;
      }

      bonusRows.set(firstCell, parseNumber(secondCell, `2024 bonus ${firstCell}`));
    }
  }

  for (const [level, memberCount] of countRows.entries()) {
    const bonusPerMember = bonusRows.get(level) ?? 0;
    const normalizedTier = normalizeTier(level);

    for (let index = 1; index <= memberCount; index += 1) {
      upsertFact(
        facts,
        {
          periodKey: GLOBAL_2024_PERIOD,
          memberKey: `BGC-GLOBAL-2024-${normalizedTier.toUpperCase()}-${String(index).padStart(3, "0")}`,
          sourceSystem: "bgc"
        },
        {
          memberTier: normalizedTier,
          groupKey: "bgc-global-2024",
          globalRewardUsd: bonusPerMember,
          activeMember: true,
          isAffiliate: true,
          extraJson: {
            source_files: [RAW_FILE_NAMES.global2024],
            source_categories: ["global_profit_2024_summary"]
          }
        }
      );
    }
  }
}

function addGlobal2025Facts(facts: FactMap, rows: string[][]) {
  const headerIndex = rows.findIndex(
    (row) => row[0]?.trim() === "Level" && row[1]?.trim() === "Month" && row[4]?.trim().length > 0
  );

  if (headerIndex < 0) {
    throw new Error("Could not find the 2025 first-half member allocation section.");
  }

  let currentLevel = "";

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((value) => value.trim().length > 0)) {
      continue;
    }

    if (row[0]?.trim()) {
      currentLevel = row[0].trim();
    }

    const memberIds = (row[4] ?? "")
      .split(",")
      .map((value) => normalizeMemberId(value))
      .filter((value): value is string => Boolean(value));

    if (memberIds.length === 0) {
      continue;
    }

    const shareOfPrice = parseNumber(row[3] ?? "", `2025 first-half share ${currentLevel}`);

    for (const memberId of memberIds) {
      upsertFact(
        facts,
        {
          periodKey: GLOBAL_2025_PERIOD,
          memberKey: memberId,
          sourceSystem: "bgc"
        },
        {
          globalRewardUsd: shareOfPrice,
          activeMember: true,
          isAffiliate: true,
          extraJson: {
            source_files: [RAW_FILE_NAMES.global2025],
            source_categories: ["global_profit_2025_first_half_distribution"],
            distribution_level: normalizeTier(currentLevel)
          }
        }
      );
    }
  }
}

function addUpgradeFacts(facts: FactMap, rows: RawUpgradeRow[]) {
  for (const row of rows) {
    const memberId = normalizeMemberId(row.userNo);

    if (!memberId || !row.month.trim()) {
      continue;
    }

    upsertFact(
      facts,
      {
        periodKey: ensurePeriodKey(row.month.trim(), `upgrade month ${row.userNo}`),
        memberKey: memberId,
        sourceSystem: "bgc"
      },
      {
        memberTier: row.currentLevel || row.previousLevel,
        activeMember: true,
        isAffiliate: true,
        extraJson: {
          source_files: [RAW_FILE_NAMES.upgrades],
          source_categories: ["affiliate_upgrade"],
          previous_levels: row.previousLevel ? [normalizeTier(row.previousLevel)] : []
        }
      }
    );
  }
}

function addNewlyJoinedFacts(facts: FactMap, rows: RawNewlyJoinedRow[]) {
  for (const row of rows) {
    const memberId = normalizeMemberId(row.userNo);

    if (!memberId || !row.month.trim()) {
      continue;
    }

    const periodKey = ensurePeriodKey(row.month.trim(), `newly joined month ${row.userNo}`);
    const entryFeeUsd = parseNumber(row.entryValueUsd, `new join value ${row.userNo}`);
    const joinRule = resolveBgcJoinRule(entryFeeUsd, row.levelName);

    const extraJson = {
      source_files: [RAW_FILE_NAMES.newlyJoined],
      source_categories: ["affiliate_newly_joined"],
      ...(row.createdAt.trim() ? { created_at: row.createdAt.trim() } : {}),
      join_entry_value_usd: entryFeeUsd,
      ...(joinRule
        ? {
            recognized_revenue_basis: {
              entry_fee_usd: joinRule.entryFeeUsd
            }
          }
        : {}),
      ...(row.totalEntryFeePerMonthUsd.trim()
        ? {
            monthly_entry_fee_total_usd: parseNumber(
              row.totalEntryFeePerMonthUsd,
              `new join monthly total ${row.userNo}`
            )
          }
        : {}),
      ...(row.allocationToRewardUsd.trim()
        ? {
            monthly_reward_allocation_usd: parseNumber(
              row.allocationToRewardUsd,
              `new join reward allocation ${row.userNo}`
            )
          }
        : {})
    };

    upsertFact(
      facts,
      {
        periodKey,
        memberKey: memberId,
        sourceSystem: "bgc"
      },
      {
        memberTier: row.levelName,
        pcVolume: joinRule?.pcVolume ?? 0,
        spRewardBasis: joinRule?.spRewardBasis ?? 0,
        recognizedRevenueUsd: entryFeeUsd,
        activeMember: true,
        memberJoinPeriod: periodKey,
        isAffiliate: true,
        extraJson
      }
    );
  }
}

function addWepFacts(facts: FactMap, rows: RawWepRow[]) {
  const firstApplicationByMember = new Map<string, string>();

  for (const row of rows) {
    const confirm = row.confirmToStartWep.trim().toLowerCase();

    if (confirm && !confirm.startsWith("yes")) {
      continue;
    }

    const memberId =
      normalizeMemberId(row.blooGlobalId) ||
      (row.email.trim()
        ? buildSyntheticMemberKey("WEP", row.email)
        : row.name.trim()
          ? buildSyntheticMemberKey("WEP", row.name)
          : null);

    if (!memberId || !row.timestamp.trim()) {
      continue;
    }

    const periodKey = parsePeriodFromUsDate(row.timestamp);
    const currentFirst = firstApplicationByMember.get(memberId);

    if (!currentFirst || periodKey < currentFirst) {
      firstApplicationByMember.set(memberId, periodKey);
    }
  }

  for (const [memberId, periodKey] of firstApplicationByMember.entries()) {
    upsertFact(
      facts,
      {
        periodKey,
        memberKey: memberId,
        sourceSystem: "iblooming"
      },
      {
        activeMember: true,
        extraJson: {
          source_files: [RAW_FILE_NAMES.wep],
          source_categories: ["wep_application"]
        }
      }
    );
  }
}

function addCpFacts(facts: FactMap, rows: RawCpRow[], resolver: NameResolver) {
  let matchedById = 0;
  let syntheticKeys = 0;

  for (const row of rows) {
    if (!row.userName.trim()) {
      continue;
    }

    const resolvedMemberId = resolver.resolve(row.userName);
    const memberKey =
      resolvedMemberId ?? buildSyntheticMemberKey("CP", normalizeNameKey(row.userName) || row.userName);

    if (resolvedMemberId) {
      matchedById += 1;
    } else {
      syntheticKeys += 1;
    }

    const priceUsd = roundNumber(parseNumber(row.priceUsd, `CP price ${row.userName}`), 2);
    const marginUsd = roundNumber(parseNumber(row.iBloomingProfit, `CP margin ${row.userName}`), 2);
    const ibPlatformRevenueUsd = roundNumber(priceUsd * 0.3, 2);
    const recognizedRevenueUsd = ibPlatformRevenueUsd > 0 ? ibPlatformRevenueUsd : marginUsd;

    upsertFact(
      facts,
      {
        periodKey: parsePeriodFromIsoDateTime(row.purchaseDate),
        memberKey,
        sourceSystem: "iblooming"
      },
      {
        sinkSpendUsd: priceUsd,
        recognizedRevenueUsd,
        grossMarginUsd: recognizedRevenueUsd,
        activeMember: true,
        extraJson: {
          source_files: [RAW_FILE_NAMES.cpVideos],
          source_categories: ["cp_video_sale"],
          matched_to_bgc_id: Boolean(resolvedMemberId),
          source_profile_bgc_level: normalizeTier(row.level)
        }
      }
    );

    const fact = facts.get(makeFactKey({
      periodKey: parsePeriodFromIsoDateTime(row.purchaseDate),
      memberKey,
      sourceSystem: "iblooming"
    }));

    if (fact) {
      addExtraJsonNumericValue(fact, "sink_breakdown_usd", "PC_SPEND", priceUsd);
      addExtraJsonNumericValue(fact, "accountability_checks", "sink_total_usd", priceUsd);
      fact.extraJson ??= {};
      const recognizedRevenueBasis = ensureExtraJsonRecord(fact.extraJson, "recognized_revenue_basis");
      const grossMarginBasis = ensureExtraJsonRecord(fact.extraJson, "gross_margin_basis");
      const totalGrossSaleUsd = roundNumber(fact.sinkSpendUsd);
      const totalCpUserShareUsd = roundNumber(totalGrossSaleUsd * 0.7);
      const totalPlatformRevenueUsd = roundNumber(totalGrossSaleUsd * 0.3);

      fact.recognizedRevenueUsd = totalPlatformRevenueUsd;
      fact.grossMarginUsd = totalPlatformRevenueUsd;
      recognizedRevenueBasis.gross_sale_usd = totalGrossSaleUsd;
      recognizedRevenueBasis.cp_user_share_usd = totalCpUserShareUsd;
      recognizedRevenueBasis.ib_platform_revenue_usd = totalPlatformRevenueUsd;
      recognizedRevenueBasis.platform_take_rate_pct = 30;
      grossMarginBasis.gross_margin_usd = totalPlatformRevenueUsd;
    }
  }

  return {
    matchedById,
    syntheticKeys
  };
}

function addIMatrixFacts(facts: FactMap, rows: string[][]) {
  let currentProduct = "";

  for (const row of rows) {
    const firstCell = row[0]?.trim() ?? "";

    if (/^\d+\)/.test(firstCell)) {
      currentProduct = firstCell.replace(/^\d+\)\s*/, "").split(" - ")[0] ?? firstCell;
      continue;
    }

    if (!currentProduct || firstCell === "Month" || firstCell === "Total") {
      continue;
    }

    const totalAmount = roundNumber(parseNumber(row[2] ?? "", `iMatrix total ${currentProduct} ${firstCell}`), 2);
    const globalPoolAmount = parseNumber(
      row[6] ?? "",
      `iMatrix global pool ${currentProduct} ${firstCell}`
    );
    const cpUserShareUsd = roundNumber(totalAmount * 0.7, 2);
    const ibPlatformRevenueUsd = roundNumber(totalAmount * 0.3, 2);

    if (totalAmount <= 0 && globalPoolAmount <= 0) {
      continue;
    }

    upsertFact(
      facts,
      {
        periodKey: monthNameToPeriodKey(2025, firstCell),
        memberKey: `IMATRIX-${currentProduct.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}`,
        sourceSystem: "iblooming"
      },
      {
        groupKey: "imatrix-aggregate",
        sinkSpendUsd: totalAmount,
        poolRewardUsd: globalPoolAmount,
        recognizedRevenueUsd: ibPlatformRevenueUsd,
        grossMarginUsd: ibPlatformRevenueUsd,
        extraJson: {
          source_files: [RAW_FILE_NAMES.imatrix],
          source_categories: ["imatrix_product_aggregate"],
          imatrix_product_lines: [currentProduct],
          recognized_revenue_basis: {
            gross_sale_usd: totalAmount,
            cp_user_share_usd: cpUserShareUsd,
            ib_platform_revenue_usd: ibPlatformRevenueUsd,
            platform_take_rate_pct: 30
          },
          gross_margin_basis: {
            gross_margin_usd: ibPlatformRevenueUsd
          }
        }
      }
    );

    const fact = facts.get(
      makeFactKey({
        periodKey: monthNameToPeriodKey(2025, firstCell),
        memberKey: `IMATRIX-${currentProduct.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase()}`,
        sourceSystem: "iblooming"
      })
    );

    if (fact) {
      addExtraJsonNumericValue(fact, "sink_breakdown_usd", "PC_SPEND", totalAmount);
      addExtraJsonNumericValue(fact, "accountability_checks", "sink_total_usd", totalAmount);
    }
  }
}

function addParamsTopUpFacts(
  facts: FactMap,
  paramsMetrics: Map<string, ParamsMonthlyMetric>,
  templateRows: ParamsTemplateRow[],
  dataAggMetrics: Map<string, ParamsMonthlyMetric>
) {
  const observedTotalsByPeriod = new Map<string, Record<NumericTopUpField, number>>();

  for (const fact of facts.values()) {
    const totals = observedTotalsByPeriod.get(fact.periodKey) ?? {
      pcVolume: 0,
      spRewardBasis: 0,
      globalRewardUsd: 0,
      poolRewardUsd: 0,
      cashoutUsd: 0,
      sinkSpendUsd: 0,
      recognizedRevenueUsd: 0,
      grossMarginUsd: 0
    };

    for (const field of NUMERIC_TOP_UP_FIELDS) {
      totals[field] += readNumericFactField(fact, field);
    }

    observedTotalsByPeriod.set(fact.periodKey, totals);
  }

  const templatesByPeriod = new Map<string, ParamsTemplateRow[]>();

  for (const row of templateRows) {
    const monthRows = templatesByPeriod.get(row.periodKey) ?? [];
    monthRows.push(row);
    templatesByPeriod.set(row.periodKey, monthRows);
  }

  for (const [periodKey, metric] of paramsMetrics.entries()) {
    const monthTemplateRows = templatesByPeriod.get(periodKey) ?? [];

    if (monthTemplateRows.length === 0) {
      continue;
    }

    const observed = observedTotalsByPeriod.get(periodKey) ?? {
      pcVolume: 0,
      spRewardBasis: 0,
      globalRewardUsd: 0,
      poolRewardUsd: 0,
      cashoutUsd: 0,
      sinkSpendUsd: 0,
      recognizedRevenueUsd: 0,
      grossMarginUsd: 0
    };
    const gaps = Object.fromEntries(
      NUMERIC_TOP_UP_FIELDS.map((field) => [
        field,
        roundNumber(Math.max(0, readMetricValue(metric, field) - observed[field]))
      ])
    ) as Record<NumericTopUpField, number>;

    if (!Object.values(gaps).some((value) => value > 0)) {
      continue;
    }

    const templateTotals = buildTemplateTotalsByField(monthTemplateRows);
    const distributionBasisByField = Object.fromEntries(
      NUMERIC_TOP_UP_FIELDS.map((field) => [field, resolveTopUpDistributionBasisField(field, templateTotals)])
    ) as Record<NumericTopUpField, NumericTopUpField | null>;
    const allocationsByField = Object.fromEntries(
      NUMERIC_TOP_UP_FIELDS.map((field) => [
        field,
        allocateGapAcrossRows(gaps[field], monthTemplateRows, distributionBasisByField[field])
      ])
    ) as Record<NumericTopUpField, number[]>;

    for (const [rowIndex, row] of monthTemplateRows.entries()) {
      const scaledMetrics = Object.fromEntries(
        NUMERIC_TOP_UP_FIELDS.map((field) => [field, allocationsByField[field][rowIndex] ?? 0])
      ) as NumericTopUpValueMap;

      if (!Object.values(scaledMetrics).some((value) => value > 0)) {
        continue;
      }

      const topUpDistributionBasis = Object.fromEntries(
        Object.entries(distributionBasisByField)
          .filter(([field, basisField]) => basisField !== null && basisField !== field)
          .map(([field, basisField]) => [field, basisField])
      );

      upsertFact(
        facts,
        {
          periodKey,
          memberKey: row.memberKey,
          sourceSystem: row.sourceSystem
        },
        {
          memberTier: row.memberTier,
          groupKey: row.groupKey,
          pcVolume: scaledMetrics.pcVolume,
          spRewardBasis: scaledMetrics.spRewardBasis,
          globalRewardUsd: scaledMetrics.globalRewardUsd,
          poolRewardUsd: scaledMetrics.poolRewardUsd,
          cashoutUsd: scaledMetrics.cashoutUsd,
          sinkSpendUsd: scaledMetrics.sinkSpendUsd,
          recognizedRevenueUsd: scaledMetrics.recognizedRevenueUsd,
          grossMarginUsd: scaledMetrics.grossMarginUsd,
          activeMember: row.activeMember,
          memberJoinPeriod: row.memberJoinPeriod,
          isAffiliate: row.isAffiliate ?? undefined,
          crossAppActive: row.crossAppActive ?? undefined,
          extraJson: {
            source_files: dataAggMetrics.has(periodKey)
              ? [RAW_FILE_NAMES.params, RAW_FILE_NAMES.dataAgg]
              : [RAW_FILE_NAMES.params],
            source_categories: dataAggMetrics.has(periodKey)
              ? ["params_monthly_topup", "data_agg_monthly_override"]
              : ["params_monthly_topup"],
            top_up_strategy: "monthly_gap_against_existing_bundle",
            params_period_key: periodKey,
            data_agg_period_key: dataAggMetrics.has(periodKey) ? periodKey : undefined,
            top_up_distribution_basis_by_field:
              Object.keys(topUpDistributionBasis).length > 0 ? topUpDistributionBasis : undefined
          }
        }
      );
    }
  }
}

function finalizeFacts(facts: FactMap) {
  const rows = [...facts.values()];
  const earliestPeriodByMember = new Map<string, string>();
  const sourceSystemsByMember = new Map<string, Set<string>>();
  const preferredTierByMemberSource = new Map<string, string>();
  const affiliateMembers = new Set<string>();

  for (const row of rows) {
    if (row.activeMember) {
      const currentEarliest = earliestPeriodByMember.get(row.memberKey);

      if (!currentEarliest || row.periodKey < currentEarliest) {
        earliestPeriodByMember.set(row.memberKey, row.periodKey);
      }
    }

    const sourceSystems = sourceSystemsByMember.get(row.memberKey) ?? new Set<string>();
    sourceSystems.add(row.sourceSystem);
    sourceSystemsByMember.set(row.memberKey, sourceSystems);

    if (row.memberTier) {
      const memberSourceKey = `${row.memberKey}::${row.sourceSystem}`;
      preferredTierByMemberSource.set(
        memberSourceKey,
        preferTier(preferredTierByMemberSource.get(memberSourceKey) ?? "", row.memberTier)
      );
    }

    if (row.isAffiliate) {
      affiliateMembers.add(row.memberKey);
    }
  }

  const crossAppMembers = new Set(
    [...sourceSystemsByMember.entries()]
      .filter(([, sourceSystems]) => sourceSystems.size > 1)
      .map(([memberKey]) => memberKey)
  );

  for (const row of rows) {
    if (!row.memberTier) {
      row.memberTier =
        preferredTierByMemberSource.get(`${row.memberKey}::${row.sourceSystem}`) ?? "";
    }

    if (row.activeMember) {
      row.memberJoinPeriod = row.memberJoinPeriod ?? earliestPeriodByMember.get(row.memberKey) ?? null;
    }

    if (affiliateMembers.has(row.memberKey) && row.activeMember) {
      row.isAffiliate = true;
    }

    if (crossAppMembers.has(row.memberKey) && row.activeMember) {
      row.crossAppActive = true;
    }
  }

  return rows.sort((left, right) =>
    [
      left.periodKey,
      left.sourceSystem,
      left.memberKey
    ]
      .join("::")
      .localeCompare([right.periodKey, right.sourceSystem, right.memberKey].join("::"))
  );
}

function formatCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "";
  }

  return roundNumber(value).toString();
}

function factToCsvRow(fact: CanonicalFact) {
  const row: Record<OutputHeader, string> = {
    period_key: fact.periodKey,
    member_key: fact.memberKey,
    source_system: fact.sourceSystem,
    member_tier: fact.memberTier,
    group_key: fact.groupKey,
    pc_volume: formatNumber(fact.pcVolume),
    sp_reward_basis: formatNumber(fact.spRewardBasis),
    global_reward_usd: formatNumber(fact.globalRewardUsd),
    pool_reward_usd: formatNumber(fact.poolRewardUsd),
    cashout_usd: formatNumber(fact.cashoutUsd),
    sink_spend_usd: formatNumber(fact.sinkSpendUsd),
    active_member: String(fact.activeMember),
    recognized_revenue_usd: formatNumber(fact.recognizedRevenueUsd),
    gross_margin_usd: formatNumber(fact.grossMarginUsd),
    member_join_period: fact.memberJoinPeriod ?? "",
    is_affiliate: fact.isAffiliate === null ? "" : String(fact.isAffiliate),
    cross_app_active: fact.crossAppActive === null ? "" : String(fact.crossAppActive),
    extra_json: fact.extraJson ? JSON.stringify(fact.extraJson) : ""
  };

  snapshotImportCsvRowSchema.parse(row);
  return row;
}

function renderCsv(rows: CanonicalFact[]) {
  const lines = [OUTPUT_HEADERS.join(",")];

  for (const row of rows) {
    const csvRow = factToCsvRow(row);
    lines.push(OUTPUT_HEADERS.map((header) => formatCsvValue(csvRow[header])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolveInput = (fileName: string) => path.join(args.inputDir, fileName);
  const [
    global2024Rows,
    global2025Rows,
    upgradeRowsRaw,
    newlyJoinedRowsRaw,
    cpRowsRaw,
    wepRowsRaw,
    imatrixRows,
    paramsRowsRaw,
    dataAggRowsRaw,
    paramsTemplateRowsRaw
  ] = await Promise.all([
    readCsvRows(resolveInput(RAW_FILE_NAMES.global2024)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.global2025)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.upgrades)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.newlyJoined)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.cpVideos)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.wep)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.imatrix)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.params)),
    readCsvRows(resolveInput(RAW_FILE_NAMES.dataAgg)),
    readCsvRows(path.resolve(process.cwd(), PARAMS_TEMPLATE_PATH))
  ]);

  const upgradeRows = parseUpgradeRows(upgradeRowsRaw);
  const newlyJoinedRows = parseNewlyJoinedRows(newlyJoinedRowsRaw);
  const wepRows = parseWepRows(wepRowsRaw);
  const cpRows = parseCpRows(cpRowsRaw);
  const paramsMetrics = parseParamsMonthlyMetrics(paramsRowsRaw);
  const dataAggMetrics = parseDataAggMonthlyMetrics(dataAggRowsRaw);
  mergeDataAggIntoParamsMetrics(paramsMetrics, dataAggMetrics);
  const paramsTemplateRows = parseParamsTemplateRows(paramsTemplateRowsRaw);
  const resolver = buildNameResolver(
    [
      ...upgradeRows,
      ...newlyJoinedRows.map((row) => ({
        userNo: row.userNo,
        displayName: row.displayName,
        month: row.month,
        previousLevel: "",
        currentLevel: row.levelName,
        isUpgraded: ""
      }))
    ],
    wepRows
  );
  const facts: FactMap = new Map();

  addGlobal2024Facts(facts, global2024Rows);
  addGlobal2025Facts(facts, global2025Rows);
  addUpgradeFacts(facts, upgradeRows);
  addNewlyJoinedFacts(facts, newlyJoinedRows);
  addWepFacts(facts, wepRows);
  const cpMatchStats = addCpFacts(facts, cpRows, resolver);
  addIMatrixFacts(facts, imatrixRows);
  addParamsTopUpFacts(facts, paramsMetrics, paramsTemplateRows, dataAggMetrics);

  const finalizedFacts = finalizeFacts(facts);
  const csvText = renderCsv(finalizedFacts);

  await mkdir(path.dirname(args.outputPath), { recursive: true });
  await writeFile(args.outputPath, csvText, "utf8");

  const uniqueMembers = new Set(finalizedFacts.map((row) => row.memberKey));
  const periods = [...new Set(finalizedFacts.map((row) => row.periodKey))].sort();
  const countsBySource = finalizedFacts.reduce<Record<string, number>>((totals, row) => {
    totals[row.sourceSystem] = (totals[row.sourceSystem] ?? 0) + 1;
    return totals;
  }, {});

  console.log(`Wrote ${finalizedFacts.length} canonical member-month rows to ${args.outputPath}`);
  console.log(`Periods: ${periods[0]} to ${periods[periods.length - 1]} (${periods.length} months)`);
  console.log(`Unique members: ${uniqueMembers.size}`);
  console.log(`Rows by source: ${JSON.stringify(countsBySource)}`);
  console.log(`DATA_AGG periods merged: ${dataAggMetrics.size}`);
  console.log(
    `CP name resolution: ${cpMatchStats.matchedById} transaction rows matched to BGC IDs, ${cpMatchStats.syntheticKeys} kept as synthetic keys`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
