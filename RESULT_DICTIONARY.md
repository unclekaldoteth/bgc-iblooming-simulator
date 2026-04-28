# Result Dictionary

This document explains result pages in simple English: Summary, Distribution, Token Flow, Treasury, and Decision Pack.

## What A Result Is

A result is the output of one completed run.

It answers:

- Which scenario was used?
- Which snapshot was used?
- How much ALPHA was issued, used, held, or sent to cash-out?
- How much cash came in, stayed in the business, or went out?
- Is the result ready, risky, or not usable?

## Result Pages

| Page | What it shows | Best use |
| --- | --- | --- |
| Summary | Main money, ALPHA, safety, goal, and phase overview. | First screen to read after a run finishes. |
| Distribution | Where ALPHA and cash impact are concentrated. | Check member group/source concentration. |
| Token Flow | ALPHA policy, ledger, forecast split, Web3 assumptions, and whitepaper evidence. | Check token-flow logic and Web3 readiness. |
| Treasury | Company cashflow and safety signals. | Check whether the policy is financially safe. |
| Decision Pack | Recommendation, blockers, data quality, assumptions, and export options. | Founder review and decision meeting. |

## Recommended Reading Order

1. Read **Money Summary** first.
2. Read **ALPHA Flow** second.
3. Read **Treasury Safety Signals** third.
4. Read **Data Completeness** before making final claims.
5. Read **Decision Pack** before choosing a pilot baseline.

## Run Status

| UI label | Internal value | Meaning |
| --- | --- | --- |
| Queued | `QUEUED` | Run is waiting for the worker. |
| Running | `RUNNING` | Worker is calculating the result. |
| Completed | `COMPLETED` | Result is available. |
| Failed | `FAILED` | Run stopped because of an error. |

## Recommendation Status

| UI label | Internal value | Meaning |
| --- | --- | --- |
| Ready | `candidate` | The result is usable as a candidate setup. |
| Needs Review | `risky` | The result may be useful, but risks or assumptions need review. |
| Do Not Use | `rejected` | The result should not be used as a policy baseline. |

## Money Metrics

These metrics are in USD and should be kept separate from ALPHA movement.

| UI label | Metric key | Meaning |
| --- | --- | --- |
| Cash In | `company_gross_cash_in_total` | Total business cash collected before payouts, pass-through splits, or other outflows. |
| Revenue Kept | `company_retained_revenue_total` | Revenue kept by the company after partner/creator pass-through share is separated. |
| Partner Payout | `company_partner_payout_out_total` | Cash passed through to partners or creators, such as CP creator share. |
| Direct Rewards Owed | `company_direct_reward_obligation_total` | Direct reward obligations from uploaded business data. |
| Pool Funding Owed | `company_pool_funding_obligation_total` | Pool funding obligations from uploaded business data. |
| Cash Paid Out | `company_actual_payout_out_total` | Cash-equivalent payout released by cash-out policy. |
| Fulfillment Cost | `company_product_fulfillment_out_total` | Product fulfillment value triggered when PC is redeemed on the BGC side. |
| Net Cash Change | `company_net_treasury_delta_total` | Revenue kept minus partner payout, cash paid out, and fulfillment cost. |

Simple formula:

`Net Cash Change = Revenue Kept - Partner Payout - Cash Paid Out - Fulfillment Cost`

## ALPHA Metrics

These metrics describe ALPHA movement. They are not the same as cash.

| UI label | Metric key | Meaning |
| --- | --- | --- |
| Total ALPHA Issued | `alpha_issued_total` | Total ALPHA created by the scenario after conversion, caps, and rules. |
| Total ALPHA Used | `alpha_spent_total` | ALPHA used inside the ecosystem. |
| Actual ALPHA Used | `alpha_actual_spent_total` | ALPHA use backed by uploaded internal-use data. |
| Modeled ALPHA Used | `alpha_modeled_spent_total` | Extra internal use estimated from scenario assumptions. |
| Total ALPHA Held | `alpha_held_total` | ALPHA still held after use and cash-out path. |
| ALPHA Cash-Out | `alpha_cashout_equivalent_total` | ALPHA routed into the cash-out path by scenario payout settings. |
| Opening ALPHA Balance | `alpha_opening_balance_total` | ALPHA balance at the start of the simulated ledger window. |
| Ending ALPHA Balance | `alpha_ending_balance_total` | ALPHA balance after issued, used, cash-out, and burn/expiry movement. |
| Expired / Burned ALPHA | `alpha_expired_burned_total` | ALPHA removed by expiry or burn policy. Phase 1 defaults this to zero unless burn is defined. |

Ledger check:

`Opening Balance + Issued - Used - Cash-Out - Expired/Burned = Ending Balance`

## Safety Metrics

