# ALPHA Simulation Summary v1

Status: working summary for Whitepaper v1 and Tokenflow v1  
Date: 2026-04-22  
Document type: simulation-summary handoff memo  
Primary dataset basis: `BGC Source Bundle Hybrid Accepted 2026-04-21`  
Coverage window: `2024-04-01` to `2026-01-31`  
Imported fact rows: `2,016`

## 1. Basis Used

This summary no longer uses the old `Candidate Fairness Floor` run or the old canonical-bundle basis.

The current working basis is:

- snapshot: `BGC Source Bundle Hybrid Accepted 2026-04-21`
- source type: `hybrid_verified`
- validation posture: `hybrid_validation`
- run set: four refreshed founder-safe scenarios on the same approved snapshot

Compared runs:

| Template | Scenario | Run ID | Completed At (UTC) |
| --- | --- | --- | --- |
| Baseline | `faithful understanding tes - baseline` | `cmo8vy8ba0001qz3jobx0bnot` | `2026-04-21 17:16:20` |
| Conservative | `faithful understanding tes - conservative` | `cmo8vy8gm00b6qz3j863e48od` | `2026-04-21 17:16:21` |
| Growth | `faithful understanding tes - growth` | `cmo8vy8k700mbqz3j2wmdv0f4` | `2026-04-21 17:16:21` |
| Stress | `faithful understanding tes - stress` | `cmo8vy8nq00xgqz3jk0sm2xpp` | `2026-04-21 17:16:21` |

## 2. What Changed In This Basis

This basis is materially better than the earlier v1/v2 working drafts because:

- `DATA_AGG cashout_usd` now survives into the accepted hybrid snapshot and is read by the scenario engine.
- `PC spent` is no longer lost; it now contributes to `product_fulfillment_out`.
- per-source `net treasury delta` no longer double-counts partner payout.
- the snapshot now carries a clearer split between:
  - accepted hybrid truth,
  - quarantined top-up rows,
  - and explicit canonical gaps.

## 3. Company Cashflow Truth

These values are fixed across the four compared scenarios because they come from the same imported snapshot truth:

| Cashflow Metric | Value |
| --- | ---: |
| Gross cash in | `$3,066,585.68` |
| Retained revenue | `$3,065,519.78` |
| Partner payout out | `$1,065.90` |
| Direct reward obligations | `$451,072.92` |
| Pool funding obligations | `$0.00` |
| Product fulfillment out | `$1,522.71` |

Interpretation:

- company cash-in truth is now visible and stable
- partner payout is separated from retained revenue
- direct reward obligations and pool funding obligations remain company cashflow-obligation metrics, not ALPHA movement metrics
- product fulfillment is no longer falsely zero
- pool funding still reads as zero because no explicit pool-funding ledger rows are stored in the current accepted snapshot

## 4. Scenario Result Table

| Scenario | Policy Status | ALPHA Issued | ALPHA Used | ALPHA Held | ALPHA Cash-Out | Actual Payout Out | Net Treasury Delta | Treasury Pressure | Runway | Top 10% Share |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | `risky` | `315,783.13` | `27,720.77` | `273,208.67` | `14,853.69` | `$14,853.69` | `$3,049,143.38` | `0.18x` | `24` | `98.01%` |
| Conservative | `risky` | `237,653.57` | `20,930.55` | `206,794.00` | `9,929.02` | `$9,929.02` | `$3,054,068.05` | `0.17x` | `24` | `97.42%` |
| Growth | `risky` | `389,480.36` | `32,679.81` | `338,391.00` | `18,409.54` | `$18,409.54` | `$3,045,587.53` | `0.18x` | `24` | `97.64%` |
| Stress | `risky` | `161,915.10` | `14,193.18` | `141,147.36` | `6,574.56` | `$6,574.56` | `$3,057,422.51` | `0.17x` | `24` | `96.98%` |

`ALPHA Used`, `ALPHA Held`, and `ALPHA Cash-Out` above remain ALPHA-path values. The fiat release value is `Actual Payout Out`.

## 5. Core Reading

### Treasury is not the immediate blocker

All four runs remain inside a manageable treasury envelope:

- payout / inflow ratio stays in the `0.17x` to `0.18x` range
- reserve runway remains `24 months`
- net treasury delta remains strongly positive in every run

### Fairness concentration is still the main blocker

All four runs remain `risky` because concentration stays critically high:

- top 10% reward share stays between `96.98%` and `98.01%`
- every run still raises `critical:reward_concentration_high`

### The engine now separates policy layer from company cashflow layer more honestly

- scenario changes mostly move `ALPHA issued`, `ALPHA used`, `ALPHA held`, and `ALPHA cash-out`
- imported cashflow truth stays stable
- this makes the output more defensible for downstream Whitepaper and Tokenflow work

## 6. Current Strongest Review Envelope

Compare-level logic now points to the current strongest review envelope as:

- scenario: `faithful understanding tes - stress`
- template: `Stress`
- status: `Needs Review`, not `Ready`

Why `stress` is currently the strongest review envelope:

- tied lowest treasury pressure in the tested set
- highest net treasury delta in the tested set
- lowest top-10% concentration in the tested set
- lowest actual payout out in the tested set

This does **not** mean it is already approved as the production pilot baseline.

It means:

- it is the current strongest review envelope among the four tested runs
- founder review is still required
- fairness concentration still remains unresolved
- founder adoption is still pending before this can be treated as the default working baseline

## 7. Tested Parameter Envelope

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

Locked across the current founder-safe set:

- `reward_global_factor = 1`
- `reward_pool_factor = 1`
- synthetic cohort projection disabled
- milestone schedule empty

## 8. Decision Log Summary

The current decision state is:

| Decision Item | State | Meaning |
| --- | --- | --- |
| Historical business truth stays fixed | `Fixed Truth` | scenario overlays do not rewrite imported snapshot truth |
| Pilot policy envelope from compared runs | `Founder Decision` | strongest current option exists, but is not yet approved |
| Historical truth coverage still needs strengthening | `Blocked` | accepted hybrid truth is useful, but not canonical-close |
| Some strategic claims still rely on proxy/checklist evidence | `Blocked` | ops-cost and tax signals are not direct proof |
| Milestone promotion still needs review | `Founder Decision` | no compared run clears the fairness gate strongly enough |

## 9. Truth vs Assumption Boundary

### Historical truth

- gross cash in
- retained revenue
- partner payout out
- direct reward obligations
- product fulfillment out
- accepted hybrid monthly fact history

### Scenario levers

- `k_pc`
- `k_sp`
- user / group caps

### Scenario assumptions

- sink target
- cash-out mode
- cash-out minimum
- cash-out fee
- cash-out windows
- any projection beyond snapshot window

### Locked boundary

- generic reward multipliers
- synthetic cohort projection

## 10. What This Summary Is Strong Enough To Support

Strong enough:

- Simulation Summary working basis
- Whitepaper v1 architecture and policy-boundary draft
- Tokenflow v1 mechanics draft
- founder discussion about which pilot envelope should be reviewed first

Not strong enough yet:

- claim that one production pilot policy is already approved
- claim that fairness concentration is solved
- claim that historical truth is canonical-close
- claim that pool-funding behavior is fully represented

## 11. Simulation Summary v1 Conclusion

The current accepted hybrid snapshot plus the refreshed four-scenario set is strong enough to become the new working basis for `Simulation Summary`, `Whitepaper v1`, and `Tokenflow v1`.

But the correct conclusion is still:

`ALPHA is now better grounded in company cashflow truth than before, yet the current four-scenario set still does not produce a founder-ready final pilot policy because concentration remains critically high in every tested run.`
