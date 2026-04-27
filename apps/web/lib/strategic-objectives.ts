import {
  canonicalGapAuditSchema,
  decisionPackSchema,
  decisionLogResolutionSchema,
  type CanonicalGapAudit,
  type DecisionPack,
  type DecisionPackDecisionLogEntry,
  type DecisionPackHistoricalTruthCoverage,
  type DecisionLogResolution,
  type MilestoneEvaluation,
  type DecisionPackRecommendedSetup,
  type DecisionPackTruthAssumptionItem,
  type TokenFlowEvidencePack,
  type StrategicMetricUnit,
  type StrategicObjectiveKey,
  type StrategicObjectiveScorecard
} from "@bgc-alpha/schemas";

export const strategicObjectiveOrder: StrategicObjectiveKey[] = [
  "revenue",
  "ops_cost",
  "tax",
  "affiliate",
  "active_user"
];

export const strategicObjectiveLabels: Record<StrategicObjectiveKey, string> = {
  revenue: "Revenue Growth",
  ops_cost: "Operational Cost Reduction",
  tax: "Tax Optimization",
  affiliate: "Affiliate Acquisition",
  active_user: "Active-User Growth"
};

const scoreFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency"
});

export function readDecisionPack(value: unknown): DecisionPack | null {
  const parsed = decisionPackSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readStrategicObjectives(value: unknown) {
  const pack = readDecisionPack(value);
  const scorecards = pack?.strategic_objectives ?? [];
  const byKey = new Map(scorecards.map((scorecard) => [scorecard.objective_key, scorecard] as const));

  return strategicObjectiveOrder
    .map((objectiveKey) => byKey.get(objectiveKey))
    .filter((scorecard): scorecard is StrategicObjectiveScorecard => Boolean(scorecard));
}

export function readMilestoneEvaluations(value: unknown) {
  const pack = readDecisionPack(value);
  const milestones = pack?.milestone_evaluations ?? [];

  return milestones
    .filter((milestone): milestone is MilestoneEvaluation => Boolean(milestone))
    .sort((left, right) => left.start_period_key.localeCompare(right.start_period_key));
}

export function readHistoricalTruthCoverage(value: unknown): DecisionPackHistoricalTruthCoverage | null {
  return readDecisionPack(value)?.historical_truth_coverage ?? null;
}

export function readRecommendedSetup(value: unknown): DecisionPackRecommendedSetup | null {
  return readDecisionPack(value)?.recommended_setup ?? null;
}

export function readDecisionLog(value: unknown): DecisionPackDecisionLogEntry[] {
  return readDecisionPack(value)?.decision_log ?? [];
}

export function readTruthAssumptionMatrix(value: unknown): DecisionPackTruthAssumptionItem[] {
  return readDecisionPack(value)?.truth_assumption_matrix ?? [];
}

export function readCanonicalGapAudit(value: unknown): CanonicalGapAudit | null {
  return readDecisionPack(value)?.canonical_gap_audit ?? null;
}

export function readTokenFlowEvidence(value: unknown): TokenFlowEvidencePack | null {
  return readDecisionPack(value)?.token_flow_evidence ?? null;
}

export type DecisionLogDisplayEntry = DecisionPackDecisionLogEntry & {
  governance_status: DecisionLogResolution["status"] | null;
  governance_owner: string;
  resolution_note: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
};

export function readDecisionLogResolutions(value: unknown): DecisionLogResolution[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const parsed = decisionLogResolutionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function mergeDecisionLogWithResolutions(
  entries: DecisionPackDecisionLogEntry[],
  resolutions: DecisionLogResolution[]
): DecisionLogDisplayEntry[] {
  const resolutionByKey = new Map(resolutions.map((item) => [item.decision_key, item] as const));

  return entries.map((entry) => {
    const resolution = resolutionByKey.get(entry.key);

    return {
      ...entry,
      governance_status: resolution?.status ?? null,
      governance_owner: resolution?.owner ?? entry.owner,
      resolution_note: resolution?.resolution_note ?? null,
      reviewed_at: resolution?.reviewed_at ?? null,
      reviewed_by_user_id: resolution?.reviewed_by_user_id ?? null
    };
  });
}

export function formatStrategicMetricValue(value: number, unit: StrategicMetricUnit) {
  const formatted = scoreFormatter.format(value);

  switch (unit) {
    case "usd":
      return currencyFormatter.format(value);
    case "percent":
      return `${formatted}%`;
    case "ratio":
      return `${formatted}x`;
    case "months":
      return `${formatted} mo`;
    default:
      return formatted;
  }
}
