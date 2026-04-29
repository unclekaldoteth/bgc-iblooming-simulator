# BGC Alpha Simulator Glossary

This document explains the main terms used in the current simulator codebase.

It reflects the implementation that exists now, not the eventual full business model.

## Purpose

The simulator is an internal decision console for testing `ALPHA` policy settings before a pilot goes live.

Today, the codebase models:

- snapshot registration, validation, and approval
- snapshot import runs and imported member-month rows
- executable baseline model rules
- scenario configuration
- queued simulation runs
- dataset-driven simulation at `member-month` grain
- result storage
- founder-facing decision packs
- Full Detail CSV import and export with `record_type`
- scenario mode separation between imported data and forecast assumptions
- ALPHA and Web3 assumption fields, including token price basis

Today, the codebase does not yet model:

- actual row-level replay of historical snapshot data
- live onchain transactions
- proof that a future public token will trade at a specific price
- full production tokenomics
- calibrated production-grade thresholds and regression fixtures

## Core Objects

### Snapshot

A `snapshot` is a registered dataset reference and imported engine-ready dataset used as the input context for a run.

In the current codebase, a snapshot stores:

- name
- source systems
- date range
- file URI
- record count
- notes
- validation status
- import runs
- imported `SnapshotMemberMonthFact` rows

Important: a run still requires an `APPROVED` snapshot, and the engine computes results from the imported rows attached to that snapshot.

### Snapshot File Type

`Snapshot File Type` tells the engine how to read the uploaded file.

Simple labels used in the UI:

- `Monthly CSV`: one row is one member in one month. Fastest for basic simulation.
- `Full Detail CSV`: one normal CSV with a `record_type` column. Best CSV format for complete Source Detail checks.
- `Full Detail JSON`: same full-detail model as Full Detail CSV, but as JSON.
- `Full Detail Bundle`: a packaged full-detail source set prepared from multiple files.
- `Hybrid Data`: mixed detail rows and monthly aggregate rows.

The detailed dictionary is in [SNAPSHOT_DATA_DICTIONARY.md](./SNAPSHOT_DATA_DICTIONARY.md).

Important: Monthly CSV can run simulations, but it cannot make every Source Detail item available because it does not contain enough event-level detail.

### Snapshot Import Run

A `snapshot import run` is one queued worker job that reads a snapshot file and attempts to turn it into engine-ready rows.

It stores:

- import status
- raw row count
- imported row count
- import issues
- start and completion timestamps
- notes

### Snapshot Member-Month Fact

A `snapshot member-month fact` is the basic monthly simulation input row for MVP.

It stores one member-month observation with fields such as:

- `periodKey`
- `memberKey`
- `sourceSystem`
- `memberTier`
- `groupKey`
- `pcVolume`
- `spRewardBasis`
- `globalRewardUsd`
- `poolRewardUsd`
- `cashoutUsd`
- `sinkSpendUsd`
- `activeMember`

### Full Detail CSV

`Full Detail CSV` is a spreadsheet-friendly way to provide detailed source data.

It uses a `record_type` column. That column tells the engine what each row means.

Primary `record_type` values:

- `member`
- `member_alias`
- `role_history`
- `offer`
- `business_event`
- `pc_entry`
- `sp_entry`
- `reward_obligation`
- `pool_entry`
- `cashout_event`
- `qualification_window`
- `qualification_status`

Simple meaning:

- `member` is the simulator's internal person/account.
- `member_alias` is the source-system ID for that person/account.
- `business_event` is what happened in the business system.
- `pc_entry`, `sp_entry`, `reward_obligation`, `pool_entry`, and `cashout_event` are ledger rows.
- `qualification_window` and `qualification_status` make time-based qualifications explicit.

### Baseline Model

A `baseline model` is a named model version attached to scenarios and runs.

In the current codebase, it mainly acts as:

- version metadata
- executable defaults and thresholds
- conversion, cap, sink, cash-out, and treasury rule configuration

Important: the current engine now resolves the model ruleset JSON and uses it during simulation and recommendation evaluation.

### Scenario

