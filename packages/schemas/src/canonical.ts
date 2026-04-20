import { z } from "zod";

export const canonicalPeriodKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const canonicalSourceSystemSchema = z.enum(["BGC", "IBLOOMING"]);

export const canonicalMemberRoleTypeSchema = z.enum([
  "AFFILIATE_LEVEL",
  "CP_STATUS",
  "EXECUTIVE_CP_STATUS",
  "WEC_STATUS",
  "CROSS_APP_STATUS"
]);

export const canonicalOfferTypeSchema = z.enum([
  "BGC_AFFILIATE_JOIN",
  "BGC_AFFILIATE_UPGRADE",
  "BGC_PHYSICAL_PRODUCT",
  "IB_CP_DIGITAL_PRODUCT",
  "IB_GIM_PRODUCT",
  "IB_IMATRIX_PRODUCT"
]);

export const canonicalBusinessEventTypeSchema = z.enum([
  "AFFILIATE_JOINED",
  "AFFILIATE_UPGRADED",
  "PHYSICAL_PRODUCT_PURCHASED",
  "CP_PRODUCT_SOLD",
  "GIM_SIGNUP_COMPLETED",
  "IMATRIX_PURCHASE_COMPLETED",
  "REWARD_ACCRUED",
  "POOL_FUNDED",
  "POOL_DISTRIBUTED",
  "QUALIFICATION_WINDOW_OPENED",
  "QUALIFICATION_ACHIEVED",
  "CASHOUT_REQUESTED",
  "CASHOUT_APPROVED",
  "CASHOUT_PAID"
]);

export const canonicalValueUnitSchema = z.enum(["USD", "PC", "SP", "COUNT", "SHARE"]);

export const canonicalPcEntryTypeSchema = z.enum(["GRANT", "SPEND", "ADJUSTMENT"]);

export const canonicalSpEntryTypeSchema = z.enum(["ACCRUAL", "DISTRIBUTION", "ADJUSTMENT"]);

export const canonicalRewardSourceCodeSchema = z.enum([
  "BGC_RR",
  "BGC_GR",
  "BGC_MIRACLE_CASH",
  "BGC_GPSP",
  "BGC_WEC_POOL",
  "IB_LR",
  "IB_MIRACLE_CASH",
  "IB_CPR",
  "IB_GRR",
  "IB_IRR",
  "IB_GPS",
  "IB_GMP",
  "IB_GEC"
]);

export const canonicalDistributionCycleSchema = z.enum([
  "EVENT_BASED",
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "YEARLY",
  "ADHOC"
]);

export const canonicalRewardObligationStatusSchema = z.enum([
  "ACCRUED",
  "ELIGIBLE",
  "DISTRIBUTED",
  "CANCELLED"
]);

export const canonicalPoolCodeSchema = z.enum([
  "BGC_GPSP_MONTHLY_POOL",
  "BGC_WEC_QUARTERLY_POOL",
  "IB_GPS_SEMIANNUAL_POOL",
  "IB_WEC_USER_MONTHLY_POOL",
  "IB_GMP_MONTHLY_POOL",
  "IB_GEC_INTERNAL_POOL"
]);

export const canonicalPoolEntryTypeSchema = z.enum([
  "FUNDING",
  "DISTRIBUTION",
  "ALLOCATION",
  "ADJUSTMENT"
]);

export const canonicalCashoutEventTypeSchema = z.enum([
  "REQUESTED",
  "APPROVED",
  "PAID",
  "REJECTED"
]);

export const canonicalQualificationTypeSchema = z.enum([
  "WEC_60_DAY",
  "CPR_YEAR_1",
  "CPR_YEAR_2",
  "EXECUTIVE_CP_APPOINTMENT",
  "POOL_RECIPIENT_SNAPSHOT"
]);

export const canonicalQualificationStatusSchema = z.enum([
  "OPEN",
  "ELIGIBLE",
  "ACHIEVED",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED"
]);

