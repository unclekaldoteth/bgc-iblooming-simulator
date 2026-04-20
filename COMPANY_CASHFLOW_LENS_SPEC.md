# Company Cashflow Lens Spec

Source of truth:
- `understanding doc` remains fixed
- snapshot layer remains the factual input
- scenario engine must keep `ALPHA policy math` separate from `company cashflow lens`

This spec defines the company-facing financial metrics that now exist in the simulation layer.

## Principles

- `cash in` must stay separate from `PC`, `SP/LTS`, and reward basis.
- `retained revenue` must stay separate from `gross cash in`.
- `reward obligations created` must stay separate from `actual payouts out`.
- `pool funding obligations` must stay separate from both direct rewards and actual payouts.
- `product fulfillment out` must stay separate from all reward metrics.

## Implemented Summary Metrics

### `company_gross_cash_in_total`
- Meaning:
  Gross business cash collected before pass-through partner payouts or internal obligations.
- Source:
  `metadata.recognized_revenue_basis`
- Row logic:
  - `bgc`: `entry_fee_usd`
  - `iblooming`: `gross_sale_usd`
  - fallback: `recognizedRevenueUsd` when no better basis exists

### `company_retained_revenue_total`
- Meaning:
  Revenue support attributable to the company after pass-through splits.
- Source:
  `recognizedRevenueUsd` plus `metadata.recognized_revenue_basis`
- Row logic:
  - `bgc`: `entry_fee_usd`
  - `iblooming`: `ib_platform_revenue_usd`
  - fallback: `recognizedRevenueUsd`

### `company_partner_payout_out_total`
- Meaning:
  Pass-through partner payout such as the CP creator share.
- Source:
  `metadata.recognized_revenue_basis.cp_user_share_usd`

### `company_direct_reward_obligation_total`
- Meaning:
  Direct reward obligations created by the snapshot truth.
- Source:
  row-level `globalRewardUsd`
- Includes:
  `BGC_RR`, `BGC_GR`, `BGC_MIRACLE_CASH`, `IB_LR`, `IB_CPR`, `IB_GRR`, `IB_IRR`, and other direct reward families represented in the compatibility view.

### `company_pool_funding_obligation_total`
- Meaning:
  Pool funding obligations created by the snapshot truth.
- Primary source:
  `snapshotPoolPeriodFacts.fundingAmount` where `unit = USD`
- Fallback source:
  `metadata.pool_funding_basis`
- Important:
  pool funding is deduplicated per cycle and must not be multiplied by recipient rows.

### `company_actual_payout_out_total`
- Meaning:
  Actual cash-equivalent payout released under the scenario cashout policy.
- Source:
  finalized scenario row `cashout`
- Important:
  this is an actual outflow lens, not an obligation-created lens.

### `company_product_fulfillment_out_total`
- Meaning:
  Physical product fulfillment value triggered by PC redemption on BGC.
- Source:
  `metadata.sink_breakdown_usd.PC_SPEND`
- Important:
  `sink_spend_usd` is not globally treated as fulfillment.
  Only `PC_SPEND` is counted here.

### `company_net_treasury_delta_total`
- Meaning:
  Retained revenue minus immediate company outflows.
- Formula:
  `retained revenue - partner payout out - actual payout out - product fulfillment out`
- Important:
  direct reward obligations and pool funding obligations are shown separately and are not subtracted here to avoid mixing obligation creation with actual cash out.

## Period-Level Build

The engine first builds a per-period financial ledger:

- `grossCashIn`
- `retainedRevenue`
- `partnerPayoutOut`
- `directRewardObligation`
- `poolFundingObligation`
- `actualPayoutOut`
- `productFulfillmentOut`
- `netTreasuryDelta`

These period ledgers then roll up into:
- run summary metrics
- run time-series metrics
- source-system segment metrics
- milestone summary metrics

## What Still Belongs To ALPHA Policy Layer

These remain scenario-policy outputs, not company cashflow truth:
- `alpha_issued_total`
- `alpha_spent_total`
- `alpha_held_total`
- `alpha_cashout_equivalent_total`
- `sink_utilization_rate`

## What Treasury Pressure Still Means

`payout_inflow_ratio` remains a pressure signal:
- numerator: modeled obligations and cashout pressure already computed in the engine
- denominator: retained revenue support imported from snapshot truth

This is not the same thing as `company_net_treasury_delta_total`.
Both must be read together.

## Current Product Surfaces Using This Lens

### Run Summary

- `Business Outcome` appears before `ALPHA Outcome`
- company-cashflow values are rendered in `$`
- ALPHA policy values remain separate from company cashflow

### Treasury View

The current treasury reading order is:

1. `Treasury Position`
2. `Cashflow Obligations`
3. `Treasury Health Signals`
4. `Cashflow Lens`
5. `Risk Flags`

This keeps cashflow truth ahead of secondary safety indicators.

### Decision Pack

- `Evaluated Scenario Basis` may include conditional scenario assumptions, but it must not be presented as historical truth
- `Blockers / Rejection Reasons` explain why a scenario should not be promoted
- exports keep company cashflow values in `$` and keep ALPHA policy values separate

### Compare

The compare workflow now reads this lens in the following order:

1. `Scenario Profile Radar` for quick scan only
2. `Compare Decision Snapshot`
3. `Business Cashflow Comparison`
4. `ALPHA Policy Comparison`
5. `Treasury Risk Comparison`

Important:
- radar is visual only and must not replace the cashflow tables
- compare exports follow the same separation between company cashflow and ALPHA policy outputs