A `scenario` is a reusable policy configuration.

It contains:

- name
- template type
- description
- default snapshot
- baseline model version
- parameter JSON

A scenario is what users build in the Scenario Builder screen.

### Scenario Mode

`Scenario Mode` controls whether a run uses imported data only or adds forecast assumptions.

- `Imported Data Only` uses imported snapshot periods. Growth forecast fields stay locked.
- `Add Forecast` unlocks growth assumptions and must be read as an estimate.

In the code, the old internal values are `founder_safe` and `advanced_forecast`. The UI now uses simpler wording because non-technical users should not need to understand internal guardrail names.

### ALPHA And Web3 Settings

`ALPHA & Web3` settings decide how ALPHA should be described in Token Flow and Whitepaper outputs.

Key terms:

- `ALPHA classification`: whether ALPHA is an internal credit, points layer, off-chain token, or future on-chain token.
- `Can ALPHA be transferred?`: whether ALPHA is non-transferable, limited to the platform, or externally transferable.
- `On-chain status`: whether ALPHA is not on-chain, planned, on testnet, or on mainnet.
- `Supply model`: whether supply is not applicable, uncapped internal, fixed supply, or capped emission.
- `Price basis`: why the scenario is allowed to assign a USD price to ALPHA.
- `ALPHA price ($)`: assumed USD value for one ALPHA in the scenario.

Important: the engine can read `ALPHA price ($)`, but it does not prove that a public market will accept that price. A public token price must be supported by tokenomics, reserve, liquidity, oracle, or market assumptions.

### Simulation Run

A `simulation run` is one execution of one scenario against one approved snapshot.

It stores:

- scenario reference
- snapshot reference
- baseline model reference
- run status
- summary metrics
- time-series metrics
- segment metrics
- flags
- decision packs
- execution metadata such as engine version and seed hash

Important: the current engine is deterministic at the imported `member-month` fact grain. It is not a raw event replay engine.

Archive state is separate from run status. A run can still be `COMPLETED` while being archived from the default `Result Ref` view.

### Result Ref

`Result Ref` is the registry page for saved simulation runs.

It is used to:

- browse saved refs
- open a completed run quickly
- pin important refs for long-term retention
- archive older refs from the default view without deleting outputs

### Decision Pack

A `decision pack` is the founder-facing recommendation artifact generated after a run.

It contains:

- policy status
- founder-facing verdict label such as `Ready`, `Needs Review`, or `Do Not Use`
- recommendation summary
- evaluated scenario basis
- blockers or rejection reasons
- strategic goals
- milestone gates
- unresolved questions
- full simulation report export actions

## Main Screens

### Snapshots

The `Snapshots` screen is where users:

- register dataset metadata
- queue snapshot imports
- run validation
- approve snapshots for simulation use
- archive older snapshots from the default registry view
- review a storage cleanup policy summary below the snapshot registry, with collapsible maintenance detail and without purging data

### Scenarios

The `Scenarios` screen is where users:

- create reusable policy setups
- attach a baseline model
- assign a default snapshot
- launch runs
- archive older scenarios from the default registry view

### Result Ref / Runs

The `Result Ref` registry and run-detail flow show:

- run status
- summary metrics
- flags
- decision links
- archive filters
- pinned refs first in the default reading order

### Distribution

The `Distribution` screen shows ALPHA behavior, issued-share concentration, scenario phase totals, and source-system splits from a completed run.

### Treasury

The `Treasury` screen shows company cashflow data first, then treasury health signals.

It includes:

- gross cash in
- retained revenue
- partner payout out
- direct reward obligations
- pool funding obligations
- actual payout out
- product fulfillment out
- net treasury delta
- treasury pressure
- reserve runway
- internal use rate
- concentration risk

### Compare

The `Compare` screen shows a selected set of completed runs side by side with a cashflow-first structure.

It currently includes:

- selected scenario bar and manage panel
- radar quick-scan
- compare decision snapshot
- business cashflow comparison
- ALPHA policy comparison
- treasury risk comparison
- distribution comparison
- strategic-goal comparison
- milestone comparison
- run context and audit trail

