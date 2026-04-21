# ALPHA Tokenflow v1

Status: refreshed working draft from latest engine basis  
Date: 2026-04-22  
Document type: Phase 1 token-flow and policy mechanics draft  
Primary simulation basis: [SIMULATION-BASIS-ALPHA-v1.md](/Users/fabiomaulana/Documents/bgc%20simulator/deliverables/final-docs/SIMULATION-BASIS-ALPHA-v1.md)

## 1. Tokenflow Objective

Tokenflow v1 should define how value moves through the Phase 1 `ALPHA` system without pretending that the final pilot parameters are already approved.

Its role is to specify:

- source economic inputs
- issuance logic
- policy levers
- spend / hold / controlled cash-out mechanics
- company cashflow lens
- and the currently tested parameter envelope

## 2. Phase 1 Flow Statement

The correct Phase 1 flow is:

`Business Activity -> PC / SP -> ALPHA Issuance -> Spend / Hold / Controlled Cash-Out -> Company Cashflow Lens -> Governance Review`

This means:

- `PC` and `SP` remain the source signals
- `ALPHA` is the policy-token layer
- company cashflow must stay separated from ALPHA movement
- treasury pressure and concentration remain hard control gates

## 3. Source Inputs Used By The Engine

The current engine reads these core member-period inputs:

- `pcVolume`
- `spRewardBasis`
- `globalRewardUsd`
- `poolRewardUsd`
- `cashoutUsd`
- `sinkSpendUsd`
- `activeMember`

When available, it also reads:

- `recognizedRevenueUsd`
- `grossMarginUsd`
- `memberJoinPeriod`
- `isAffiliate`
- `crossAppActive`

Current v1 conclusions are based on:

- snapshot: `BGC Source Bundle Hybrid Accepted 2026-04-21`
- imported rows: `2,016`
- coverage: `2024-04-01` to `2026-01-31`
- truth posture: accepted hybrid truth as the current working basis, not canonical-close final truth

## 4. Issuance Formula

Under `model-v1`, raw issuance remains:

`rawIssued = ((pcVolume / 100) * k_pc + (spRewardBasis / 10) * k_sp) * activityMultiplier`

Interpretation:

- `100 PC` is treated as one USD-equivalent basis
- `10 SP` becomes the base ALPHA conversion unit before scenario coefficients
- activity still modifies issuance before caps

## 5. Current Tested Parameter Envelope

| Parameter | Baseline | Conservative | Growth | Stress |
| --- | ---: | ---: | ---: | ---: |
| `k_pc` | `1.0` | `0.8` | `1.2` | `0.63` |
| `k_sp` | `1.0` | `0.8` | `1.2` | `0.7` |
| User monthly cap | `2500` | `1800` | `3000` | `1200` |
| Group monthly cap | `25000` | `18000` | `30000` | `12000` |
| `sink_target` | `0.3` | `0.4` | `0.25` | `0.5` |
| Cash-out fee | `150 bps` | `250 bps` | `100 bps` | `400 bps` |
| Cash-out minimum | `$25` | `$50` | `$25` | `$75` |
| Cash-out windows / year | `4` | `2` | `6` | `1` |
| Cash-out window days | `7` | `5` | `7` | `3` |

Locked across the founder-safe envelope:

- `reward_global_factor = 1`
- `reward_pool_factor = 1`
- synthetic cohort projection disabled
- milestone schedule empty

## 6. Current Strongest Review Envelope

The current strongest review envelope is:

- scenario: `faithful understanding tes - stress`
- run: `cmo8vy8nq00xgqz3jk0sm2xpp`
- compare interpretation: best current review envelope, still pending founder adoption

Current review values:

| Policy Item | Value |
| --- | --- |
| `k_pc` | `0.63` |
| `k_sp` | `0.7` |
| User monthly cap | `1200` |
| Group monthly cap | `12000` |
| `sink_target` | `0.5` |
| Cash-out mode | `WINDOWS` |
| Cash-out minimum | `$75` |
| Cash-out fee | `400 bps` |
| Cash-out windows / year | `1` |
| Cash-out window days | `3` |

