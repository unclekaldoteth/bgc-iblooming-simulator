# Scenario Dictionary

This document explains the `Scenarios` step in simple English.

Rule for this document:

- Use the UI label first.
- Show internal values in `backticks`.
- Separate imported data, editable policy choices, and forecast assumptions.

## What A Scenario Is

A scenario is a reusable policy setup.

It does not change the uploaded snapshot data. It tells the engine how to test ALPHA rules on top of an approved snapshot.

Simple reading:

1. Snapshot = the data input.
2. Scenario = the rules and assumptions to test.
3. Run = the calculated result.
4. Compare = side-by-side review of completed runs.

## Scenario Creation Flow

| Step | UI area | What the user chooses | Why it matters |
| --- | --- | --- | --- |
| 1 | Template | `Baseline`, `Conservative`, `Growth`, or `Stress` | Starts from a known policy shape. |
| 2 | Name | Scenario name | Makes the setup easy to find later. |
| 3 | Baseline model | Example: `model-v1` | Chooses the core engine ruleset. |
| 4 | Default snapshot | Approved data snapshot | Optional default data source for runs. |
| 5 | Result mode | `Imported Data Only` or `Add Forecast` | Decides whether forecasts can be added. |
| 6 | Policy parameters | Conversion, caps, sink, cash-out, Web3 assumptions | Controls how the run behaves. |
| 7 | Save | Create/update scenario | Stores the reusable setup. |
| 8 | Run | Launch simulation | Applies the scenario to an approved snapshot. |

## Scenario Templates

| UI label | Internal value | Meaning | Typical use |
| --- | --- | --- | --- |
| Baseline | `Baseline` | Balanced default setup. | Test the standard policy profile. |
| Conservative | `Conservative` | Lower rewards, tighter caps, higher payout controls. | Reduce treasury and cash-out exposure. |
| Growth | `Growth` | Higher reward support and looser growth posture. | Test adoption upside. |
| Stress | `Stress` | Restrictive or worst-case settings. | Test treasury safety under pressure. |

## Scenario Modes

| UI label | Internal value | Meaning | What stays locked |
| --- | --- | --- | --- |
| Imported Data Only | `founder_safe` | Uses uploaded data only. No synthetic growth is added. | Growth projection and cohort forecast stay off. |
| Add Forecast | `advanced_forecast` | Allows forward-looking assumptions. | Locked core reward math still stays locked. |

Important: `Add Forecast` does not make forecast true. It only tells the engine to include assumptions and label the output as estimated.

## Guardrail Status

| UI label | Internal status | Meaning |
| --- | --- | --- |
| Editable | `allowed` | The user can change this setting without rewriting imported business data. |
| Assumption | `conditional` | The user can change it, but the result must be read as a scenario assumption. |
| Locked | `not_safe` | The user should not change it because it can rewrite core reward meaning or bias comparison. |

## Core Scenario Fields

| Field | UI label | Status | Meaning |
| --- | --- | --- | --- |
| `scenario_mode` | Result Mode | Assumption | Controls imported-only vs forecast-enabled runs. |
| `k_pc` | PC to ALPHA multiplier | Editable | Converts imported PC activity into ALPHA issuance. Higher value issues more ALPHA from PC. |
| `k_sp` | SP to ALPHA multiplier | Editable | Converts imported SP/LTS basis into ALPHA issuance. Higher value issues more ALPHA from SP. |
| `reward_global_factor` | Global reward factor | Locked | Core global reward multiplier from the baseline model. Locked to avoid rewriting named reward rules. |
| `reward_pool_factor` | Pool reward factor | Locked | Core pool reward multiplier from the baseline model. Locked to avoid rewriting named pool rules. |
| `cap_user_monthly` | User monthly cap | Editable | Maximum ALPHA one member can receive per month. |
| `cap_group_monthly` | Group monthly cap | Editable | Maximum ALPHA one group can receive per month. |
| `sink_target` | Internal use target | Assumption | Target share of issued ALPHA expected to be used inside the ecosystem. |
| `projection_horizon_months` | Planning horizon | Assumption | Number of months to project beyond imported data. |
| `milestone_schedule` | Phases | Assumption | Time-based policy phases with limited parameter overrides. |

## Cash-Out Policy

Cash-out policy controls how much ALPHA can move into the cash payout path.

| Field | UI label | Values | Meaning |
| --- | --- | --- | --- |
| `cashout_mode` | Cash-out mode | `ALWAYS_OPEN`, `WINDOWS` | `ALWAYS_OPEN` means cash-out is always allowed. `WINDOWS` means cash-out is allowed only in scheduled windows. |
| `cashout_min_usd` | Minimum cash-out | Number in USD | Minimum payout size. Smaller balances below this value do not cash out. |
| `cashout_fee_bps` | Cash-out fee | Basis points | Fee charged on cash-out. `100 bps = 1%`. |
| `cashout_windows_per_year` | Windows per year | Positive integer | Number of cash-out periods per year when mode is `WINDOWS`. |
| `cashout_window_days` | Window length | Positive integer | Number of days each cash-out window stays open. |

## Growth Projection

These fields are used only when forecast is allowed.