### Decision Pack

The `Decision Pack` screen shows the founder-facing recommendation generated from a completed run.

It currently emphasizes:

- policy verdict
- scenario context
- evaluated scenario basis
- blockers or rejection reasons
- unresolved questions
- strategic-goal evidence
- milestone gates
- full simulation report export

## Roles

### Founder

Can read high-level outputs and export founder-facing full simulation reports, but cannot create scenarios or launch runs in the current role mapping.

### Analyst

Can register snapshots, validate snapshots, create scenarios, and launch runs.

### Product

Can create and edit scenarios, but cannot launch runs in the current role mapping.

### Engineering

Has read-oriented access for system understanding, but cannot create scenarios or launch runs in the current role mapping.

### Admin

Has full access.

## Status Terms

### User Status

- `ACTIVE`: user can authenticate and act in the app
- `INACTIVE`: user is disabled

### Snapshot Status

- `DRAFT`: snapshot was created but not validated yet
- `VALIDATING`: validation is currently running
- `INVALID`: validation found at least one error
- `VALID`: validation passed with no errors
- `APPROVED`: snapshot is approved for run launch
- `ARCHIVED`: snapshot is no longer intended for active use

Important: a run can only launch against an `APPROVED` snapshot.

### Snapshot Import Status

- `QUEUED`: import job was created and is waiting for the worker
- `RUNNING`: worker is parsing and validating the CSV
- `COMPLETED`: imported engine rows were written successfully
- `FAILED`: import failed and issues were stored

### Baseline Model Status

- `DRAFT`: model version exists but is not the active one
- `ACTIVE`: currently selected model version
- `ARCHIVED`: old model version kept for history

### Run Status

- `QUEUED`: run was created and is waiting for the worker
- `RUNNING`: worker has started processing the run
- `COMPLETED`: outputs were persisted successfully
- `FAILED`: execution failed

### Archive State

- `active`: object appears in the default registry view
- `archived`: object is hidden from the default registry view but kept for history

This archive state currently applies to:

- snapshots
- scenarios
- saved run refs

### Pinned Run Ref

- `pinned`: saved run ref is prioritized in the `Result Ref` page and marked for long-term retention
- `unpinned`: saved run ref follows the normal ordering

### Decision Pack Export Status

- `DRAFT`: pack exists but export is not marked ready
- `READY`: export is ready
- `FAILED`: export generation failed

## Scenario Template Terms

The current templates are:

- `Baseline`
- `Conservative`
- `Growth`
- `Stress`

In the current codebase, a template is mainly a preset of default parameter values. The run uses the final saved numbers, not the label itself.

## Business Terms Referenced In The Simulator

### `ALPHA`

The internal unit being modeled by the simulator.

In the current product direction, ALPHA is treated as an internal policy and utility unit, not as a public tradeable token.

### `PC`

An internal business-side value used in the BGC ecosystem and referenced in ALPHA conversion logic.

In the current engine, imported `pcVolume` facts are converted into issuance base and then scaled by `k_pc`.

### `SP` / Sales Point

An internal business-side reward-basis point referenced in ALPHA conversion logic. For BGC, this usually means SP/LTS. For iBLOOMING, this can mean Sales Point from product or channel activity.

In the current engine, imported `spRewardBasis` facts are converted into issuance base and then scaled by `k_sp`.

Plain-language view in the baseline simulator:

- `PC` is internal credit tied to BGC physical-product activity.
- Think of `PC` as business/product-side activity value.
- Baseline assumption: `100 PC = $1`.
- `SP` / Sales Point is internal reward-basis value from the existing reward system.
- Think of it as the point base used to calculate ALPHA issuance.
- Baseline assumption: `1 SP/Sales Point = $1 reward basis`.
- Simplest distinction: `PC` is closer to product/business activity, while `SP` / Sales Point is closer to reward basis and incentives.

### `Sink`

A `sink` is any mechanism that absorbs ALPHA out of pure issuance-and-holding behavior.

Examples in business terms would include spend, utility use, access use, or other designed consumption behavior.

