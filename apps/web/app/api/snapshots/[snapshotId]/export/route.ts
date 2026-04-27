import { NextResponse } from "next/server";

import {
  getCanonicalSnapshotGraph,
  getSnapshotById,
  listCanonicalOffers,
  listSnapshotMemberMonthFacts,
  serializeCanonicalSnapshotGraph
} from "@bgc-alpha/db";
import type { CanonicalSnapshotPayload } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";

const MONTHLY_CSV_HEADERS = [
  "period_key",
  "member_key",
  "source_system",
  "member_tier",
  "group_key",
  "pc_volume",
  "sp_reward_basis",
  "global_reward_usd",
  "pool_reward_usd",
  "cashout_usd",
  "sink_spend_usd",
  "active_member",
  "recognized_revenue_usd",
  "gross_margin_usd",
  "member_join_period",
  "is_affiliate",
  "cross_app_active",
  "extra_json",
] as const;

const FULL_DETAIL_CSV_HEADERS = [
  "record_type",
  "snapshot_id",
  "stable_key",
  "display_name",
  "group_key",
  "join_period",
  "member_stable_key",
  "source_system",
  "alias_key",
  "alias_type",
  "confidence",
  "role_type",
  "role_value",
  "effective_from",
  "effective_to",
  "source_event_ref",
  "offer_code",
  "offer_type",
  "label",
  "price_fiat_usd",
  "pc_grant",
  "sp_accrual",
  "pc_grant_rule",
  "lts_generation_rule",
  "reward_rule_reference",
  "event_ref",
  "event_type",
  "occurred_at",
  "effective_period",
  "actor_member_stable_key",
  "beneficiary_member_stable_key",
  "related_member_stable_key",
  "quantity",
  "amount",
  "unit",
  "recognized_revenue_usd",
  "gross_margin_usd",
  "entry_type",
  "amount_pc",
  "amount_sp",
  "sink_spend_usd",
  "reward_source_code",
  "distribution_cycle",
  "obligation_status",
  "origin_join_level",
  "tier",
  "imatrix_plan",
  "eligibility_snapshot_key",
  "pool_code",
  "recipient_member_stable_key",
  "share_count",
  "pool_recipient_count",
  "pool_share_total",
  "amount_usd",
  "fee_usd",
  "cashout_source_system",
  "breakdown_key",
  "scenario_code",
  "policy_group",
  "qualification_type",
  "window_key",
  "starts_at",
  "ends_at",
  "threshold_amount",
  "threshold_unit",
  "status",
  "source_window_key",
  "metadata",
] as const;

type MonthlyCsvHeader = (typeof MONTHLY_CSV_HEADERS)[number];
type FullDetailCsvHeader = (typeof FULL_DETAIL_CSV_HEADERS)[number];
type CsvCell = string | number | boolean | null | undefined;
type CsvRow<T extends string> = Record<T, CsvCell>;

function escapeCsvField(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvFromRows<T extends string>(headers: readonly T[], rows: Array<CsvRow<T>>) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvField(row[header])).join(","))
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasRecordValues(value: unknown) {
  return isRecord(value) && Object.keys(value).length > 0;
}

function metadataCell(value: unknown) {
  return hasRecordValues(value) ? JSON.stringify(value) : "";
}

function jsonObjectCell(value: unknown) {
  return hasRecordValues(value) ? JSON.stringify(value) : "";
}

