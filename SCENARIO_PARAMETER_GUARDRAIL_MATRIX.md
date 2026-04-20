# Scenario Parameter Guardrail Matrix

This matrix defines which scenario parameters are safe to expose in founder-facing mode while keeping the understanding document fixed as source of truth.

## Allowed

| Parameter | Status | Why |
| --- | --- | --- |
| `k_pc` | Allowed | ALPHA conversion overlay on top of already-fixed `PC` truth. |
| `k_sp` | Allowed | ALPHA conversion overlay on top of already-fixed `SP/LTS` truth. |
| `cap_user_monthly` | Allowed | Monthly ALPHA issuance cap; does not rewrite business-event truth. |
| `cap_group_monthly` | Allowed | Monthly ALPHA issuance cap at group level; does not rewrite business-event truth. |

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
| `milestone_schedule` | Conditional | Time-staged policy changes are scenario assumptions, not historical truth. |

## Locked

| Parameter | Status | Why |
| --- | --- | --- |
| `reward_global_factor` | Locked | A generic global reward multiplier can distort named reward-source semantics from the understanding document. |
| `reward_pool_factor` | Locked | A generic pool reward multiplier can distort named pool semantics from the understanding document. |
| `cohort_assumptions.*` | Locked | Synthetic member growth, churn, and reactivation are not faithful to understanding-doc event logic. |

## Founder-Safe Rules

- Founder-facing create/update/run flows must reject scenarios that change locked parameters.
- Founder-facing UI should keep locked parameters visible as context, but not editable.
- Conditional parameters may remain editable, but summaries must describe them as scenario assumptions.
- Milestone overrides must not re-enable locked parameters.

## Current Founder-Facing Contract

- `Scenarios` create and edit flows may expose allowed and conditional levers, but locked levers must fail validation before save or run.
- `milestone_schedule.parameter_overrides` must follow the same rule set; locked levers remain blocked there too.
- `Decision Pack` and export surfaces must render conditional levers as `evaluated scenario basis`, not as business truth from the understanding doc.
- `Compare` must keep scenario assumptions distinct from company cashflow truth.
- If a scenario is founder-safe valid, the compare and decision-pack layers may summarize it, but they must still present cashflow truth before ALPHA policy overlays.