In the current engine, sink behavior is represented by `sink_target`.

### `Cash-out`

`Cash-out` refers to allowing users to convert modeled ALPHA value into a cash-equivalent outcome.

The current engine uses imported `cashoutUsd` facts together with `cashout_mode`, `cashout_min_usd`, `cashout_fee_bps`, `cashout_windows_per_year`, and `cashout_window_days`.

### `Windowed Cash-out`

A cash-out mode where exits are only available during defined windows rather than continuously.

### `BPS`

`BPS` means `basis points`.

- `100 bps` = `1%`
- `150 bps` = `1.5%`
- `250 bps` = `2.5%`

### `Source System`

A business system that contributed data to a snapshot.

Examples in this repo are values such as `bgc` and `iblooming`.

### `File URI`

The storage location string attached to a snapshot, such as:

- `s3://...`
- `https://...`
- `file://...`

### `Seed Hash`

A deterministic fingerprint of the main run inputs.

It helps identify that a run came from a specific combination of:

- scenario
- snapshot
- baseline model version
- parameters

## Scenario Parameter Glossary

Each parameter has a business meaning and a current engine meaning.

Plain-language summary of the main baseline knobs:

- `k_pc` = how much `PC` is converted into ALPHA. Higher values increase the PC contribution to ALPHA issuance. Example: `k_pc = 1.2` means PC contributes 20% more than baseline.
- `k_sp` = how much `SP` is converted into ALPHA. Higher values increase the SP contribution to ALPHA issuance. Example: `k_sp = 0.8` means SP contributes 20% less than baseline.
- `reward_global_factor` = multiplier for global reward pressure. Higher values increase modeled liability from global rewards.
- `reward_pool_factor` = multiplier for pool-based reward pressure. Higher values increase modeled liability from pool rewards.
- `sink_target` = target for how much ALPHA is absorbed into ecosystem use such as spend, utility, or access instead of only being held or cashed out.

Simple mental model: `PC + SP` = source of ALPHA formation; `k_pc + k_sp` = knobs for how much ALPHA gets issued; `reward_global_factor + reward_pool_factor` = knobs for reward/liability pressure; `sink_target` = knob for how much ALPHA gets used inside the ecosystem.

### `k_pc`

- Business meaning: conversion intensity from `PC` into ALPHA issuance
- Current engine meaning: scales the `pcVolume`-derived issuance base for each imported fact row

### `k_sp`

- Business meaning: conversion intensity from `SP` / Sales Point into ALPHA issuance
- Current engine meaning: scales the `spRewardBasis`-derived issuance base for each imported fact row

### `reward_global_factor`

- Business meaning: system-wide reward pressure multiplier
- Current engine meaning: scales modeled liability from imported `globalRewardUsd` values

### `reward_pool_factor`

- Business meaning: pool-based reward pressure multiplier
- Current engine meaning: scales modeled liability from imported `poolRewardUsd` values

### `cap_user_monthly`

- Business meaning: per-user monthly reward cap
- Current engine meaning: caps issued ALPHA at the per-member, per-month level before group caps are applied

### `cap_group_monthly`

- Business meaning: per-group monthly reward cap
- Current engine meaning: caps issued ALPHA at the `groupKey` per-month level after user caps are applied

### `sink_target`

- Business meaning: target share of issued ALPHA absorbed by ecosystem sinks such as spend or utility
- Current engine meaning: scales imported `sinkSpendUsd` behavior against the baseline sink target to determine modeled spend

### `cashout_mode`

- Business meaning: whether cash-out is always open or only available in windows
- Current engine meaning:
  - `ALWAYS_OPEN` uses the baseline always-open release factor
  - `WINDOWS` uses the baseline windowed release factor adjusted by modeled window coverage

### `cashout_min_usd`

- Business meaning: minimum USD-equivalent threshold before cash-out is allowed
- Current engine meaning: imported `cashoutUsd` rows below this threshold are excluded from modeled cash-out

### `cashout_fee_bps`

- Business meaning: cash-out fee in basis points
- Current engine meaning: reduces modeled cash-out via a fee retention factor

