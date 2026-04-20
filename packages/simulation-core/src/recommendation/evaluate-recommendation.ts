import type { RunFlag, SummaryMetrics } from "@bgc-alpha/schemas";

import {
  scaffoldRecommendationThresholds,
  type RecommendationThresholds
} from "../flags/evaluate-flags";

export function evaluateRecommendation(
  summary: SummaryMetrics,
  flags: RunFlag[],
  thresholds: RecommendationThresholds = scaffoldRecommendationThresholds
) {
  if (
    summary.reserve_runway_months < thresholds.reserve_runway_critical ||
    summary.payout_inflow_ratio > thresholds.payout_inflow_critical
  ) {
    return {
      policy_status: "rejected" as const,
      reasons: ["Treasury safety thresholds are violated against the current recognized revenue support."]
    };
  }

  if (flags.length > 0) {
    return {
      policy_status: "risky" as const,
      reasons: flags.map((flag) => flag.message)
    };
  }

  return {
    policy_status: "candidate" as const,
    reasons: ["Run stays inside the current baseline model thresholds against recognized revenue support."]
  };
}