function readMetadataValue(metadata: unknown, keys: string[]) {
  if (!isRecord(metadata)) {
    return undefined;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function readMetadataString(metadata: unknown, ...keys: string[]) {
  const value = readMetadataValue(metadata, keys);
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

function readMetadataNumber(metadata: unknown, ...keys: string[]) {
  const value = readMetadataValue(metadata, keys);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : "";
  }

  return "";
}

function readMetadataBoolean(metadata: unknown, ...keys: string[]) {
  const value = readMetadataValue(metadata, keys);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) {
    return value.toLowerCase() === "true";
  }

  return "";
}

function buildMonthlyCsvRows(
  facts: Awaited<ReturnType<typeof listSnapshotMemberMonthFacts>>
): Array<CsvRow<MonthlyCsvHeader>> {
  return facts.map((fact) => {
    const metadata = isRecord(fact.metadataJson) ? fact.metadataJson : {};

    return {
      period_key: fact.periodKey,
      member_key: fact.memberKey,
      source_system: fact.sourceSystem,
      member_tier: fact.memberTier,
      group_key: fact.groupKey,
      pc_volume: fact.pcVolume,
      sp_reward_basis: fact.spRewardBasis,
      global_reward_usd: fact.globalRewardUsd,
      pool_reward_usd: fact.poolRewardUsd,
      cashout_usd: fact.cashoutUsd,
      sink_spend_usd: fact.sinkSpendUsd,
      active_member: fact.activeMember,
      recognized_revenue_usd: readMetadataNumber(metadata, "recognized_revenue_usd", "recognizedRevenueUsd"),
      gross_margin_usd: readMetadataNumber(metadata, "gross_margin_usd", "grossMarginUsd"),
      member_join_period: readMetadataString(metadata, "member_join_period", "memberJoinPeriod"),
      is_affiliate: readMetadataBoolean(metadata, "is_affiliate", "isAffiliate"),
      cross_app_active: readMetadataBoolean(metadata, "cross_app_active", "crossAppActive"),
      extra_json: metadataCell(metadata),
    };
  });
}

function createFullDetailRow(
  recordType: string,
  snapshotId: string,
  values: Partial<CsvRow<FullDetailCsvHeader>>
): CsvRow<FullDetailCsvHeader> {
  return {
    ...Object.fromEntries(FULL_DETAIL_CSV_HEADERS.map((header) => [header, ""])),
    record_type: recordType,
    snapshot_id: snapshotId,
    ...values,
  } as CsvRow<FullDetailCsvHeader>;
}

function buildFullDetailCsvRows(payload: CanonicalSnapshotPayload): Array<CsvRow<FullDetailCsvHeader>> {
  const rows: Array<CsvRow<FullDetailCsvHeader>> = [];
  const aliasesByMember = new Map<string, typeof payload.member_aliases>();

  for (const alias of payload.member_aliases) {
    const existing = aliasesByMember.get(alias.member_stable_key) ?? [];
    existing.push(alias);
    aliasesByMember.set(alias.member_stable_key, existing);
  }

  const inlineAliasKeys = new Set<string>();

  for (const member of payload.members) {
    const aliases = aliasesByMember.get(member.stable_key) ?? [];
    const inlineAlias = aliases.find((alias) => !hasRecordValues(alias.metadata)) ?? null;

    if (inlineAlias) {
      inlineAliasKeys.add(`${inlineAlias.source_system}::${inlineAlias.alias_key}`);
    }

    rows.push(
      createFullDetailRow("member", payload.snapshot_id, {
        stable_key: member.stable_key,
        display_name: member.display_name,
        group_key: readMetadataString(member.metadata, "group_key", "groupKey"),
        join_period: readMetadataString(member.metadata, "join_period", "joinPeriod", "memberJoinPeriod"),
        source_system: inlineAlias?.source_system,
        alias_key: inlineAlias?.alias_key,
        alias_type: inlineAlias?.alias_type,
        confidence: inlineAlias?.confidence,
        metadata: metadataCell(member.metadata),
      })
    );
  }

  for (const alias of payload.member_aliases) {
    if (inlineAliasKeys.has(`${alias.source_system}::${alias.alias_key}`)) {
      continue;
    }

    rows.push(
      createFullDetailRow("member_alias", payload.snapshot_id, {
        member_stable_key: alias.member_stable_key,
        source_system: alias.source_system,
        alias_key: alias.alias_key,
        alias_type: alias.alias_type,
        confidence: alias.confidence,
        metadata: metadataCell(alias.metadata),
      })
    );
  }

  for (const role of payload.role_history) {
    rows.push(
      createFullDetailRow("role_history", payload.snapshot_id, {
        member_stable_key: role.member_stable_key,
        source_system: role.source_system,
        role_type: role.role_type,
        role_value: role.role_value,
        effective_from: role.effective_from,
        effective_to: role.effective_to,
        source_event_ref: role.source_event_ref,
        metadata: metadataCell(role.metadata),
      })
    );
  }

  for (const offer of payload.offers) {
    rows.push(
      createFullDetailRow("offer", payload.snapshot_id, {
        offer_code: offer.offer_code,
        offer_type: offer.offer_type,
        source_system: offer.source_system,
        label: offer.label,
        price_fiat_usd: offer.price_fiat_usd,
        pc_grant: readMetadataNumber(offer.pc_grant_rule, "pc_grant"),
        sp_accrual: readMetadataNumber(offer.lts_generation_rule, "sp_accrual"),
        pc_grant_rule: jsonObjectCell(offer.pc_grant_rule),
        lts_generation_rule: jsonObjectCell(offer.lts_generation_rule),
        reward_rule_reference: offer.reward_rule_reference,
        metadata: metadataCell(offer.metadata),
      })
    );
  }

  for (const event of payload.business_events) {
    rows.push(
      createFullDetailRow("business_event", payload.snapshot_id, {
        event_ref: event.event_ref,
        event_type: event.event_type,
        source_system: event.source_system,
        occurred_at: event.occurred_at,
        effective_period: event.effective_period,
        actor_member_stable_key: event.actor_member_stable_key,
        beneficiary_member_stable_key: event.beneficiary_member_stable_key,
        related_member_stable_key: event.related_member_stable_key,
        offer_code: event.offer_code,
        quantity: event.quantity,
        amount: event.amount,
        unit: event.unit,
        recognized_revenue_usd: readMetadataNumber(event.metadata, "recognized_revenue_usd", "recognizedRevenueUsd"),
        gross_margin_usd: readMetadataNumber(event.metadata, "gross_margin_usd", "grossMarginUsd"),
        metadata: metadataCell(event.metadata),
      })
    );
  }

  for (const entry of payload.pc_entries) {
    rows.push(
      createFullDetailRow("pc_entry", payload.snapshot_id, {
        member_stable_key: entry.member_stable_key,
        source_event_ref: entry.source_event_ref,
        entry_type: entry.entry_type,
        effective_period: entry.effective_period,
        amount_pc: entry.amount_pc,
        sink_spend_usd: readMetadataNumber(entry.metadata, "sink_spend_usd", "sinkSpendUsd"),
        metadata: metadataCell(entry.metadata),
      })
    );
  }

  for (const entry of payload.sp_entries) {
    rows.push(
      createFullDetailRow("sp_entry", payload.snapshot_id, {
        member_stable_key: entry.member_stable_key,
        source_event_ref: entry.source_event_ref,
        entry_type: entry.entry_type,
        effective_period: entry.effective_period,
        amount_sp: entry.amount_sp,
        metadata: metadataCell(entry.metadata),
      })
    );
  }

  for (const entry of payload.reward_obligations) {
    rows.push(
      createFullDetailRow("reward_obligation", payload.snapshot_id, {
        member_stable_key: entry.member_stable_key,
        source_event_ref: entry.source_event_ref,
        reward_source_code: entry.reward_source_code,
        distribution_cycle: entry.distribution_cycle,
        obligation_status: entry.obligation_status,
        effective_period: entry.effective_period,
        amount: entry.amount,
        unit: entry.unit,
        origin_join_level: readMetadataString(entry.metadata, "origin_join_level", "originJoinLevel"),
        tier: readMetadataNumber(entry.metadata, "tier"),
        imatrix_plan: readMetadataString(entry.metadata, "imatrix_plan", "imatrixPlan"),
        eligibility_snapshot_key: entry.eligibility_snapshot_key,
        metadata: metadataCell(entry.metadata),
      })
    );
  }

  for (const entry of payload.pool_entries) {
    rows.push(
      createFullDetailRow("pool_entry", payload.snapshot_id, {
        source_event_ref: entry.source_event_ref,
        pool_code: entry.pool_code,
        entry_type: entry.entry_type,
        distribution_cycle: entry.distribution_cycle,
        effective_period: entry.effective_period,
        amount: entry.amount,
        unit: entry.unit,
        recipient_member_stable_key: entry.recipient_member_stable_key,
        share_count: entry.share_count,
        pool_recipient_count: readMetadataNumber(entry.metadata, "recipient_count", "recipientCount"),
        pool_share_total: readMetadataNumber(entry.metadata, "share_total", "shareTotal"),
        eligibility_snapshot_key: entry.eligibility_snapshot_key,
        metadata: metadataCell(entry.metadata),
      })
    );
  }

  for (const event of payload.cashout_events) {
    rows.push(
      createFullDetailRow("cashout_event", payload.snapshot_id, {
        member_stable_key: event.member_stable_key,
        source_event_ref: event.source_event_ref,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        effective_period: event.effective_period,
        amount_usd: event.amount_usd,
        fee_usd: event.fee_usd,
        cashout_source_system: readMetadataString(event.metadata, "source_system", "sourceSystem"),
        breakdown_key: readMetadataString(event.metadata, "breakdown_key", "breakdownKey"),
        scenario_code: readMetadataString(event.metadata, "scenario_code", "scenarioCode"),
        policy_group: readMetadataString(event.metadata, "policy_group", "policyGroup"),
        metadata: metadataCell(event.metadata),
      })
    );
  }

  for (const window of payload.qualification_windows) {
    rows.push(
      createFullDetailRow("qualification_window", payload.snapshot_id, {
        member_stable_key: window.member_stable_key,
        qualification_type: window.qualification_type,
        window_key: window.window_key,
        starts_at: window.starts_at,
        ends_at: window.ends_at,
        threshold_amount: window.threshold_amount,
        threshold_unit: window.threshold_unit,
        source_event_ref: window.source_event_ref,
        metadata: metadataCell(window.metadata),
      })
    );
  }

  for (const status of payload.qualification_status_history) {
    rows.push(
      createFullDetailRow("qualification_status", payload.snapshot_id, {
        member_stable_key: status.member_stable_key,
        qualification_type: status.qualification_type,
        status: status.status,
        effective_from: status.effective_from,
        effective_to: status.effective_to,
        source_window_key: status.source_window_key,
        source_event_ref: status.source_event_ref,
        metadata: metadataCell(status.metadata),
      })
    );
  }

  return rows;
}

function getCanonicalPayloadEntityCount(payload: CanonicalSnapshotPayload) {
  return (
    payload.members.length +
    payload.member_aliases.length +
    payload.role_history.length +
    payload.offers.length +
    payload.business_events.length +
    payload.pc_entries.length +
    payload.sp_entries.length +
    payload.reward_obligations.length +
    payload.pool_entries.length +
    payload.cashout_events.length +
    payload.qualification_windows.length +
    payload.qualification_status_history.length
  );
}

function buildSafeFilename(name: string, suffix: string) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `${safeName}${suffix}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authResult = await authorizeApiRequest(["snapshots.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { snapshotId } = await params;
  const format = new URL(request.url).searchParams.get("format");
  const snapshot = await getSnapshotById(snapshotId);

  if (!snapshot) {
    return NextResponse.json(
      { error: "snapshot_not_found" },
      { status: 404 }
    );
  }

  if (format === "canonical" || format === "canonical_json" || format === "full_detail_csv" || format === "canonical_csv") {
    const graph = await getCanonicalSnapshotGraph(snapshotId);

    if (!graph) {
      return NextResponse.json(
        { error: "snapshot_not_found" },
        { status: 404 }
      );
    }

    const referencedOfferIds = new Set(
      graph.canonicalBusinessEvents
        .map((event) => event.offerId)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );
    const offers = (await listCanonicalOffers()).filter((offer) => referencedOfferIds.has(offer.id));
    const payload = serializeCanonicalSnapshotGraph(graph, offers);

    if (getCanonicalPayloadEntityCount(payload) === 0) {
      return NextResponse.json(
        {
          error: "no_full_detail_data_to_export",
          message: "This snapshot has monthly simulation rows, but no full-detail source rows to export."
        },
        { status: 404 }
      );
    }

    if (format === "full_detail_csv" || format === "canonical_csv") {
      const csvContent = csvFromRows(FULL_DETAIL_CSV_HEADERS, buildFullDetailCsvRows(payload));
      const filename = buildSafeFilename(snapshot.name, "_full_detail.csv");

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const filename = buildSafeFilename(snapshot.name, "_canonical.json");

    return new Response(JSON.stringify({ format: "canonical_snapshot_v1", payload }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  }

  const facts = await listSnapshotMemberMonthFacts(snapshotId);

  if (facts.length === 0) {
    return NextResponse.json(
      { error: "no_data_to_export", message: "This snapshot has no imported data to export." },
      { status: 404 }
    );
  }

  const csvContent = csvFromRows(MONTHLY_CSV_HEADERS, buildMonthlyCsvRows(facts));
  const filename = buildSafeFilename(snapshot.name, "_monthly.csv");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
