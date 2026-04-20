import {
  Prisma,
  CanonicalBusinessEventType as DbCanonicalBusinessEventType,
  CanonicalCashoutEventType as DbCanonicalCashoutEventType,
  CanonicalDistributionCycle as DbCanonicalDistributionCycle,
  CanonicalMemberRoleType as DbCanonicalMemberRoleType,
  CanonicalOfferType as DbCanonicalOfferType,
  CanonicalPcEntryType as DbCanonicalPcEntryType,
  CanonicalPoolCode as DbCanonicalPoolCode,
  CanonicalPoolEntryType as DbCanonicalPoolEntryType,
  CanonicalQualificationStatus as DbCanonicalQualificationStatus,
  CanonicalQualificationType as DbCanonicalQualificationType,
  CanonicalRewardObligationStatus as DbCanonicalRewardObligationStatus,
  CanonicalRewardSourceCode as DbCanonicalRewardSourceCode,
  CanonicalSourceSystem as DbCanonicalSourceSystem,
  CanonicalSpEntryType as DbCanonicalSpEntryType,
  CanonicalValueUnit as DbCanonicalValueUnit
} from "@prisma/client";
import {
  canonicalSnapshotEnvelopeSchema,
  canonicalSnapshotPayloadSchema,
  type CanonicalSnapshotImport,
  type CanonicalSnapshotPayload
} from "@bgc-alpha/schemas";

import type {
  ReplaceCanonicalSnapshotDataInput,
  getCanonicalSnapshotGraph
} from "./canonical";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSnapshotConsistency(
  parentSnapshotId: string,
  entities: Array<Record<string, unknown>>,
  fieldLabel: string
) {
  for (const [index, entity] of entities.entries()) {
    if (entity.snapshot_id !== parentSnapshotId) {
      throw new Error(
        `${fieldLabel}[${index}] snapshot_id must match the payload snapshot_id (${parentSnapshotId}).`
      );
    }
  }
}

function assertReferencedKeysExist(
  keys: Iterable<string>,
  references: Array<string | null | undefined>,
  fieldLabel: string
) {
  const keySet = new Set(keys);

  for (const reference of references) {
    if (reference && !keySet.has(reference)) {
      throw new Error(`${fieldLabel} references "${reference}", but that key does not exist.`);
    }
  }
}

export function unwrapCanonicalSnapshotImportDocument(
  value: CanonicalSnapshotImport
): CanonicalSnapshotPayload {
  return "payload" in value ? value.payload : value;
}

export function parseCanonicalSnapshotImportDocument(input: unknown): CanonicalSnapshotPayload {
  const envelopeAttempt = canonicalSnapshotEnvelopeSchema.safeParse(input);

  if (envelopeAttempt.success) {
    return envelopeAttempt.data.payload;
  }

  return canonicalSnapshotPayloadSchema.parse(input);
}

export function parseCanonicalSnapshotText(text: string): CanonicalSnapshotPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Canonical snapshot import must be valid JSON.");
  }

  return parseCanonicalSnapshotImportDocument(parsed);
}

