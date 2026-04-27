import type { SummaryMetrics } from "@bgc-alpha/schemas";

export type SummaryMetricKey = keyof SummaryMetrics;
export type SummaryMetricGroup = "outcome" | "cashflow" | "signal";
export type SummaryMetricUnit = "value" | "usd" | "percent" | "ratio" | "months" | "count";

export type SummaryMetricDefinition = {
  key: SummaryMetricKey;
  label: string;
  shortLabel: string;
  description: string;
  group: SummaryMetricGroup;
  unit: SummaryMetricUnit;
  chartMax?: number;
};

const metricValueFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const metricCurrencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
});

function formatMonthCountLabel(months: number) {
  const formatted = metricValueFormatter.format(months);
  return `${formatted} ${Math.abs(months) === 1 ? "month" : "months"}`;
}

export const summaryMetricDefinitions: SummaryMetricDefinition[] = [
  {
    key: "alpha_issued_total",
    label: "Total ALPHA Issued",
    shortLabel: "Issued",
    description:
      "How much ALPHA the scenario creates after reward rules and caps are applied.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_spent_total",
    label: "Total ALPHA Used",
    shortLabel: "Used",
    description:
      "How much issued ALPHA gets used inside the ecosystem.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_actual_spent_total",
    label: "Actual ALPHA Used",
    shortLabel: "Actual Used",
    description:
      "ALPHA use that comes directly from uploaded internal-use data.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_modeled_spent_total",
    label: "Modeled ALPHA Used",
    shortLabel: "Modeled Used",
    description:
      "Extra ALPHA use estimated from internal-use target and adoption assumptions.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_held_total",
    label: "Total ALPHA Held",
    shortLabel: "Held",
    description:
      "How much issued ALPHA remains held instead of being used or cashed out.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_cashout_equivalent_total",
    label: "ALPHA Cash-Out",
    shortLabel: "Cash-Out",
    description:
      "Amount of issued ALPHA released into the cash-out path under the scenario's payout settings.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_opening_balance_total",
    label: "Opening ALPHA Balance",
    shortLabel: "Opening",
    description:
      "Cumulative ALPHA balance at the start of the simulated ledger window.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_ending_balance_total",
    label: "Ending ALPHA Balance",
    shortLabel: "Ending",
    description:
      "Cumulative ALPHA balance after issued, used, cash-out, and burn/expiry flows.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "alpha_expired_burned_total",
    label: "Expired / Burned ALPHA",
    shortLabel: "Burned",
    description:
      "ALPHA removed from circulation by expiry or burn policy. Phase 1 defaults this to zero until a burn rule is explicitly defined.",
    group: "outcome",
    unit: "value",
  },
  {
    key: "company_gross_cash_in_total",
    label: "Cash In",
    shortLabel: "Cash In",
    description:
      "Total business cash collected before partner payouts or internal rewards.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_retained_revenue_total",
    label: "Revenue Kept",
    shortLabel: "Revenue Kept",
    description:
      "Revenue the company keeps after partner pass-through splits.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_partner_payout_out_total",
    label: "Partner Payout",
    shortLabel: "Partner Payout",
    description:
      "Cash passed through to partners, such as CP creator share on iBLOOMING sales.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_direct_reward_obligation_total",
    label: "Direct Rewards Owed",
    shortLabel: "Direct Rewards",
    description:
      "Direct rewards owed from uploaded business data.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_pool_funding_obligation_total",
    label: "Pool Funding Owed",
    shortLabel: "Pool Funding",
    description:
      "Pool funding owed from uploaded business data, kept separate from actual cash paid out.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_actual_payout_out_total",
    label: "Cash Paid Out",
    shortLabel: "Paid Out",
    description:
      "Cash-equivalent payouts released by the cash-out policy.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_product_fulfillment_out_total",
    label: "Fulfillment Cost",
    shortLabel: "Fulfillment",
    description:
      "Product fulfillment value triggered when PC is redeemed on the BGC side.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "company_net_treasury_delta_total",
    label: "Net Cash Change",
    shortLabel: "Net Cash",
    description:
      "Revenue kept minus partner payouts, cash paid out, and fulfillment cost.",
    group: "cashflow",
    unit: "usd",
  },
  {
    key: "sink_utilization_rate",
    label: "Internal Use Rate",
    shortLabel: "Use Rate",
    description: "Share of issued ALPHA that gets used inside internal-use activities.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "actual_sink_utilization_rate",
    label: "Actual Internal Use Rate",
    shortLabel: "Actual Use",
    description: "Share of issued ALPHA used by uploaded internal-use spending data.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "modeled_sink_utilization_rate",
    label: "Modeled Internal Use Rate",
    shortLabel: "Modeled Use",
    description: "Share of issued ALPHA used by forecast internal-use adoption or policy uplift assumptions.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "payout_inflow_ratio",
    label: "Treasury Pressure",
    shortLabel: "Pressure",
    description:
      "Rewards and payouts compared with revenue support. Above 1.0 means payouts are larger than the revenue support.",
    group: "signal",
    unit: "ratio",
    chartMax: 3,
  },
  {
    key: "reserve_runway_months",
    label: "Reserve Runway",
    shortLabel: "Runway",
    description:
      "Estimated months the reserve can support payouts under the current revenue profile.",
    group: "signal",
    unit: "months",
    chartMax: 24,
  },
  {
    key: "reward_concentration_top10_pct",
    label: "Top 10% Reward Share",
    shortLabel: "Top 10% Share",
    description:
      "Share of total rewards captured by the top 10% of members.",
    group: "signal",
    unit: "percent",
    chartMax: 100,
  },
  {
    key: "forecast_actual_period_count",
    label: "Observed Months",
    shortLabel: "Observed",
    description:
      "Number of months read directly from uploaded data.",
    group: "signal",
    unit: "count",
    chartMax: 24,
  },
  {
    key: "forecast_projected_period_count",
    label: "Forecast Months",
    shortLabel: "Forecast",
    description:
      "Number of months generated from forecast assumptions instead of uploaded history.",
    group: "signal",
    unit: "count",
    chartMax: 24,
  },
];

const summaryMetricDefinitionByKey = Object.fromEntries(
  summaryMetricDefinitions.map((definition) => [definition.key, definition]),
) as Record<SummaryMetricKey, SummaryMetricDefinition>;

export function getSummaryMetricDefinition(key: SummaryMetricKey) {
  return summaryMetricDefinitionByKey[key];
}

export function formatSummaryMetricValue(key: SummaryMetricKey, value: number) {
  const definition = getSummaryMetricDefinition(key);
  const formattedValue = metricValueFormatter.format(value);

  switch (definition.unit) {
    case "usd":
      return metricCurrencyFormatter.format(value);
    case "percent":
      return `${formattedValue}%`;
    case "ratio":
      return `${formattedValue}x`;
    case "months":
      return formatMonthCountLabel(value);
    default:
      return formattedValue;
  }
}
