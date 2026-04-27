import { z } from "zod";

import { strategicObjectiveScorecardSchema } from "./strategic";
import { milestoneEvaluationSchema } from "./run";

export const decisionPackHistoricalTruthCoverageStatusSchema = z.enum([
  "strong",
  "partial",
  "weak"
]);

export const decisionPackHistoricalTruthCoverageRowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["available", "partial", "missing"]),
  detail: z.string().min(1)
});

export const decisionPackHistoricalTruthCoverageSchema = z.object({
  status: decisionPackHistoricalTruthCoverageStatusSchema,
  summary: z.string().min(1),
  rows: z.array(decisionPackHistoricalTruthCoverageRowSchema).default([])
});

export const decisionPackSetupItemSchema = z.object({
  parameter_key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  status: z.enum(["recommended", "caution", "locked"]),
  rationale: z.string().min(1)
});

export const decisionPackRecommendedSetupSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  items: z.array(decisionPackSetupItemSchema).default([]),
  warnings: z.array(z.string()).default([])
});

export const decisionPackDecisionLogEntrySchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["fixed_truth", "recommended", "pending_founder", "blocked"]),
  owner: z.string().min(1),
  rationale: z.string().min(1)
});

export const decisionPackTruthAssumptionItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  classification: z.enum([
    "historical_truth",
    "scenario_lever",
    "scenario_assumption",
    "locked_boundary",
    "derived_assessment"
  ]),
  note: z.string().min(1)
});

export const decisionLogGovernanceStatusSchema = z.enum([
  "draft",
  "proposed",
  "accepted",
  "rejected",
  "deferred"
]);

export const decisionLogResolutionSchema = z.object({
  decision_key: z.string().min(1),
  status: decisionLogGovernanceStatusSchema,
  owner: z.string().min(1),
  resolution_note: z.string().nullable().optional(),
  reviewed_at: z.string().datetime().nullable().optional(),
  reviewed_by_user_id: z.string().nullable().optional()
});

export const canonicalGapAuditRowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["covered", "partial", "missing"]),
  detail: z.string().min(1)
});

export const canonicalGapAuditSchema = z.object({
  readiness: z.enum(["strong", "partial", "weak"]),
  summary: z.string().min(1),
  rows: z.array(canonicalGapAuditRowSchema).default([])
});

export const tokenFlowEvidenceRowSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  status: z.enum(["locked", "ready", "assumption", "blocked"]),
  detail: z.string().min(1)
});

export const tokenFlowEvidencePackSchema = z.object({
  readiness: z.enum(["tokenflow_ready", "whitepaper_draft_ready", "web3_gap_open"]),
  summary: z.string().min(1),
  rows: z.array(tokenFlowEvidenceRowSchema).default([]),
  caveats: z.array(z.string()).default([])
});

export const decisionPackSchema = z.object({
  title: z.string().min(1),
  policy_status: z.enum(["candidate", "risky", "rejected"]),
  recommendation: z.string(),
  preferred_settings: z.array(z.string()),
  rejected_settings: z.array(z.string()),
  unresolved_questions: z.array(z.string()),
  strategic_objectives: z.array(strategicObjectiveScorecardSchema).optional().default([]),
  milestone_evaluations: z.array(milestoneEvaluationSchema).optional().default([]),
  historical_truth_coverage: decisionPackHistoricalTruthCoverageSchema.optional().default({
    status: "weak",
    summary: "Imported data coverage was not recorded for this run.",
    rows: []
  }),
  recommended_setup: decisionPackRecommendedSetupSchema.optional().default({
    title: "Recommended Setup",
    summary: "No structured recommended setup was recorded for this run.",
    items: [],
    warnings: []
  }),
  decision_log: z.array(decisionPackDecisionLogEntrySchema).optional().default([]),
  truth_assumption_matrix: z.array(decisionPackTruthAssumptionItemSchema).optional().default([]),
  canonical_gap_audit: canonicalGapAuditSchema.optional().default({
    readiness: "weak",
    summary: "Canonical fidelity audit was not recorded for this run.",
    rows: []
  }),
  token_flow_evidence: tokenFlowEvidencePackSchema.optional().default({
    readiness: "web3_gap_open",
    summary: "Token flow evidence was not recorded for this run.",
    rows: [],
    caveats: []
  })
});

export type DecisionPack = z.infer<typeof decisionPackSchema>;
export type DecisionPackHistoricalTruthCoverage = z.infer<
  typeof decisionPackHistoricalTruthCoverageSchema
>;
export type DecisionPackHistoricalTruthCoverageRow = z.infer<
  typeof decisionPackHistoricalTruthCoverageRowSchema
>;
export type DecisionPackSetupItem = z.infer<typeof decisionPackSetupItemSchema>;
export type DecisionPackRecommendedSetup = z.infer<typeof decisionPackRecommendedSetupSchema>;
export type DecisionPackDecisionLogEntry = z.infer<
  typeof decisionPackDecisionLogEntrySchema
>;
export type DecisionPackTruthAssumptionItem = z.infer<
  typeof decisionPackTruthAssumptionItemSchema
>;
export type DecisionLogResolution = z.infer<typeof decisionLogResolutionSchema>;
export type CanonicalGapAudit = z.infer<typeof canonicalGapAuditSchema>;
export type CanonicalGapAuditRow = z.infer<typeof canonicalGapAuditRowSchema>;
export type TokenFlowEvidencePack = z.infer<typeof tokenFlowEvidencePackSchema>;
export type TokenFlowEvidenceRow = z.infer<typeof tokenFlowEvidenceRowSchema>;
