import {
  decisionPackSchema,
  type DecisionPack,
  type MilestoneEvaluation,
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
