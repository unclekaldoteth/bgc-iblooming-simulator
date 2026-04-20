import type { SummaryMetrics } from "@bgc-alpha/schemas";

export function createDefaultSummaryMetrics(): SummaryMetrics {
  return {
    alpha_issued_total: 0,
    alpha_spent_total: 0,
    alpha_held_total: 0,
    alpha_cashout_equivalent_total: 0,
    company_gross_cash_in_total: 0,
    company_retained_revenue_total: 0,
    company_partner_payout_out_total: 0,
    company_direct_reward_obligation_total: 0,
    company_pool_funding_obligation_total: 0,
    company_actual_payout_out_total: 0,
    company_product_fulfillment_out_total: 0,
    company_net_treasury_delta_total: 0,
    sink_utilization_rate: 0,
    payout_inflow_ratio: 0,
    reserve_runway_months: 0,
    reward_concentration_top10_pct: 0
  };
}
