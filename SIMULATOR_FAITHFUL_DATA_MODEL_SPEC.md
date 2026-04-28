# Faithful Simulator Data Model Spec

Status: Working specification  
Date: 2026-04-18  
Scope: Define the minimum simulator data model required to stay faithful to the immutable BGC x iBLOOMING understanding document.

Plain-language note: this is the technical design spec. In user-facing docs and UI, use `Full Detail Data` instead of `canonical data` whenever possible. `Canonical` means the engine has a structured source-detail version of the business data, not just a monthly summary.

For snapshot file types, CSV columns, `record_type`, and accepted values, see [SNAPSHOT_DATA_DICTIONARY.md](./SNAPSHOT_DATA_DICTIONARY.md).

## 1. Core Rule

The understanding document is the final business source of truth.

This repository may change its schema, ingestion, projections, and engine behavior, but it must not reinterpret, merge, weaken, or replace the business meaning that already exists in the understanding document.

The simulator is allowed to derive secondary views for speed and UX.

The simulator is not allowed to use derived views as the primary truth when those views lose business meaning.

## 2. What "Faithful" Means

For this simulator, "faithful to the understanding document" means:

- every material business unit keeps its original meaning
- every important status or qualification is modeled explicitly
- every reward source keeps its original source identity
- every rule that depends on ordering, timing, or eligibility can be computed from stored data
- every payout, pool, and accrual can be traced back to the business event that created it
- later ALPHA simulation is built on top of that canonical model, not on top of collapsed proxy fields

Faithful does not require the first production implementation to replay every historical row perfectly.

Faithful does require the canonical schema to be capable of representing the rules correctly.

## 3. Non-Negotiable Modeling Rules

- Do not merge `PC`, `SP`, `LTS`, fiat revenue, product spend, pool funding, and cash-out into one generic value bucket.
- Do not collapse named reward sources such as `RR`, `GR`, `BGC-MC`, `GPSP`, `WEC Pool`, `LR`, `iBLOOMING-MC`, `CPR`, `GRR`, `iRR`, `GPS`, `GMP`, and `GEC` into generic reward totals at the canonical layer.
- Do not model `WEC`, `Executive CP`, `CP`, affiliate level, or qualification windows as passive labels only. They must be stateful and time-aware.
- Do not make `member-month` aggregates the canonical input layer.
- Do not use proxy fields as permanent substitutes for business-ledger truth.
- Do not change the semantics already fixed by the understanding document.

## 4. Canonical Model Layers

The simulator should have five layers.

### Layer A: Identity and Role State

Required canonical entities:

- `member`
- `member_identity_link`
- `affiliate_account`
- `cp_account`
- `status_history`

Minimum status history that must be representable:

- affiliate level history
- CP status history
- Executive CP status history
- WEC qualification status history
- cross-app membership identity

Reason:

The understanding document uses status and eligibility as active rule inputs, not just display labels.

### Layer B: Business Event Ledger

The canonical source should be event-based.

Minimum event families:

- affiliate joined
- affiliate upgraded
- physical product purchased
- CP product sold
- GiM signup completed
- iMATRIX purchase completed
- reward accrued
- pool funded
- pool distributed
- qualification window opened
- qualification achieved
- cash-out requested
- cash-out approved
- cash-out paid

Each event must carry:

- `event_id`
- `event_type`
- `occurred_at`
- `effective_period`
- `source_system`
- `actor_member_id`
- `beneficiary_member_id`
- `related_member_id`
- `offer_or_product_code`
- `amount`
- `unit`
- `metadata`

Not every field must be populated for every event.

Each event must still be able to answer:

- who triggered it
- who benefits from it
- what business action it came from
- what unit it changed
- when it happened

### Layer C: Unit and Obligation Ledgers

The simulator needs separate ledgers, not one compressed metric row.

Required ledgers:

- `fiat_ledger`
- `pc_ledger`
- `sp_ledger`
- `reward_obligation_ledger`
- `pool_ledger`
- `cashout_ledger`

Recommended unit policy:

- fiat amounts remain fiat
- `PC` remains `PC`
- `LTS/SP` remains `SP` or `LTS_SP`
- reward obligations remain tagged by reward source and amount unit
- pool balances remain tagged by pool type and funding source

This is the minimum separation needed so that the later ALPHA layer can ask:

- which business value came from `PC`
- which came from `SP`
- which came from reward obligations
- which was funded into pools
- which became spend
- which became cash-out liability

### Layer D: Qualification and Distribution State

Some rules in the understanding document are not simple transactions. They depend on windows, thresholds, and permanent status changes.

Required stateful constructs:

- WEC 60-day qualification window
- permanent WEC attainment state
- Executive CP appointment/eligibility state
- CPR year-1 versus year-2 eligibility state
- pool recipient snapshots at distribution time

This layer can be computed from events, but it must exist explicitly in the simulator state model.

### Layer E: Derived Simulation Views

Only after Layers A to D exist should the simulator create derived views such as:

- member-period facts
- source-system period facts
- reward-source period facts
- pool period facts
- treasury period facts
- scenario comparison summaries

These views are allowed to be aggregated.

These views must never become the only place where business meaning survives.

## 5. Canonical Reward Source Registry

The canonical model must preserve reward-source identity.

Minimum `reward_source_code` values:

- `bgc_rr`
- `bgc_gr`
- `bgc_miracle_cash`
- `bgc_gpsp`
- `bgc_wec_pool`
- `ib_lr`
- `ib_miracle_cash`
- `ib_cpr`
- `ib_grr`
- `ib_irr`
- `ib_gps`
- `ib_gmp`
- `ib_gec`