### `cashout_windows_per_year`

- Business meaning: how many cash-out windows open each year
- Current engine meaning: contributes to normalized window coverage when `cashout_mode = WINDOWS`

### `cashout_window_days`

- Business meaning: how many days each cash-out window stays open
- Current engine meaning: contributes to normalized window coverage when `cashout_mode = WINDOWS`

## Output Metric Glossary

These are the main summary metrics persisted for a completed run.

### `alpha_issued_total`

Total modeled ALPHA issued in the run.

### `alpha_spent_total`

Total modeled ALPHA absorbed by sinks such as spend or utility.

### `alpha_held_total`

Total modeled ALPHA not spent in the run output.

### `alpha_cashout_equivalent_total`

Modeled cash-out equivalent amount derived from imported `cashoutUsd` facts and the active cash-out settings.

### `sink_utilization_rate`

Share of issued ALPHA absorbed by modeled spend behavior.

### `payout_inflow_ratio`

Pressure indicator comparing modeled payout pressure against modeled inflow support.

Higher values indicate more treasury risk.

### `reserve_runway_months`

Modeled months of reserve runway left under the current parameter set.

Lower values indicate more treasury risk.

### `reward_concentration_top10_pct`

Modeled share of issued ALPHA concentrated in the top 10% of members by issued amount.

Higher values indicate more fairness and concentration risk.

## Segment Output Terms

The current engine emits segment metrics under three segment types.

### `member_tier`

Distribution by imported `memberTier` values such as `starter`, `builder`, or `unknown`.

### `source_system`

Distribution by imported source system such as `bgc` or `iblooming`.

### `alpha_behavior`

A simplified behavioral breakdown:

- `hold`
- `spend`
- `cashout`

## Flag Terms

Flags are generated when a completed run crosses threshold rules.

Current built-in flags are:

### `reserve_runway_below_threshold`

Triggered when reserve runway falls below the preferred minimum.

### `payout_pressure_exceeds_inflow`

Triggered when payout pressure exceeds modeled inflow.

### `reward_concentration_high`

Triggered when rewards are too concentrated in the top cohort.

## Severity Terms

- `info`: lowest severity
- `warning`: needs attention
- `critical`: serious threshold breach

## Decision Pack Policy Status

The current engine produces one of three recommendation states internally.

Founder-facing surfaces render them as:

- `candidate` -> `Ready`
- `risky` -> `Needs Review`
- `rejected` -> `Do Not Use`

### `candidate`

The run stays inside the current baseline-model thresholds.

### `risky`

The run does not hit hard rejection thresholds, but one or more flags were triggered.

### `rejected`

The run violates core safety thresholds.

In the current codebase, rejection occurs when:

- `reserve_runway_months < 3`, or
- `payout_inflow_ratio > 1.15`

## Validation Rules

Snapshot metadata validation currently checks:

- end date must be on or after start date
- record count must be greater than zero
- at least one source system must be present
- duplicate source systems create a warning
- file URI should use an explicit scheme such as `s3://`, `https://`, or `file://`
- short coverage windows create a warning
- unusually large coverage windows create a warning

Snapshot import validation currently checks:

- required CSV columns exist
- numeric fields parse and stay non-negative
- `period_key` matches `YYYY-MM`
- `active_member` parses as a supported boolean value
- duplicate `period/member/source` rows are rejected
- import issues are stored on the import run

## Current Limitations

The simulator is now dataset-driven at `member-month` grain, but it still has important MVP limits:

- no raw event replay
- some exact understanding-doc rules still require Full Detail JSON rather than Monthly CSV
- no direct production sync
- no calibrated regression fixture suite yet
- approval and metadata validation are still separate from import-run completion logic

So the current simulator should be understood as:

`a working internal simulator with real workflow, full-detail imports, executable baseline rules, and dataset-driven math at member-month grain`

## Recommended Reading Order

If someone is new to the simulator, the fastest order is:

1. `Snapshot`
2. `Scenario`
3. `Simulation Run`
4. `Summary Metrics`
5. `Flags`
6. `Decision Pack`
