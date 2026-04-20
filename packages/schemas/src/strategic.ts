import { z } from "zod";

export const strategicObjectiveKeySchema = z.enum([
  "revenue",
  "ops_cost",
  "tax",
  "affiliate",
  "active_user"
]);

export const strategicObjectiveStatusSchema = z.enum(["candidate", "risky", "rejected"]);

export const strategicObjectiveEvidenceLevelSchema = z.enum(["direct", "proxy", "checklist"]);

export const strategicMetricUnitSchema = z.enum([
  "value",
  "usd",
  "percent",
  "ratio",
  "months",
  "count",
  "score"
]);

export const strategicPrimaryMetricSchema = z.object({
  metric_key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: strategicMetricUnitSchema
});

export const strategicObjectiveScorecardSchema = z.object({
  objective_key: strategicObjectiveKeySchema,
  label: z.string().min(1),
  status: strategicObjectiveStatusSchema,
  score: z.number().min(0).max(100),
  evidence_level: strategicObjectiveEvidenceLevelSchema,
  primary_metrics: z.array(strategicPrimaryMetricSchema),
  reasons: z.array(z.string())
});

export type StrategicObjectiveKey = z.infer<typeof strategicObjectiveKeySchema>;
export type StrategicObjectiveStatus = z.infer<typeof strategicObjectiveStatusSchema>;
export type StrategicObjectiveEvidenceLevel = z.infer<typeof strategicObjectiveEvidenceLevelSchema>;
export type StrategicMetricUnit = z.infer<typeof strategicMetricUnitSchema>;
export type StrategicPrimaryMetric = z.infer<typeof strategicPrimaryMetricSchema>;
export type StrategicObjectiveScorecard = z.infer<typeof strategicObjectiveScorecardSchema>;