Each reward obligation entry should reference:

- `reward_source_code`
- `origin_event_id`
- `beneficiary_member_id`
- `amount`
- `unit`
- `distribution_cycle`
- `eligibility_snapshot_key`

Reason:

The simulator summary later needs to say not only "how much reward exists", but also "which exact rule created it".

## 6. Canonical Pool Registry

Pool identity must also remain explicit.

Minimum `pool_code` values:

- `bgc_gpsp_monthly_pool`
- `bgc_wec_quarterly_pool`
- `ib_gps_semiannual_pool`
- `ib_wec_user_monthly_pool`
- `ib_gmp_monthly_pool`
- `ib_gec_internal_pool`

Each pool ledger entry should distinguish:

- funding event
- funding source
- distribution event
- recipient set
- recipient share logic
- payout cycle

Reason:

Pool funding and pool distribution are not the same business act.

## 7. Minimum Offer and Product Registry

The simulator must preserve what kind of business activity created value.

Minimum offer types:

- BGC affiliate join offers by level
- BGC physical products
- CP digital products
- GiM products
- iMATRIX products

Minimum fields:

- `offer_code`
- `offer_type`
- `source_system`
- `price_fiat_usd`
- `pc_grant_rule`
- `lts_generation_rule`
- `reward_rule_reference`

Reason:

Without this, the simulator cannot separate:

- membership entry value
- product purchase value
- physical-product credit behavior
- digital product revenue splits

## 8. Required Event Types By Business Area

### BGC

The canonical schema must be able to represent:

- affiliate join by level
- affiliate upgrade by level
- PC granted from entry/payment
- PC spent on physical product
- LTS generated from qualifying entry value
- RR accrual
- GR accrual
- BGC-MC accrual
- GPSP monthly funding
- GPSP distribution
- WEC qualification progress
- WEC qualification achieved
- WEC pool funding
- WEC pool distribution

### iBLOOMING

The canonical schema must be able to represent:

- CP product sale
- CP seller revenue share
- LR accrual
- iBLOOMING-MC accrual
- CPR accrual with year-based state
- GiM signup reward accrual
- iMATRIX reward accrual
- GPS semiannual funding
- GPS distribution
- GMP monthly funding/distribution
- GEC internal distribution

## 9. Required Timing Semantics

The schema must preserve enough timing detail to compute rules that depend on:

- the next `10` joins after a member
- the next `10` purchases after a purchase event
- `60-day` qualification windows
- monthly distributions
- quarterly distributions
- semiannual distributions
- year-1 versus year-2 CPR logic

Therefore the canonical layer must preserve at least:

- event timestamp
- effective business period
- ordering within the same period when required

Month-only storage is not enough for the canonical layer.

Month-only storage is acceptable only as a derived read model.

## 10. Required Separation Between Canonical and Derived Data

The simulator should separate:

- `canonical truth`
- `derived projection`
- `scenario output`

Recommended rule:

- canonical truth is event and ledger based
- derived projection may be member-period or pool-period based
- scenario output is ALPHA or policy-specific and must not overwrite canonical truth

This allows future ALPHA logic to change without rewriting business history.

## 11. Why The Current Repo Is Not Yet Faithful

The current repo is useful, but it is not yet faithful to the understanding document because:

- it uses `member-month` facts as the primary input contract
- it collapses multiple business concepts into generic fields like `pcVolume`, `spRewardBasis`, `globalRewardUsd`, `poolRewardUsd`, `cashoutUsd`, and `sinkSpendUsd`
- it does not preserve named reward sources at canonical level
- it does not preserve pool identity and pool-recipient logic at canonical level
- it does not preserve enough event ordering for first-10 and qualification-window rules
- it treats some critical business values as proxy reconstructions from aggregate sheets
- it cannot yet compute all understanding-document rules from canonical stored truth

## 12. Migration Principle

Do not delete the current `member-month` contract immediately.

Instead:

- keep the current contract as a derived compatibility view
- introduce a new canonical layer underneath it
- regenerate member-period facts from the new canonical truth
- migrate the engine gradually from generic proxy fields to explicit business ledgers

This reduces breakage while moving the repo toward fidelity.

## 13. Target Schema Direction

The repo should move toward tables or equivalent models with this shape:

- `members`
- `member_role_history`
- `offers`
- `business_events`
- `reward_obligation_entries`
- `pool_entries`
- `pc_entries`
- `sp_entries`
- `cashout_events`
- `qualification_windows`
- `qualification_status_history`
- `derived_member_period_facts`
- `derived_pool_period_facts`

Exact naming can change.

The business meaning cannot.

## 14. Implementation Order

Recommended implementation order:

1. Freeze the understanding document as immutable reference.
2. Add a canonical reward-source registry and pool registry.
3. Add canonical event and ledger models.
4. Add explicit status and qualification history models.
5. Build deterministic derived member-period views from canonical truth.
6. Port the simulation engine to consume the faithful derived views.
7. Only after that, retune ALPHA scenario parameters and regenerate simulation summaries.

## 15. Practical Rule For Future Data Entry

When later entering numbers into the simulator:

- input numbers should first land in canonical event or ledger structures
- derived aggregates should be computed by the system
- summary outputs should be produced from those derived views

Do not manually force final summary numbers into a collapsed proxy row if the business meaning lives at event level.

## 16. Final Decision Rule

If there is ever a conflict between:

- the current repo schema
- a convenience import mapping
- a proxy spreadsheet transformation
- or the understanding document

the understanding document wins.
