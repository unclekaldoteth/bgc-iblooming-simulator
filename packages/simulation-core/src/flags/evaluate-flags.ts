import type { RunFlag, SummaryMetrics } from "@bgc-alpha/schemas";

export type RecommendationThresholds = {
  payout_inflow_warning: number;
  payout_inflow_critical: number;
  reserve_runway_warning: number;
  reserve_runway_critical: number;
  reward_concentration_warning: number;
  reward_concentration_critical: number;
};

const defaultThresholds: RecommendationThresholds = {
  payout_inflow_warning: 1,
  payout_inflow_critical: 1.15,
  reserve_runway_warning: 6,
  reserve_runway_critical: 3,
  reward_concentration_warning: 55,
  reward_concentration_critical: 70
};

export function evaluateFlags(
  summary: SummaryMetrics,
  thresholds: RecommendationThresholds = defaultThresholds
) {
  const flags: RunFlag[] = [];

  if (summary.reserve_runway_months < thresholds.reserve_runway_warning) {
    flags.push({
      flag_type: "reserve_runway_below_threshold",
      severity:
        summary.reserve_runway_months < thresholds.reserve_runway_critical ? "critical" : "warning",
      message: "Reserve runway dropped below the preferred minimum threshold."
    });
  }

  if (summary.payout_inflow_ratio > thresholds.payout_inflow_warning) {
    flags.push({
      flag_type: "payout_pressure_exceeds_inflow",
      severity:
        summary.payout_inflow_ratio > thresholds.payout_inflow_critical ? "critical" : "warning",
      message: "Modeled obligations exceed the recognized revenue support available in this snapshot."
    });
  }

  if (summary.reward_concentration_top10_pct > thresholds.reward_concentration_warning) {
    flags.push({
      flag_type: "reward_concentration_high",
      severity:
        summary.reward_concentration_top10_pct > thresholds.reward_concentration_critical
          ? "critical"
          : "warning",
      message: "Reward concentration is skewing too heavily toward the top cohort."
    });
  }

  return flags;
}

export { defaultThresholds as scaffoldRecommendationThresholds };
