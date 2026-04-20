import { z } from "zod";

export const summaryMetricsSchema = z.object({
  alpha_issued_total: z.number(),
  alpha_spent_total: z.number(),
  alpha_held_total: z.number(),
  alpha_cashout_equivalent_total: z.number(),
  company_gross_cash_in_total: z.number(),
  company_retained_revenue_total: z.number(),
  company_partner_payout_out_total: z.number(),
  company_direct_reward_obligation_total: z.number(),
  company_pool_funding_obligation_total: z.number(),
  company_actual_payout_out_total: z.number(),
  company_product_fulfillment_out_total: z.number(),
  company_net_treasury_delta_total: z.number(),
  sink_utilization_rate: z.number(),
  payout_inflow_ratio: z.number(),
  reserve_runway_months: z.number(),
  reward_concentration_top10_pct: z.number()
});

export type SummaryMetrics = z.infer<typeof summaryMetricsSchema>;