| Field | Meaning |
| --- | --- |
| `new_members_per_month` | Estimated new members added each month. |
| `monthly_churn_rate_pct` | Estimated share of members becoming inactive each month. |
| `monthly_reactivation_rate_pct` | Estimated share of inactive members becoming active again. |
| `affiliate_new_member_share_pct` | Estimated share of new members treated as affiliates. |
| `cross_app_adoption_rate_pct` | Estimated share of members active across BGC and iBLOOMING. |
| `new_member_value_factor` | Value factor for new members compared with current members. |
| `reactivated_member_value_factor` | Value factor for reactivated members compared with current members. |

In `Imported Data Only`, these values are reset to passive defaults because growth projection is not imported history.

## Internal Use Adoption

This section models future internal use. It stays separate from actual uploaded `sink_spend_usd`.

| Field | Meaning |
| --- | --- |
| `sink_adoption_rate_pct` | Estimated share of eligible members who use ALPHA internally. |
| `eligible_member_share_pct` | Estimated share of members eligible for internal-use activity. |
| `avg_sink_ticket_usd` | Average internal-use transaction size in USD. |
| `sink_frequency_per_month` | Estimated internal-use transactions per member per month. |
| `alpha_payment_share_pct` | Share of internal-use payment expected to use ALPHA. |
| `sink_growth_rate_pct` | Monthly growth rate for modeled internal use. |

## Forecast Policy

| Field | Values | Meaning |
| --- | --- | --- |
| `mode` | `snapshot_window`, `projection_overlay`, `cohort_projection` | How the result separates imported periods and projected periods. |
| `actuals_through_period` | `YYYY-MM` or blank | Last period treated as uploaded actual data. |
| `forecast_start_period` | `YYYY-MM` or blank | First period treated as forecast. |
| `forecast_basis` | `none`, `repeat_snapshot`, `milestone_overlay`, `cohort_assumption` | Method used to create forecast periods. |
| `stress_case` | `none`, `base`, `downside`, `upside` | Scenario stress lens. |

## ALPHA Policy

| Field | Values | Meaning |
| --- | --- | --- |
| `classification` | `internal_credit`, `points`, `off_chain_token`, `future_on_chain_token` | How ALPHA is described. This controls token flow and whitepaper language. |
| `phase` | `phase_1_internal`, `phase_2_bridge`, `phase_3_on_chain` | Current product phase. |
| `transferability` | `non_transferable`, `platform_limited`, `externally_transferable` | Whether ALPHA can move outside the platform. |
| `settlement_unit` | `alpha_internal`, `usd_equivalent`, `on_chain_token` | What unit is used for settlement language. |
| `on_chain_status` | `not_on_chain`, `planned`, `testnet`, `mainnet` | Current on-chain status. |
| `evidence_standard` | `simulation_backed`, `founder_decision_required`, `legal_review_required` | Review level needed before claims are treated as final. |

## Web3 Tokenomics

These are assumptions for public-token or future-token analysis. They are not historical snapshot facts.

| Area | Fields | Meaning |
| --- | --- | --- |
| Network | `network_status` | Whether ALPHA is internal only, planned, testnet, or mainnet. |
| Supply | `supply_model`, `max_supply` | Whether supply is internal, uncapped, fixed, or capped emission. |
| Allocation | `community_pct`, `treasury_pct`, `team_pct`, `investor_pct`, `liquidity_pct` | Token allocation percentages. For a public token plan, these should sum to 100%. |
| Vesting | `team_cliff_months`, `team_vesting_months`, `investor_cliff_months`, `investor_vesting_months` | Unlock timing for team and investor allocation. |
| Liquidity | `enabled`, `reserve_pct`, `launch_pool_usd` | Liquidity setup and reserve assumptions. |
| Market | `price_basis`, `alpha_usd_price`, `circulating_supply`, `treasury_reserve_usd`, `liquidity_pool_alpha`, `liquidity_pool_usd`, `monthly_buy_demand_usd`, `monthly_sell_pressure_alpha`, `monthly_burn_alpha`, `vesting_unlock_alpha` | Price, demand, sell pressure, burn, and reserve assumptions. |
| Governance | `mode`, `voting_token_enabled` | Who controls decisions: team admin, multisig, token voting, or DAO. |
| Smart contract | `chain`, `standard`, `audit_status` | Chain, token standard, and contract audit status. |
| Legal | `classification`, `kyc_required`, `jurisdiction_notes` | Legal review status and compliance notes. |

## Token Price Basis

| UI label | Internal value | Meaning |
| --- | --- | --- |
| Internal only / no market price | `not_applicable_internal` | No public market price is used. |
| Fixed internal rate | `fixed_accounting` | Team sets an internal accounting value, for example `1 ALPHA = $1`. |
| Oracle price feed | `oracle_feed` | Price comes from an external price feed. Needs a reliable source. |
| Liquidity pool price | `liquidity_pool` | Price is derived from ALPHA and USD liquidity pool reserves. |
| Market forecast | `market_forecast` | Price is estimated for a future market. This is not observed data. |

## Run Readiness Rules

A scenario can run only when:

- the scenario exists,
- the selected snapshot exists,
- the snapshot is approved,
- imported rows exist,
- P0 data fingerprint is complete,
- locked scenario fields match the baseline model defaults.

If the Run button is disabled, check snapshot approval, data fingerprint, imported row count, and locked-parameter validation first.
