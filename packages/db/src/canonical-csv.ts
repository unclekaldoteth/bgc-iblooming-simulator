import {
  canonicalSnapshotPayloadSchema,
  type CanonicalSnapshotPayload
} from "@bgc-alpha/schemas";

type CsvRecord = Record<string, string>;

type MetadataValue = string | number | boolean | Record<string, unknown> | null;
type CanonicalCsvTarget = Exclude<keyof CanonicalSnapshotPayload, "snapshot_id">;
type CanonicalSnapshotCsvDraft = {
  snapshot_id: string;
} & Record<CanonicalCsvTarget, Array<Record<string, unknown>>>;

const RECORD_TYPE_ALIASES: Record<string, CanonicalCsvTarget> = {
  member: "members",
  members: "members",
  member_alias: "member_aliases",
  member_aliases: "member_aliases",
  alias: "member_aliases",
  role_history: "role_history",
  member_role: "role_history",
  offer: "offers",
  offers: "offers",
  business_event: "business_events",
  business_events: "business_events",
  event: "business_events",
  pc_entry: "pc_entries",
  pc_entries: "pc_entries",
  pc_ledger: "pc_entries",
  sp_entry: "sp_entries",
  sp_entries: "sp_entries",
  sp_ledger: "sp_entries",
  reward_obligation: "reward_obligations",
  reward_obligations: "reward_obligations",
  reward: "reward_obligations",
  pool_entry: "pool_entries",
  pool_entries: "pool_entries",
  pool: "pool_entries",
  cashout_event: "cashout_events",
  cashout_events: "cashout_events",
  cashout: "cashout_events",
  qualification_window: "qualification_windows",
  qualification_windows: "qualification_windows",
  qualification_status: "qualification_status_history",
  qualification_status_history: "qualification_status_history"
};

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

      if (char === "\"") {
        inQuotes = false;
        continue;
      }

      currentCell += char;
      continue;
    }

    if (char === "\"") {
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
    throw new Error(`Full detail CSV headers are invalid. Problem header: "${duplicateHeader || "(empty)"}".`);
  }

  return rows.slice(1).map((row, rowIndex) => {
    if (row.length > headers.length) {
      throw new Error(`Full detail CSV row ${rowIndex + 2} has more columns than the header row.`);
    }

    return headers.reduce<CsvRecord>((record, header, headerIndex) => {
      record[header] = row[headerIndex] ?? "";
      return record;
    }, {});
  });
}

function readField(row: CsvRecord, fieldName: string) {
  return row[fieldName]?.trim() ?? "";
}

function requireField(row: CsvRecord, fieldName: string, rowRef: string) {
  const value = readField(row, fieldName);

  if (value.length === 0) {
    throw new Error(`${fieldName} is required (${rowRef}).`);
  }

  return value;
}

function readOptionalString(row: CsvRecord, fieldName: string) {
  const value = readField(row, fieldName);
  return value.length > 0 ? value : null;
}

