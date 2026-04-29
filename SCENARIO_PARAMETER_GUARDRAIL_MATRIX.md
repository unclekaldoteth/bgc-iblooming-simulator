# Scenario Parameter Guardrail Matrix

This matrix defines which scenario parameters can be edited without changing imported business data.

Simple wording used in the UI:

- `Imported Data Only`: use imported snapshot data only. Forecast growth fields stay locked.
- `Add Forecast`: allow forward-looking assumptions. Results must be labeled as estimates.

Engineering note: the internal code still uses `founder_safe` and `advanced_forecast`, but product copy should use the simple labels above.

## Allowed

| Parameter | Status | Why |
| --- | --- | --- |
| `k_pc` | Allowed | ALPHA conversion overlay on top of imported `PC` data. |
| `k_sp` | Allowed | ALPHA conversion overlay on top of imported `SP`, `LTS`, or iBLOOMING Sales Point data. |
| `cap_user_monthly` | Allowed | Monthly ALPHA issuance cap; does not rewrite business events. |
| `cap_group_monthly` | Allowed | Monthly ALPHA issuance cap at group level; does not rewrite business events. |

## Conditional

| Parameter | Status | Why |
| --- | --- | --- |
| `sink_target` | Conditional | Sink posture is a scenario assumption, not a direct understanding-doc rule. |
| `cashout_mode` | Conditional | Cash-out release policy is an ALPHA overlay assumption. |
| `cashout_min_usd` | Conditional | Cash-out release policy is an ALPHA overlay assumption. |
| `cashout_fee_bps` | Conditional | Cash-out release policy is an ALPHA overlay assumption. |
| `cashout_windows_per_year` | Conditional | Cash-out release policy is an ALPHA overlay assumption. |
| `cashout_window_days` | Conditional | Cash-out release policy is an ALPHA overlay assumption. |
| `projection_horizon_months` | Conditional | Extending beyond observed history introduces projection assumptions. |
| `milestone_schedule` | Conditional | Time-staged policy changes are scenario assumptions, not imported data. |
| `sink_adoption_model.*` | Conditional | Adds modeled internal use. Keep it separate from actual `sink_spend_usd`. |
| `alpha_token_policy.*` | Conditional | Changes how ALPHA is described: internal credit, points, off-chain token, or future on-chain token. |
| `forecast_policy.*` | Conditional | Separates imported periods from forecast periods. |
| `web3_tokenomics.*` | Conditional | Adds supply, allocation, liquidity, governance, legal, smart-contract, and market-price assumptions. |

## Locked

| Parameter | Status | Why |
| --- | --- | --- |
| `reward_global_factor` | Locked | A generic global reward multiplier can distort named reward-source semantics from the understanding document. |
| `reward_pool_factor` | Locked | A generic pool reward multiplier can distort named pool semantics from the understanding document. |
| `cohort_assumptions.*` in `Imported Data Only` | Locked | New members, churn, and reactivation are forecasts, not imported data. |

## Founder-Safe Rules

- Create/update/run flows must reject scenarios that change locked parameters.
- UI should keep locked parameters visible as context, but not editable.
- Conditional parameters may remain editable, but summaries must describe them as scenario assumptions.
- Milestone overrides must not re-enable locked parameters.

## Current Founder-Facing Contract

- `Scenarios` create and edit flows may expose allowed and conditional levers, but locked levers must fail validation before save or run.
- `milestone_schedule.parameter_overrides` must follow the same rule set; locked levers remain blocked there too.
- `Decision Pack` and export surfaces must render conditional levers as `evaluated scenario basis`, not as imported business data.
- `Compare` must keep scenario assumptions distinct from company cashflow data.
- If a scenario passes the guardrail check, Compare and Decision Pack may summarize it, but they must still present cashflow data before ALPHA policy overlays.

## Web3 Price Basis Rules

`ALPHA price ($)` is an input assumption. The engine can use the number, but the engine does not prove the market price.

| Price basis | Meaning | Review need |
| --- | --- | --- |
| `not_applicable_internal` | ALPHA has no market price in this scenario. | Safest for internal phase 1. |
| `fixed_accounting` | The team chooses a fixed internal rate, for example `1 ALPHA = $1`. | Needs clear internal accounting rule. |
| `oracle_feed` | Price comes from an external price feed. | Needs a real price source and implementation review. |
| `liquidity_pool` | Price comes from ALPHA and USDC pool reserves. | Needs liquidity assumptions and treasury review. |
| `market_forecast` | Price is estimated for a future public market. | Needs tokenomics, legal, and market review. |
