export const compareCashflowMetricKeys = [
  "company_gross_cash_in_total",
  "company_retained_revenue_total",
  "company_partner_payout_out_total",
  "company_direct_reward_obligation_total",
  "company_pool_funding_obligation_total",
  "company_actual_payout_out_total",
  "company_product_fulfillment_out_total",
  "company_net_treasury_delta_total"
] as const;

export const compareAlphaMetricKeys = [
  "alpha_issued_total",
  "alpha_spent_total",
  "alpha_held_total",
  "alpha_cashout_equivalent_total"
] as const;

export const compareTreasuryMetricKeys = [
  "payout_inflow_ratio",
  "reserve_runway_months",
  "sink_utilization_rate",
  "reward_concentration_top10_pct"
] as const;

export const compareMetricKeys = [
  ...compareCashflowMetricKeys,
  ...compareAlphaMetricKeys,
  ...compareTreasuryMetricKeys
] as const;

export const compareMetricOptimization: Record<string, "lower" | "higher"> = {
  alpha_issued_total: "higher",
  alpha_spent_total: "higher",
  alpha_held_total: "higher",
  alpha_cashout_equivalent_total: "lower",
  company_actual_payout_out_total: "lower",
  company_direct_reward_obligation_total: "lower",
  company_gross_cash_in_total: "higher",
  company_net_treasury_delta_total: "higher",
  company_partner_payout_out_total: "lower",
  company_pool_funding_obligation_total: "lower",
  company_product_fulfillment_out_total: "lower",
  company_retained_revenue_total: "higher",
  payout_inflow_ratio: "lower",
  reserve_runway_months: "higher",
  sink_utilization_rate: "higher",
  reward_concentration_top10_pct: "lower"
};

export const compareSeriesColors = [
  "#10B981",
  "#6366F1",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
  "#8B5CF6"
] as const;

export const compareRadarDimensions: ReadonlyArray<{
  key: string;
  name: string;
  max: number;
  invert: boolean;
}> = [
  { key: "reserve_runway_months", name: "Treasury Safety", max: 24, invert: false },
  { key: "reward_concentration_top10_pct", name: "Fairness", max: 100, invert: true },
  { key: "sink_utilization_rate", name: "Internal Use", max: 100, invert: false },
  { key: "alpha_issued_total", name: "Growth Support", max: 0, invert: false },
  { key: "payout_inflow_ratio", name: "Cash-Out Risk", max: 2, invert: true }
];