function readOptionalNumber(row: CsvRecord, fieldName: string, rowRef: string) {
  const value = readField(row, fieldName);

  if (value.length === 0) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number (${rowRef}).`);
  }

  return parsed;
}

function requireNumber(row: CsvRecord, fieldName: string, rowRef: string) {
  const value = readOptionalNumber(row, fieldName, rowRef);

  if (value === null) {
    throw new Error(`${fieldName} is required (${rowRef}).`);
  }

  return value;
}

function readOptionalDateTime(row: CsvRecord, fieldName: string, rowRef: string) {
  const value = readField(row, fieldName);

  if (value.length === 0) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00.000Z`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date or date-time (${rowRef}).`);
  }

  return parsed.toISOString();
}

function requireDateTime(row: CsvRecord, fieldName: string, rowRef: string) {
  const value = readOptionalDateTime(row, fieldName, rowRef);

  if (!value) {
    throw new Error(`${fieldName} is required (${rowRef}).`);
  }

  return value;
}

function normalizeSourceSystem(value: string | null, rowRef: string) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "BGC") {
    return "BGC";
  }

  if (normalized === "IBLOOMING" || normalized === "I-BLOOMING" || normalized === "I_BLOOMING") {
    return "IBLOOMING";
  }

  throw new Error(`source_system must be BGC or IBLOOMING (${rowRef}).`);
}

function requireSourceSystem(row: CsvRecord, fieldName: string, rowRef: string) {
  const value = normalizeSourceSystem(requireField(row, fieldName, rowRef), rowRef);

  if (!value) {
    throw new Error(`${fieldName} is required (${rowRef}).`);
  }

  return value;
}

function readOptionalMetadata(row: CsvRecord, rowRef: string) {
  const raw = readField(row, "metadata");

  if (raw.length === 0) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`metadata must be valid JSON when filled (${rowRef}).`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`metadata must be a JSON object when filled (${rowRef}).`);
  }

  return parsed as Record<string, unknown>;
}

function buildMetadata(
  row: CsvRecord,
  rowRef: string,
  values: Record<string, MetadataValue>
) {
  const metadata = readOptionalMetadata(row, rowRef);

  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== "") {
      metadata[key] = value;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function parseJsonRecordField(row: CsvRecord, fieldName: string, rowRef: string) {
  const raw = readField(row, fieldName);

  if (raw.length === 0) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldName} must be valid JSON when filled (${rowRef}).`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object when filled (${rowRef}).`);
  }

  return parsed as Record<string, unknown>;
}

function buildRuleJson(
  row: CsvRecord,
  jsonFieldName: string,
  simpleFieldName: string,
  simpleRuleName: string,
  rowRef: string
) {
  const explicitJson = parseJsonRecordField(row, jsonFieldName, rowRef);
  const simpleValue = readOptionalNumber(row, simpleFieldName, rowRef);

  if (explicitJson) {
    return explicitJson;
  }

  if (simpleValue !== null) {
    return {
      [simpleRuleName]: simpleValue
    };
  }

  return null;
}

function createEmptyPayload(snapshotId: string): CanonicalSnapshotCsvDraft {
  return {
    snapshot_id: snapshotId,
    members: [],
    member_aliases: [],
    role_history: [],
    offers: [],
    business_events: [],
    pc_entries: [],
    sp_entries: [],
    reward_obligations: [],
    pool_entries: [],
    cashout_events: [],
    qualification_windows: [],
    qualification_status_history: []
  };
}

export function looksLikeCanonicalCsvSnapshot(text: string) {
  const headerLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const headers = headerLine.split(",").map((header) => header.trim().replace(/^"|"$/g, ""));

  return headers.includes("record_type");
}

export function parseCanonicalCsvSnapshotText(text: string): CanonicalSnapshotPayload {
  const records = parseCsvRecords(text);

  if (records.length === 0) {
    throw new Error("Full detail CSV does not contain any rows.");
  }

  const firstSnapshotId = records
    .map((record) => readField(record, "snapshot_id"))
    .find((value) => value.length > 0);
  const snapshotId = firstSnapshotId ?? "full-detail-csv-snapshot";
  const payload = createEmptyPayload(snapshotId);

  records.forEach((row, index) => {
    const rowRef = `row:${index + 2}`;
    const recordType = readField(row, "record_type").toLowerCase();
    const target = RECORD_TYPE_ALIASES[recordType];
    const rowSnapshotId = readOptionalString(row, "snapshot_id") ?? snapshotId;

    if (!target) {
      throw new Error(`record_type "${recordType || "(blank)"}" is not supported (${rowRef}).`);
    }

    if (rowSnapshotId !== snapshotId) {
      throw new Error(`snapshot_id must be the same for every full detail CSV row (${rowRef}).`);
    }

    switch (target) {
      case "members":
        {
          const stableKey = requireField(row, "stable_key", rowRef);
          const memberSourceSystem = readOptionalString(row, "source_system");
          const memberAliasKey = readOptionalString(row, "alias_key");

          payload.members.push({
            snapshot_id: snapshotId,
            stable_key: stableKey,
            display_name: readOptionalString(row, "display_name"),
            metadata: buildMetadata(row, rowRef, {
              group_key: readOptionalString(row, "group_key"),
              join_period: readOptionalString(row, "join_period")
            })
          });

          if (memberSourceSystem || memberAliasKey) {
            payload.member_aliases.push({
              snapshot_id: snapshotId,
              member_stable_key: stableKey,
              source_system: requireSourceSystem(row, "source_system", rowRef),
              alias_key: requireField(row, "alias_key", rowRef),
              alias_type: readOptionalString(row, "alias_type") ?? "member_id",
              confidence: readOptionalNumber(row, "confidence", rowRef),
              metadata: null
            });
          }
        }
        break;
      case "member_aliases":
        payload.member_aliases.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          source_system: requireSourceSystem(row, "source_system", rowRef),
          alias_key: requireField(row, "alias_key", rowRef),
          alias_type: readOptionalString(row, "alias_type") ?? "member_id",
          confidence: readOptionalNumber(row, "confidence", rowRef),
          metadata: buildMetadata(row, rowRef, {})
        });
        break;
      case "role_history":
        payload.role_history.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          role_type: requireField(row, "role_type", rowRef).toUpperCase(),
          role_value: requireField(row, "role_value", rowRef).toUpperCase(),
          source_system: normalizeSourceSystem(readOptionalString(row, "source_system"), rowRef),
          effective_from: requireDateTime(row, "effective_from", rowRef),
          effective_to: readOptionalDateTime(row, "effective_to", rowRef),
          source_event_ref: readOptionalString(row, "source_event_ref"),
          metadata: buildMetadata(row, rowRef, {})
        });
        break;
      case "offers":
        payload.offers.push({
          offer_code: requireField(row, "offer_code", rowRef),
          offer_type: requireField(row, "offer_type", rowRef).toUpperCase(),
          source_system: requireSourceSystem(row, "source_system", rowRef),
          label: readOptionalString(row, "label") ?? requireField(row, "offer_code", rowRef),
          price_fiat_usd: readOptionalNumber(row, "price_fiat_usd", rowRef),
          pc_grant_rule: buildRuleJson(row, "pc_grant_rule", "pc_grant", "pc_grant", rowRef),
          lts_generation_rule: buildRuleJson(row, "lts_generation_rule", "sp_accrual", "sp_accrual", rowRef),
          reward_rule_reference: readOptionalString(row, "reward_rule_reference"),
          metadata: buildMetadata(row, rowRef, {})
        });
        break;
      case "business_events":
        payload.business_events.push({
          snapshot_id: snapshotId,
          event_ref: requireField(row, "event_ref", rowRef),
          event_type: requireField(row, "event_type", rowRef).toUpperCase(),
          source_system: requireSourceSystem(row, "source_system", rowRef),
          occurred_at: requireDateTime(row, "occurred_at", rowRef),
          effective_period: requireField(row, "effective_period", rowRef),
          actor_member_stable_key: readOptionalString(row, "actor_member_stable_key"),
          beneficiary_member_stable_key: readOptionalString(row, "beneficiary_member_stable_key"),
          related_member_stable_key: readOptionalString(row, "related_member_stable_key"),
          offer_code: readOptionalString(row, "offer_code"),
          quantity: readOptionalNumber(row, "quantity", rowRef),
          amount: readOptionalNumber(row, "amount", rowRef),
          unit: readOptionalString(row, "unit")?.toUpperCase() ?? null,
          metadata: buildMetadata(row, rowRef, {
            recognized_revenue_usd: readOptionalNumber(row, "recognized_revenue_usd", rowRef),
            gross_margin_usd: readOptionalNumber(row, "gross_margin_usd", rowRef)
          })
        });
        break;
      case "pc_entries":
        payload.pc_entries.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          source_event_ref: readOptionalString(row, "source_event_ref"),
          entry_type: requireField(row, "entry_type", rowRef).toUpperCase(),
          effective_period: requireField(row, "effective_period", rowRef),
          amount_pc: requireNumber(row, "amount_pc", rowRef),
          metadata: buildMetadata(row, rowRef, {
            sink_spend_usd: readOptionalNumber(row, "sink_spend_usd", rowRef)
          })
        });
        break;
      case "sp_entries":
        payload.sp_entries.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          source_event_ref: readOptionalString(row, "source_event_ref"),
          entry_type: requireField(row, "entry_type", rowRef).toUpperCase(),
          effective_period: requireField(row, "effective_period", rowRef),
          amount_sp: requireNumber(row, "amount_sp", rowRef),
          metadata: buildMetadata(row, rowRef, {})
        });
        break;
      case "reward_obligations":
        payload.reward_obligations.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          source_event_ref: readOptionalString(row, "source_event_ref"),
          reward_source_code: requireField(row, "reward_source_code", rowRef).toUpperCase(),
          distribution_cycle: requireField(row, "distribution_cycle", rowRef).toUpperCase(),
          obligation_status: readOptionalString(row, "obligation_status")?.toUpperCase() ?? "ACCRUED",
          effective_period: requireField(row, "effective_period", rowRef),
          amount: requireNumber(row, "amount", rowRef),
          unit: requireField(row, "unit", rowRef).toUpperCase(),
          eligibility_snapshot_key: readOptionalString(row, "eligibility_snapshot_key"),
          metadata: buildMetadata(row, rowRef, {
            origin_join_level: readOptionalString(row, "origin_join_level")?.toUpperCase() ?? null,
            tier: readOptionalNumber(row, "tier", rowRef),
            imatrix_plan: readOptionalString(row, "imatrix_plan")
          })
        });
        break;
      case "pool_entries":
        payload.pool_entries.push({
          snapshot_id: snapshotId,
          source_event_ref: readOptionalString(row, "source_event_ref"),
          recipient_member_stable_key: readOptionalString(row, "recipient_member_stable_key"),
          pool_code: requireField(row, "pool_code", rowRef).toUpperCase(),
          entry_type: requireField(row, "entry_type", rowRef).toUpperCase(),
          distribution_cycle: requireField(row, "distribution_cycle", rowRef).toUpperCase(),
          effective_period: requireField(row, "effective_period", rowRef),
          amount: requireNumber(row, "amount", rowRef),
          unit: requireField(row, "unit", rowRef).toUpperCase(),
          share_count: readOptionalNumber(row, "share_count", rowRef),
          eligibility_snapshot_key: readOptionalString(row, "eligibility_snapshot_key"),
          metadata: buildMetadata(row, rowRef, {
            recipient_count: readOptionalNumber(row, "pool_recipient_count", rowRef),
            share_total: readOptionalNumber(row, "pool_share_total", rowRef)
          })
        });
        break;
      case "cashout_events":
        payload.cashout_events.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          source_event_ref: readOptionalString(row, "source_event_ref"),
          event_type: requireField(row, "event_type", rowRef).toUpperCase(),
          occurred_at: requireDateTime(row, "occurred_at", rowRef),
          effective_period: requireField(row, "effective_period", rowRef),
          amount_usd: requireNumber(row, "amount_usd", rowRef),
          fee_usd: readOptionalNumber(row, "fee_usd", rowRef),
          metadata: buildMetadata(row, rowRef, {
            source_system: normalizeSourceSystem(readOptionalString(row, "cashout_source_system"), rowRef),
            breakdown_key: readOptionalString(row, "breakdown_key"),
            scenario_code: readOptionalString(row, "scenario_code"),
            policy_group: readOptionalString(row, "policy_group")
          })
        });
        break;
      case "qualification_windows":
        payload.qualification_windows.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          qualification_type: requireField(row, "qualification_type", rowRef).toUpperCase(),
          window_key: requireField(row, "window_key", rowRef),
          starts_at: requireDateTime(row, "starts_at", rowRef),
          ends_at: requireDateTime(row, "ends_at", rowRef),
          threshold_amount: readOptionalNumber(row, "threshold_amount", rowRef),
          threshold_unit: readOptionalString(row, "threshold_unit")?.toUpperCase() ?? null,
          source_event_ref: readOptionalString(row, "source_event_ref"),
          metadata: buildMetadata(row, rowRef, {})
        });
        break;
      case "qualification_status_history":
        payload.qualification_status_history.push({
          snapshot_id: snapshotId,
          member_stable_key: requireField(row, "member_stable_key", rowRef),
          qualification_type: requireField(row, "qualification_type", rowRef).toUpperCase(),
          status: requireField(row, "status", rowRef).toUpperCase(),
          effective_from: requireDateTime(row, "effective_from", rowRef),
          effective_to: readOptionalDateTime(row, "effective_to", rowRef),
          source_window_key: readOptionalString(row, "source_window_key"),
          source_event_ref: readOptionalString(row, "source_event_ref"),
          metadata: buildMetadata(row, rowRef, {})
        });
        break;
      default:
        throw new Error(`record_type "${recordType}" is not supported (${rowRef}).`);
    }
  });

  return canonicalSnapshotPayloadSchema.parse(payload);
}