This is a review posture, not yet a production lock or adopted pilot baseline.

## 7. Spend, Hold, And Cash-Out Outcomes

| Scenario | ALPHA Issued | ALPHA Used | ALPHA Held | ALPHA Cash-Out |
| --- | ---: | ---: | ---: | ---: |
| Baseline | `315,783.13` | `27,720.77` | `273,208.67` | `14,853.69` |
| Conservative | `237,653.57` | `20,930.55` | `206,794.00` | `9,929.02` |
| Growth | `389,480.36` | `32,679.81` | `338,391.00` | `18,409.54` |
| Stress | `161,915.10` | `14,193.18` | `141,147.36` | `6,574.56` |

`ALPHA Used`, `ALPHA Held`, and `ALPHA Cash-Out` here are policy-path values, not fiat. Fiat release is tracked separately as `Actual Payout Out`.

Interpretation:

- `Growth` maximizes issuance and release
- `Stress` suppresses issuance and cash-out most strongly
- `Baseline` is still the working default operational reference
- `Conservative` tightens release but still fails fairness

## 8. Company Cashflow Lens

The company cashflow layer should be read separately from ALPHA policy movement.

Current source-backed totals:

| Cashflow Metric | Value |
| --- | ---: |
| Gross cash in | `$3,066,585.68` |
| Retained revenue | `$3,065,519.78` |
| Partner payout out | `$1,065.90` |
| Direct reward obligations | `$451,072.92` |
| Product fulfillment out | `$1,522.71` |
| Pool funding obligations | `$0.00` |

Scenario-specific movement:

| Scenario | Actual Payout Out | Net Treasury Delta | Treasury Pressure |
| --- | ---: | ---: | ---: |
| Baseline | `$14,853.69` | `$3,049,143.38` | `0.18x` |
| Conservative | `$9,929.02` | `$3,054,068.05` | `0.17x` |
| Growth | `$18,409.54` | `$3,045,587.53` | `0.18x` |
| Stress | `$6,574.56` | `$3,057,422.51` | `0.17x` |

This is the correct interpretation:

- company cashflow truth is snapshot-backed
- actual payout out is scenario-mediated
- direct reward obligations and pool funding obligations remain company cashflow-obligation metrics, not ALPHA movement metrics
- fulfillment out is now captured as real outflow
- pool funding still remains unclosed in this basis

## 9. Treasury And Fairness Readout

| Scenario | Policy Status | Treasury Pressure | Reserve Runway | Top 10% Reward Share |
| --- | --- | ---: | ---: | ---: |
| Baseline | `risky` | `0.18x` | `24` | `98.01%` |
| Conservative | `risky` | `0.17x` | `24` | `97.42%` |
| Growth | `risky` | `0.18x` | `24` | `97.64%` |
| Stress | `risky` | `0.17x` | `24` | `96.98%` |

Important implication:

- the founder-safe set does not fail on treasury exhaustion
- it fails on concentration

So Tokenflow v1 must not imply that the current tested set is already deployable as final policy.

## 10. What Tokenflow v1 Can Define Now

Tokenflow v1 can define now:

- the source signals: `PC` and `SP`
- issuance logic
- cap logic
- hold / use / cash-out flow structure
- treasury-accounting separation between ALPHA and fiat cashflow
- the tested scenario envelope as a working range, not a locked production default

Tokenflow v1 should not finalize:

- one production parameter set as already approved
- a claim that fairness is solved
- a claim that all pool-funding behavior is fully represented
- a claim that current sink behavior already proves mature internal utility demand

## 11. Correct Tokenflow v1 Conclusion

The correct Tokenflow v1 conclusion is:

`The current accepted-hybrid snapshot and four-scenario set are sufficient to define ALPHA flow mechanics, cashflow separation, and the current tested policy envelope, but they are not yet sufficient to lock the final pilot parameter set because concentration remains critically high in every tested run.`

That keeps Tokenflow v1 aligned with the latest engine and with the real strength and limits of the current basis.