| UI label | Metric key | Meaning | Good direction |
| --- | --- | --- | --- |
| Internal Use Rate | `sink_utilization_rate` | Share of issued ALPHA used inside the ecosystem. | Higher is usually better. |
| Actual Internal Use Rate | `actual_sink_utilization_rate` | Internal use rate backed by uploaded `sink_spend_usd`. | Higher is better when backed by data. |
| Modeled Internal Use Rate | `modeled_sink_utilization_rate` | Internal use rate from forecast/adoption assumptions. | Useful, but must be labeled as assumption. |
| Treasury Pressure | `payout_inflow_ratio` | Payout/reward obligations compared with revenue support. Above `1.0x` means obligations exceed support. | Lower is safer. |
| Reserve Runway | `reserve_runway_months` | Estimated months reserve can support payout obligations. | Higher is safer. |
| Top 10% Reward Share | `reward_concentration_top10_pct` | Share of rewards captured by top 10% of members. | Lower is fairer. |
| Observed Months | `forecast_actual_period_count` | Number of months read from uploaded data. | Higher means more actual data. |
| Forecast Months | `forecast_projected_period_count` | Number of months generated from assumptions. | Higher means more forecast caveat. |

## Distribution Page Terms

| UI label | Meaning |
| --- | --- |
| Distribution Snapshot | Quick view of ALPHA concentration and major totals. |
| ALPHA Flow | ALPHA held, used, or routed to cash-out. |
| ALPHA Issued by Member Group | Which member group receives the largest share of issued ALPHA. |
| ALPHA by Source | Which source system creates the most ALPHA issuance. |
| Money by Source | Cash impact by source system, keeping dollars separate from ALPHA. |
| Largest Member Group | Member group with the largest issued-share. |
| Largest ALPHA Source | Source system with the largest ALPHA issuance share. |

## Token Flow Page Terms

| UI label | Meaning |
| --- | --- |
| Result Mode | Whether the run uses imported data only or includes forecast assumptions. |
| ALPHA Policy | How ALPHA is described: credit, points, off-chain token, or future on-chain token. |
| ALPHA Ledger | Period-by-period ALPHA balance table. |
| Forecast Settings | Split between uploaded data and forecast assumptions. |
| Web3 Assumptions | Supply, liquidity, governance, legal, and smart-contract assumptions. |
| Token Price Basis | How ALPHA price is described or estimated. |
| Whitepaper Evidence | Whether the result has enough evidence to support whitepaper language. |

## Treasury Page Terms

| UI label | Meaning |
| --- | --- |
| Treasury Summary | High-level money view: cash in, revenue kept, net cash, and cash paid out. |
| Cash Owed and Paid | Obligations and payouts that reduce treasury safety. |
| Treasury Health Signals | Pressure, runway, internal use, and concentration signals. |
| Full Money Details | Complete cashflow breakdown used by treasury and decision logic. |
| Warnings | Risk flags from the engine. |

## Decision Pack Terms

| UI label | Meaning |
| --- | --- |
| Decision Summary | Main recommendation and result context. |
| ALPHA Evidence | Whether ALPHA/token-flow claims are supported or still assumptions. |
| Money Basis | Money evidence behind the recommendation. |
| Data Completeness | How complete the uploaded data is. |
| Recommended Setup | Suggested setup from this result. |
| Source Detail Check | Which source details are available or missing. |
| Decision Notes | Items that need review, owner, and saved decision status. |
| Data vs Assumptions | Separates imported data, editable settings, assumptions, locked values, and calculated outputs. |
| Goal Details | Strategic goal scorecards and evidence level. |
| Phase Checkpoints | Status and metrics for each milestone/phase. |
| Settings Used | Scenario settings that supported the recommendation. |
| Blockers | Settings or risks that block adoption. |
| Open Questions | Questions that need decision before final use. |
| Export Report | Download result files. |

## Evidence Labels

| UI label | Meaning |
| --- | --- |
| Direct Data | The result is backed by imported source data. |
| Proxy Estimate | The result uses a proxy or indirect estimate. |
| Checklist Only | The result has only checklist-level evidence. |
| Imported Data | Fixed data from the approved snapshot. |
| Editable | Scenario setting the user can tune. |
| Assumption | Forward-looking or policy assumption. |
| Locked | Protected value that should not be edited. |
| Calculated | Output calculated by the engine. |

## Important Reading Rules

- Do not mix dollars and ALPHA. Money metrics are USD. ALPHA metrics are token/point/credit units.
- `Actual ALPHA Used` comes from uploaded internal-use data.
- `Modeled ALPHA Used` comes from scenario assumptions.
- `Cash Paid Out` is actual cash-equivalent payout, not total issued ALPHA.
- A result with forecast assumptions must be described as an estimate.
- A result with weak data quality can support discussion, but should not be treated as final evidence.