export function countCanonicalSnapshotRows(payload: CanonicalSnapshotPayload) {
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

export function validateCanonicalSnapshotPayload(payload: CanonicalSnapshotPayload) {
  assertSnapshotConsistency(payload.snapshot_id, payload.members, "members");
  assertSnapshotConsistency(payload.snapshot_id, payload.member_aliases, "member_aliases");
  assertSnapshotConsistency(payload.snapshot_id, payload.role_history, "role_history");
  assertSnapshotConsistency(payload.snapshot_id, payload.business_events, "business_events");
  assertSnapshotConsistency(payload.snapshot_id, payload.pc_entries, "pc_entries");
  assertSnapshotConsistency(payload.snapshot_id, payload.sp_entries, "sp_entries");
  assertSnapshotConsistency(payload.snapshot_id, payload.reward_obligations, "reward_obligations");
  assertSnapshotConsistency(payload.snapshot_id, payload.pool_entries, "pool_entries");
  assertSnapshotConsistency(payload.snapshot_id, payload.cashout_events, "cashout_events");
  assertSnapshotConsistency(payload.snapshot_id, payload.qualification_windows, "qualification_windows");
  assertSnapshotConsistency(
    payload.snapshot_id,
    payload.qualification_status_history,
    "qualification_status_history"
  );

  const memberKeys = payload.members.map((member) => member.stable_key);
  const eventRefs = payload.business_events.map((event) => event.event_ref);
  const windowKeys = payload.qualification_windows.map(
    (window) => `${window.member_stable_key}::${window.qualification_type}::${window.window_key}`
  );

  assertReferencedKeysExist(
    memberKeys,
    [
      ...payload.member_aliases.map((item) => item.member_stable_key),
      ...payload.role_history.map((item) => item.member_stable_key),
      ...payload.business_events.flatMap((item) => [
        item.actor_member_stable_key,
        item.beneficiary_member_stable_key,
        item.related_member_stable_key
      ]),
      ...payload.pc_entries.map((item) => item.member_stable_key),
      ...payload.sp_entries.map((item) => item.member_stable_key),
      ...payload.reward_obligations.map((item) => item.member_stable_key),
      ...payload.pool_entries.map((item) => item.recipient_member_stable_key),
      ...payload.cashout_events.map((item) => item.member_stable_key),
      ...payload.qualification_windows.map((item) => item.member_stable_key),
      ...payload.qualification_status_history.map((item) => item.member_stable_key)
    ],
    "Canonical member"
  );

  assertReferencedKeysExist(
    eventRefs,
    [
      ...payload.role_history.map((item) => item.source_event_ref),
      ...payload.pc_entries.map((item) => item.source_event_ref),
      ...payload.sp_entries.map((item) => item.source_event_ref),
      ...payload.reward_obligations.map((item) => item.source_event_ref),
      ...payload.pool_entries.map((item) => item.source_event_ref),
      ...payload.cashout_events.map((item) => item.source_event_ref),
      ...payload.qualification_windows.map((item) => item.source_event_ref),
      ...payload.qualification_status_history.map((item) => item.source_event_ref)
    ],
    "Canonical business event"
  );

  assertReferencedKeysExist(
    windowKeys,
    payload.qualification_status_history.map((item) =>
      item.source_window_key
        ? `${item.member_stable_key}::${item.qualification_type}::${item.source_window_key}`
        : null
    ),
    "Canonical qualification window"
  );
}

export function toReplaceCanonicalSnapshotDataInput(
  snapshotId: string,
  importRunId: string | null | undefined,
  payload: CanonicalSnapshotPayload
): ReplaceCanonicalSnapshotDataInput {
  validateCanonicalSnapshotPayload(payload);

  return {
    snapshotId,
    importRunId: importRunId ?? null,
    members: payload.members.map((member) => ({
      stableKey: member.stable_key,
      displayName: member.display_name ?? null,
      metadataJson: toInputJsonValue(member.metadata ?? null)
    })),
    memberAliases: payload.member_aliases.map((alias) => ({
      memberStableKey: alias.member_stable_key,
      sourceSystem: alias.source_system as DbCanonicalSourceSystem,
      aliasKey: alias.alias_key,
      aliasType: alias.alias_type,
      confidence: alias.confidence ?? null,
      metadataJson: toInputJsonValue(alias.metadata ?? null)
    })),
    roleHistory: payload.role_history.map((role) => ({
      memberStableKey: role.member_stable_key,
      roleType: role.role_type as DbCanonicalMemberRoleType,
      roleValue: role.role_value,
      sourceSystem: (role.source_system ?? null) as DbCanonicalSourceSystem | null,
      effectiveFrom: new Date(role.effective_from),
      effectiveTo: role.effective_to ? new Date(role.effective_to) : null,
      sourceEventRef: role.source_event_ref ?? null,
      metadataJson: toInputJsonValue(role.metadata ?? null)
    })),
    offers: payload.offers.map((offer) => ({
      offerCode: offer.offer_code,
      offerType: offer.offer_type as DbCanonicalOfferType,
      sourceSystem: offer.source_system as DbCanonicalSourceSystem,
      label: offer.label,
      priceFiatUsd: offer.price_fiat_usd ?? null,
      pcGrantRuleJson: toInputJsonValue(offer.pc_grant_rule ?? null),
      ltsGenerationRuleJson: toInputJsonValue(offer.lts_generation_rule ?? null),
      rewardRuleReference: offer.reward_rule_reference ?? null,
      metadataJson: toInputJsonValue(offer.metadata ?? null)
    })),
    businessEvents: payload.business_events.map((event) => ({
      eventRef: event.event_ref,
      eventType: event.event_type as DbCanonicalBusinessEventType,
      sourceSystem: event.source_system as DbCanonicalSourceSystem,
      occurredAt: new Date(event.occurred_at),
      effectivePeriodKey: event.effective_period,
      actorMemberStableKey: event.actor_member_stable_key ?? null,
      beneficiaryMemberStableKey: event.beneficiary_member_stable_key ?? null,
      relatedMemberStableKey: event.related_member_stable_key ?? null,
      offerCode: event.offer_code ?? null,
      quantity: event.quantity ?? null,
      amount: event.amount ?? null,
      unit: (event.unit ?? null) as DbCanonicalValueUnit | null,
      metadataJson: toInputJsonValue(event.metadata ?? null)
    })),
    pcEntries: payload.pc_entries.map((entry) => ({
      memberStableKey: entry.member_stable_key,
      sourceEventRef: entry.source_event_ref ?? null,
      entryType: entry.entry_type as DbCanonicalPcEntryType,
      effectivePeriodKey: entry.effective_period,
      amountPc: entry.amount_pc,
      metadataJson: toInputJsonValue(entry.metadata ?? null)
    })),
    spEntries: payload.sp_entries.map((entry) => ({
      memberStableKey: entry.member_stable_key,
      sourceEventRef: entry.source_event_ref ?? null,
      entryType: entry.entry_type as DbCanonicalSpEntryType,
      effectivePeriodKey: entry.effective_period,
      amountSp: entry.amount_sp,
      metadataJson: toInputJsonValue(entry.metadata ?? null)
    })),
    rewardObligations: payload.reward_obligations.map((entry) => ({
      memberStableKey: entry.member_stable_key,
      sourceEventRef: entry.source_event_ref ?? null,
      rewardSourceCode: entry.reward_source_code as DbCanonicalRewardSourceCode,
      distributionCycle: entry.distribution_cycle as DbCanonicalDistributionCycle,
      obligationStatus:
        (entry.obligation_status ?? DbCanonicalRewardObligationStatus.ACCRUED) as DbCanonicalRewardObligationStatus,
      effectivePeriodKey: entry.effective_period,
      amount: entry.amount,
      unit: entry.unit as DbCanonicalValueUnit,
      eligibilitySnapshotKey: entry.eligibility_snapshot_key ?? null,
      metadataJson: toInputJsonValue(entry.metadata ?? null)
    })),
    poolEntries: payload.pool_entries.map((entry) => ({
      sourceEventRef: entry.source_event_ref ?? null,
      recipientMemberStableKey: entry.recipient_member_stable_key ?? null,
      poolCode: entry.pool_code as DbCanonicalPoolCode,
      entryType: entry.entry_type as DbCanonicalPoolEntryType,
      distributionCycle: entry.distribution_cycle as DbCanonicalDistributionCycle,
      effectivePeriodKey: entry.effective_period,
      amount: entry.amount,
      unit: entry.unit as DbCanonicalValueUnit,
      shareCount: entry.share_count ?? null,
      eligibilitySnapshotKey: entry.eligibility_snapshot_key ?? null,
      metadataJson: toInputJsonValue(entry.metadata ?? null)
    })),
    cashoutEvents: payload.cashout_events.map((event) => ({
      memberStableKey: event.member_stable_key,
      sourceEventRef: event.source_event_ref ?? null,
      eventType: event.event_type as DbCanonicalCashoutEventType,
      occurredAt: new Date(event.occurred_at),
      effectivePeriodKey: event.effective_period,
      amountUsd: event.amount_usd,
      feeUsd: event.fee_usd ?? null,
      metadataJson: toInputJsonValue(event.metadata ?? null)
    })),
    qualificationWindows: payload.qualification_windows.map((window) => ({
      memberStableKey: window.member_stable_key,
      qualificationType: window.qualification_type as DbCanonicalQualificationType,
      windowKey: window.window_key,
      startsAt: new Date(window.starts_at),
      endsAt: new Date(window.ends_at),
      thresholdAmount: window.threshold_amount ?? null,
      thresholdUnit: (window.threshold_unit ?? null) as DbCanonicalValueUnit | null,
      sourceEventRef: window.source_event_ref ?? null,
      metadataJson: toInputJsonValue(window.metadata ?? null)
    })),
    qualificationStatusHistory: payload.qualification_status_history.map((status) => ({
      memberStableKey: status.member_stable_key,
      qualificationType: status.qualification_type as DbCanonicalQualificationType,
      status: status.status as DbCanonicalQualificationStatus,
      effectiveFrom: new Date(status.effective_from),
      effectiveTo: status.effective_to ? new Date(status.effective_to) : null,
      sourceWindowKey: status.source_window_key ?? null,
      sourceEventRef: status.source_event_ref ?? null,
      metadataJson: toInputJsonValue(status.metadata ?? null)
    }))
  };
}

type CanonicalSnapshotGraph = NonNullable<Awaited<ReturnType<typeof getCanonicalSnapshotGraph>>>;

function serializeMetadata(value: unknown) {
  return isRecord(value) ? value : null;
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toInputJsonValue(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | null {
  return (value ?? null) as Prisma.InputJsonValue | null;
}

export function serializeCanonicalSnapshotGraph(
  graph: CanonicalSnapshotGraph,
  offers: Array<{
    id: string;
    offerCode: string;
    offerType: DbCanonicalOfferType;
    sourceSystem: DbCanonicalSourceSystem;
    label: string;
    priceFiatUsd: number | null;
    pcGrantRuleJson: unknown;
    ltsGenerationRuleJson: unknown;
    rewardRuleReference: string | null;
    metadataJson: unknown;
  }>
): CanonicalSnapshotPayload {
  const serializedSnapshotId = graph.canonicalSourceSnapshotKey ?? graph.id;
  const memberKeyById = new Map(graph.canonicalMembers.map((member) => [member.id, member.stableKey]));
  const eventRefById = new Map(graph.canonicalBusinessEvents.map((event) => [event.id, event.eventRef]));
  const windowKeyById = new Map(
    graph.canonicalQualificationWindows.map((window) => [window.id, window.windowKey])
  );
  const offerCodeById = new Map(offers.map((offer) => [offer.id, offer.offerCode]));

  return canonicalSnapshotPayloadSchema.parse({
    snapshot_id: serializedSnapshotId,
    members: graph.canonicalMembers.map((member) => ({
      snapshot_id: serializedSnapshotId,
      stable_key: member.stableKey,
      display_name: member.displayName,
      metadata: serializeMetadata(member.metadataJson)
    })),
    member_aliases: graph.canonicalMembers.flatMap((member) =>
      member.aliases.map((alias) => ({
        snapshot_id: serializedSnapshotId,
        member_stable_key: member.stableKey,
        source_system: alias.sourceSystem,
        alias_key: alias.aliasKey,
        alias_type: alias.aliasType,
        confidence: alias.confidence,
        metadata: serializeMetadata(alias.metadataJson)
      }))
    ),
    role_history: graph.canonicalMembers.flatMap((member) =>
      member.roleHistory.map((role) => ({
        snapshot_id: serializedSnapshotId,
        member_stable_key: member.stableKey,
        role_type: role.roleType,
        role_value: role.roleValue,
        source_system: role.sourceSystem,
        effective_from: role.effectiveFrom.toISOString(),
        effective_to: serializeDate(role.effectiveTo),
        source_event_ref: role.sourceEventId ? eventRefById.get(role.sourceEventId) ?? null : null,
        metadata: serializeMetadata(role.metadataJson)
      }))
    ),
    offers: offers.map((offer) => ({
      offer_code: offer.offerCode,
      offer_type: offer.offerType,
      source_system: offer.sourceSystem,
      label: offer.label,
      price_fiat_usd: offer.priceFiatUsd,
      pc_grant_rule: serializeMetadata(offer.pcGrantRuleJson),
      lts_generation_rule: serializeMetadata(offer.ltsGenerationRuleJson),
      reward_rule_reference: offer.rewardRuleReference,
      metadata: serializeMetadata(offer.metadataJson)
    })),
    business_events: graph.canonicalBusinessEvents.map((event) => ({
      snapshot_id: serializedSnapshotId,
      event_ref: event.eventRef,
      event_type: event.eventType,
      source_system: event.sourceSystem,
      occurred_at: event.occurredAt.toISOString(),
      effective_period: event.effectivePeriodKey,
      actor_member_stable_key: event.actorMemberId ? memberKeyById.get(event.actorMemberId) ?? null : null,
      beneficiary_member_stable_key: event.beneficiaryMemberId
        ? memberKeyById.get(event.beneficiaryMemberId) ?? null
        : null,
      related_member_stable_key: event.relatedMemberId
        ? memberKeyById.get(event.relatedMemberId) ?? null
        : null,
      offer_code: event.offerId ? offerCodeById.get(event.offerId) ?? null : null,
      quantity: event.quantity,
      amount: event.amount,
      unit: event.unit,
      metadata: serializeMetadata(event.metadataJson)
    })),
    pc_entries: graph.canonicalPcEntries.map((entry) => ({
      snapshot_id: serializedSnapshotId,
      member_stable_key: memberKeyById.get(entry.memberId) ?? "",
      source_event_ref: entry.sourceEventId ? eventRefById.get(entry.sourceEventId) ?? null : null,
      entry_type: entry.entryType,
      effective_period: entry.effectivePeriodKey,
      amount_pc: entry.amountPc,
      metadata: serializeMetadata(entry.metadataJson)
    })),
    sp_entries: graph.canonicalSpEntries.map((entry) => ({
      snapshot_id: serializedSnapshotId,
      member_stable_key: memberKeyById.get(entry.memberId) ?? "",
      source_event_ref: entry.sourceEventId ? eventRefById.get(entry.sourceEventId) ?? null : null,
      entry_type: entry.entryType,
      effective_period: entry.effectivePeriodKey,
      amount_sp: entry.amountSp,
      metadata: serializeMetadata(entry.metadataJson)
    })),
    reward_obligations: graph.canonicalRewardObligations.map((entry) => ({
      snapshot_id: serializedSnapshotId,
      member_stable_key: memberKeyById.get(entry.memberId) ?? "",
      source_event_ref: entry.sourceEventId ? eventRefById.get(entry.sourceEventId) ?? null : null,
      reward_source_code: entry.rewardSourceCode,
      distribution_cycle: entry.distributionCycle,
      obligation_status: entry.obligationStatus,
      effective_period: entry.effectivePeriodKey,
      amount: entry.amount,
      unit: entry.unit,
      eligibility_snapshot_key: entry.eligibilitySnapshotKey,
      metadata: serializeMetadata(entry.metadataJson)
    })),
    pool_entries: graph.canonicalPoolEntries.map((entry) => ({
      snapshot_id: serializedSnapshotId,
      source_event_ref: entry.sourceEventId ? eventRefById.get(entry.sourceEventId) ?? null : null,
      recipient_member_stable_key: entry.recipientMemberId
        ? memberKeyById.get(entry.recipientMemberId) ?? null
        : null,
      pool_code: entry.poolCode,
      entry_type: entry.entryType,
      distribution_cycle: entry.distributionCycle,
      effective_period: entry.effectivePeriodKey,
      amount: entry.amount,
      unit: entry.unit,
      share_count: entry.shareCount,
      eligibility_snapshot_key: entry.eligibilitySnapshotKey,
      metadata: serializeMetadata(entry.metadataJson)
    })),
    cashout_events: graph.canonicalCashoutEvents.map((event) => ({
      snapshot_id: serializedSnapshotId,
      member_stable_key: memberKeyById.get(event.memberId) ?? "",
      source_event_ref: event.sourceEventId ? eventRefById.get(event.sourceEventId) ?? null : null,
      event_type: event.eventType,
      occurred_at: event.occurredAt.toISOString(),
      effective_period: event.effectivePeriodKey,
      amount_usd: event.amountUsd,
      fee_usd: event.feeUsd,
      metadata: serializeMetadata(event.metadataJson)
    })),
    qualification_windows: graph.canonicalQualificationWindows.map((window) => ({
      snapshot_id: serializedSnapshotId,
      member_stable_key: memberKeyById.get(window.memberId) ?? "",
      qualification_type: window.qualificationType,
      window_key: window.windowKey,
      starts_at: window.startsAt.toISOString(),
      ends_at: window.endsAt.toISOString(),
      threshold_amount: window.thresholdAmount,
      threshold_unit: window.thresholdUnit,
      source_event_ref: window.sourceEventId ? eventRefById.get(window.sourceEventId) ?? null : null,
      metadata: serializeMetadata(window.metadataJson)
    })),
    qualification_status_history: graph.canonicalQualificationStatusHistory.map((status) => ({
      snapshot_id: serializedSnapshotId,
      member_stable_key: memberKeyById.get(status.memberId) ?? "",
      qualification_type: status.qualificationType,
      status: status.status,
      effective_from: status.effectiveFrom.toISOString(),
      effective_to: serializeDate(status.effectiveTo),
      source_window_key: status.sourceWindowId ? windowKeyById.get(status.sourceWindowId) ?? null : null,
      source_event_ref: status.sourceEventId ? eventRefById.get(status.sourceEventId) ?? null : null,
      metadata: serializeMetadata(status.metadataJson)
    }))
  });
}