export const canonicalMemberSchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  stable_key: z.string().min(1),
  display_name: z.string().max(255).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalMemberAliasSchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  source_system: canonicalSourceSystemSchema,
  alias_key: z.string().min(1),
  alias_type: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalMemberRoleHistorySchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  role_type: canonicalMemberRoleTypeSchema,
  role_value: z.string().min(1),
  source_system: canonicalSourceSystemSchema.nullable().optional(),
  effective_from: z.string().datetime(),
  effective_to: z.string().datetime().nullable().optional(),
  source_event_ref: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalOfferSchema = z.object({
  id: z.string().optional(),
  offer_code: z.string().min(1),
  offer_type: canonicalOfferTypeSchema,
  source_system: canonicalSourceSystemSchema,
  label: z.string().min(1),
  price_fiat_usd: z.number().nonnegative().nullable().optional(),
  pc_grant_rule: z.record(z.unknown()).nullable().optional(),
  lts_generation_rule: z.record(z.unknown()).nullable().optional(),
  reward_rule_reference: z.string().max(255).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalBusinessEventSchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  event_ref: z.string().min(1),
  event_type: canonicalBusinessEventTypeSchema,
  source_system: canonicalSourceSystemSchema,
  occurred_at: z.string().datetime(),
  effective_period: canonicalPeriodKeySchema,
  actor_member_stable_key: z.string().min(1).nullable().optional(),
  beneficiary_member_stable_key: z.string().min(1).nullable().optional(),
  related_member_stable_key: z.string().min(1).nullable().optional(),
  offer_code: z.string().min(1).nullable().optional(),
  quantity: z.number().nonnegative().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  unit: canonicalValueUnitSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalPcLedgerEntrySchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  source_event_ref: z.string().min(1).nullable().optional(),
  entry_type: canonicalPcEntryTypeSchema,
  effective_period: canonicalPeriodKeySchema,
  amount_pc: z.number().nonnegative(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalSpLedgerEntrySchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  source_event_ref: z.string().min(1).nullable().optional(),
  entry_type: canonicalSpEntryTypeSchema,
  effective_period: canonicalPeriodKeySchema,
  amount_sp: z.number().nonnegative(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalRewardObligationEntrySchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  source_event_ref: z.string().min(1).nullable().optional(),
  reward_source_code: canonicalRewardSourceCodeSchema,
  distribution_cycle: canonicalDistributionCycleSchema,
  obligation_status: canonicalRewardObligationStatusSchema.optional().default("ACCRUED"),
  effective_period: canonicalPeriodKeySchema,
  amount: z.number().nonnegative(),
  unit: canonicalValueUnitSchema,
  eligibility_snapshot_key: z.string().max(255).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalPoolLedgerEntrySchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  source_event_ref: z.string().min(1).nullable().optional(),
  recipient_member_stable_key: z.string().min(1).nullable().optional(),
  pool_code: canonicalPoolCodeSchema,
  entry_type: canonicalPoolEntryTypeSchema,
  distribution_cycle: canonicalDistributionCycleSchema,
  effective_period: canonicalPeriodKeySchema,
  amount: z.number().nonnegative(),
  unit: canonicalValueUnitSchema,
  share_count: z.number().nonnegative().nullable().optional(),
  eligibility_snapshot_key: z.string().max(255).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalCashoutEventSchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  source_event_ref: z.string().min(1).nullable().optional(),
  event_type: canonicalCashoutEventTypeSchema,
  occurred_at: z.string().datetime(),
  effective_period: canonicalPeriodKeySchema,
  amount_usd: z.number().nonnegative(),
  fee_usd: z.number().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalQualificationWindowSchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  qualification_type: canonicalQualificationTypeSchema,
  window_key: z.string().min(1),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  threshold_amount: z.number().nonnegative().nullable().optional(),
  threshold_unit: canonicalValueUnitSchema.nullable().optional(),
  source_event_ref: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalQualificationStatusHistorySchema = z.object({
  id: z.string().optional(),
  snapshot_id: z.string().min(1),
  member_stable_key: z.string().min(1),
  qualification_type: canonicalQualificationTypeSchema,
  status: canonicalQualificationStatusSchema,
  effective_from: z.string().datetime(),
  effective_to: z.string().datetime().nullable().optional(),
  source_window_key: z.string().min(1).nullable().optional(),
  source_event_ref: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});

export const canonicalSnapshotPayloadSchema = z.object({
  snapshot_id: z.string().min(1),
  members: z.array(canonicalMemberSchema).default([]),
  member_aliases: z.array(canonicalMemberAliasSchema).default([]),
  role_history: z.array(canonicalMemberRoleHistorySchema).default([]),
  offers: z.array(canonicalOfferSchema).default([]),
  business_events: z.array(canonicalBusinessEventSchema).default([]),
  pc_entries: z.array(canonicalPcLedgerEntrySchema).default([]),
  sp_entries: z.array(canonicalSpLedgerEntrySchema).default([]),
  reward_obligations: z.array(canonicalRewardObligationEntrySchema).default([]),
  pool_entries: z.array(canonicalPoolLedgerEntrySchema).default([]),
  cashout_events: z.array(canonicalCashoutEventSchema).default([]),
  qualification_windows: z.array(canonicalQualificationWindowSchema).default([]),
  qualification_status_history: z.array(canonicalQualificationStatusHistorySchema).default([])
});

export const canonicalSnapshotEnvelopeSchema = z.object({
  format: z.literal("canonical_snapshot_v1"),
  payload: canonicalSnapshotPayloadSchema
});

export const canonicalSnapshotImportSchema = z.union([
  canonicalSnapshotPayloadSchema,
  canonicalSnapshotEnvelopeSchema
]);

export type CanonicalSourceSystem = z.infer<typeof canonicalSourceSystemSchema>;
export type CanonicalMemberRoleType = z.infer<typeof canonicalMemberRoleTypeSchema>;
export type CanonicalOfferType = z.infer<typeof canonicalOfferTypeSchema>;
export type CanonicalBusinessEventType = z.infer<typeof canonicalBusinessEventTypeSchema>;
export type CanonicalValueUnit = z.infer<typeof canonicalValueUnitSchema>;
export type CanonicalPcEntryType = z.infer<typeof canonicalPcEntryTypeSchema>;
export type CanonicalSpEntryType = z.infer<typeof canonicalSpEntryTypeSchema>;
export type CanonicalRewardSourceCode = z.infer<typeof canonicalRewardSourceCodeSchema>;
export type CanonicalDistributionCycle = z.infer<typeof canonicalDistributionCycleSchema>;
export type CanonicalRewardObligationStatus = z.infer<typeof canonicalRewardObligationStatusSchema>;
export type CanonicalPoolCode = z.infer<typeof canonicalPoolCodeSchema>;
export type CanonicalPoolEntryType = z.infer<typeof canonicalPoolEntryTypeSchema>;
export type CanonicalCashoutEventType = z.infer<typeof canonicalCashoutEventTypeSchema>;
export type CanonicalQualificationType = z.infer<typeof canonicalQualificationTypeSchema>;
export type CanonicalQualificationStatus = z.infer<typeof canonicalQualificationStatusSchema>;
export type CanonicalMember = z.infer<typeof canonicalMemberSchema>;
export type CanonicalMemberAlias = z.infer<typeof canonicalMemberAliasSchema>;
export type CanonicalMemberRoleHistory = z.infer<typeof canonicalMemberRoleHistorySchema>;
export type CanonicalOffer = z.infer<typeof canonicalOfferSchema>;
export type CanonicalBusinessEvent = z.infer<typeof canonicalBusinessEventSchema>;
export type CanonicalPcLedgerEntry = z.infer<typeof canonicalPcLedgerEntrySchema>;
export type CanonicalSpLedgerEntry = z.infer<typeof canonicalSpLedgerEntrySchema>;
export type CanonicalRewardObligationEntry = z.infer<typeof canonicalRewardObligationEntrySchema>;
export type CanonicalPoolLedgerEntry = z.infer<typeof canonicalPoolLedgerEntrySchema>;
export type CanonicalCashoutEvent = z.infer<typeof canonicalCashoutEventSchema>;
export type CanonicalQualificationWindow = z.infer<typeof canonicalQualificationWindowSchema>;
export type CanonicalQualificationStatusHistory = z.infer<
  typeof canonicalQualificationStatusHistorySchema
>;
export type CanonicalSnapshotPayload = z.infer<typeof canonicalSnapshotPayloadSchema>;
export type CanonicalSnapshotEnvelope = z.infer<typeof canonicalSnapshotEnvelopeSchema>;
export type CanonicalSnapshotImport = z.infer<typeof canonicalSnapshotImportSchema>;
