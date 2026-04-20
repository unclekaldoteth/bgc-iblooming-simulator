# PRD: BGC Alpha Use and Distribution Simulator

Status: Draft v0.1
Date: 2026-03-16
Product Type: Internal web app backed by a simulation engine
Primary Outcome: Decision-ready ALPHA pilot policy

## 1. Summary

Build an internal decision console for BGC and iBLOOMING founders and core operators to simulate ALPHA use and distribution using the existing reward system as the baseline.

This product is not a public token app. It is an internal policy simulator that answers:

- If BGC and iBLOOMING convert parts of the current `PC` and `SP` reward system into `ALPHA`, what happens to user distribution, sink usage, treasury pressure, fairness, cash-out behavior, and operational risk?
- Which policy settings are safe enough to use for a Phase 1 pilot?
- Which settings should be rejected because they create imbalance, abuse risk, or unsustainable payout pressure?

The simulator must produce a recommended ALPHA pilot policy that can be used to finalize the Whitepaper, Token Flow, and later implementation blueprint.

## 2. Product Basis

This PRD is based on the following document set:

- `Understanding BGC X iBLOOMING Rewards`
  Basis for the real `AS-IS` business rules, user types, reward mechanics, payout rhythms, and constraints that must not be casually changed.
- `BGC X iBLOOMING Web3 Living Doc`
  Basis for strategic direction, Phase 1 priorities, and the simulation-first mandate.
- `BGC X iBLOOMING Working Presentation`
  Basis for founder alignment, current architecture, and decision priorities.
- `BGC X iBLOOMING White Paper Draft`
  Basis for the intended `TO-BE` ALPHA framing, conversion logic, EventHub framing, and policy guardrails.
- `BGC X iBLOOMING Token Flow Draft`
  Basis for conversion, event model, cash-out framing, and pilot parameter structure.
- `BGC X iBLOOMING Simulation Doc v0.1`
  Basis for simulator purpose, scenarios, parameters, metrics, and deliverables.
- `BGC X iBLOOMING Web3 Login Implementation`
  Basis for identity, wallet, and event-account structure constraints.
- Earlier meeting and draft docs
  Basis for historical intent, evolution of the concept, and unresolved founder questions.

## 3. Background

From the source documents, the current business already behaves like an internal tokenized reward system:

- `PC` already acts as a fixed-value internal credit for BGC physical-product activity.
- `SP` already acts as a reward-rights accounting layer.
- BGC and iBLOOMING already run multiple reward and pool mechanics.
- ALPHA is a new abstraction over an existing value flow, not a greenfield token economy.

The later documents converge on a clear Phase 1 position:

- `ALPHA` is an internal rights and simulation unit.
- `ALPHA` is non-transferable by default.
- Public-token tracks such as `iBC` or `iBTC` are not Phase 1.
- The next important step is simulation, not launch.

The current problem is not a lack of documents. The current problem is a lack of a single product that can test policy options using real historical data and produce decision-ready outputs.

## 4. Problem Statement

Founders and operators need to make policy decisions on ALPHA use and distribution, but the important numeric settings are still unresolved:

- `PC -> ALPHA` ratio
- `SP -> ALPHA` ratio
- reward intensity
- user and group caps
- sink intensity
- cash-out mode
- cash-out thresholds, fees, and windows
- anti-abuse thresholds
- treasury safety thresholds

Today, these choices exist mostly as drafts, document tables, and discussion points. There is no internal product that:

- encodes the actual `AS-IS` business model,
- runs proposed `ALPHA` policies against a real 24-month dataset,
- compares scenarios consistently,
- and outputs a recommended pilot policy.

## 5. Product Vision

Create an internal decision console that lets approved users:

- load a validated historical data snapshot,
- configure ALPHA policy scenarios,
- run reproducible simulations,
- compare policy outcomes side by side,
- and export a founder-ready recommendation pack.

The product should feel like an internal policy lab, not a dashboard-only analytics page.

## 6. Goals

### Primary Goal

Produce a recommended ALPHA pilot policy for BGC and iBLOOMING.

### Secondary Goals

- Preserve the real `AS-IS` business logic as the baseline model.
- Let founders compare multiple policy scenarios before approving one.
- Quantify sustainability, fairness, member experience, and risk.
- Feed decision-ready outputs into Whitepaper and Token Flow finalization.
- Create an auditable record of what assumptions were used in each scenario run.

## 7. Non-Goals

This product will not:

- be public-facing,
- function as a live token wallet or exchange,
- deploy smart contracts,
- execute real user payouts,
- replace production BGC or iBLOOMING operations,
- model public-market trading behavior for `iBC` or `iBTC`,
- finalize legal structure by itself.

## 8. Product Form

The recommended product shape is:

- `Simulation engine`
  The deterministic rules and scenario execution layer.
- `Internal web console`
  The main interface for configuring, running, comparing, and exporting scenarios.
- `Results store`
  A structured store for dataset versions, assumptions, runs, outputs, and audit history.

This should be built as an internal web app because:

- multiple stakeholders need shared access,
- side-by-side scenario comparison is easier in a browser UI,
- decision history and exports need to be centralized,
- the product will evolve over multiple founder review cycles.

## 9. Users and Stakeholders

### Primary Users

- Founders
- Product and tokenomics lead
- Operations and finance leads
- Data analyst or operator responsible for simulation runs

### Secondary Users

- Engineering lead
- Legal or compliance reviewers
- Internal strategy or reporting team

### Stakeholder Needs

- Founders need clear trade-offs and a recommended policy.
- Ops and finance need treasury and payout-risk visibility.
- Product and tokenomics need parameter tuning tools.
- Engineering needs stable output values for later implementation.

## 10. Locked Baseline Assumptions

The simulator must treat the following as baseline truths unless a scenario explicitly overrides them:

- Affiliate membership is purchased with fiat, not with tokens.
- `100 PC = $1 USD`.
- `1 SP = $1 reward basis`.
- `PC` is tied to BGC physical-product activity.
- iBLOOMING digital products are purchased with fiat in the current model.
- `SP` is derived from the existing BGC reward logic.
- Existing BGC and iBLOOMING reward categories remain part of the baseline model.
- Phase 1 ALPHA is internal and non-transferable by default.
- Public token launch is out of scope for this simulator.

Important known tension from the source docs:

- Some later documents propose quarterly cash-out windows for the pilot.
- Other aligned documents say the system may inherit the current BGC cash-out behavior unless founders choose otherwise.

The simulator must support both so founders can compare them directly.

## 11. Core Business Model Inputs

The simulator must encode the existing business model with enough fidelity to test ALPHA policies safely.

### BGC Baseline Inputs

- Affiliate levels and entry values
- LTS generation by level
- `PC` creation and consumption
- `SP` accrual logic
- `RR`, `GR`, `BGC-MC`, `GPSP`, and WEC-related flows
- monthly and quarterly payout rhythms

### iBLOOMING Baseline Inputs

- CP product revenue split
- `LR`, `iBLOOMING-MC`, `CPR`, `GRR`, `iRR`, `GPS`, `GMP`, `GEC`
- user, affiliate, CP, Executive CP, and WEC relationships
- monthly and semiannual distribution timings

### Historical Data Inputs

- 24-month transaction and reward history
- user and segment activity
- cash-out requests and actual payouts
- membership growth and retention data
- relevant product purchase and referral events

## 12. Jobs To Be Done

### Founder JTBD

When I am asked to approve ALPHA pilot settings, I want to see how each policy behaves under realistic conditions so I can approve a policy with known trade-offs rather than intuition alone.

### Ops and Finance JTBD

When a proposed ALPHA policy increases payout pressure or member demand, I want to know how long the system remains safe and where it starts to fail.

### Product and Tokenomics JTBD

When I tune conversion ratios, caps, sinks, or cash-out rules, I want to see how those changes affect growth, fairness, and sustainability across member segments.

### Engineering JTBD

When founders approve a pilot policy, I want a stable parameter set and event assumptions I can use later for implementation.

## 13. Product Scope

### MVP Scope

The MVP must support:

- importing and validating a historical data snapshot,
- encoding the baseline business model,
- defining configurable scenario parameters,
- running simulation scenarios,
- comparing runs,
- outputting recommendation-ready summaries,
- exporting results.

### Post-MVP Scope

- richer scenario presets,
- stronger audit and approval workflow,
- better charting and collaboration,
- automated data refresh,
- implementation handoff exports.

## 14. Main User Flows

### Flow 1: Load a Dataset Snapshot

1. User selects or uploads a dataset snapshot.
2. System validates coverage, schema, and date range.
3. System shows data quality summary and snapshot version.
4. User confirms snapshot for scenario work.

### Flow 2: Create a Scenario

1. User selects a baseline template such as `Baseline`, `Conservative`, `Growth`, or `Stress`.
2. User adjusts policy parameters.
3. User names and saves the scenario.
4. System records assumptions and author.

### Flow 3: Run Simulation

1. User runs a scenario against a selected dataset snapshot.
2. Engine processes the scenario.
3. System generates outputs for treasury, fairness, distribution, user experience, and operational load.
4. Run is stored with reproducible metadata.

### Flow 4: Compare Runs

1. User selects two or more runs.
2. System presents a side-by-side comparison with cashflow, ALPHA policy, treasury, and milestone layers.
3. System highlights key deltas, risks, and recommendation signals.

### Flow 5: Export Full Simulation Report

1. User selects a run or comparison set.
2. System exports a founder-ready report.
3. Output includes evaluated scenario basis, blockers, key risks, and unresolved decisions.

## 15. Functional Requirements

### FR-01 Data Snapshot Management

The system must support importing, storing, and selecting historical data snapshots.

Requirements:

- show snapshot date range,
- show record counts and validation summary,
- preserve immutable snapshot versions for reproducibility,
- prevent a run from proceeding against an invalid snapshot.

### FR-02 Baseline Model Library

The system must encode the current BGC and iBLOOMING reward logic as the default baseline model.

Requirements:

- baseline rules are versioned,
- users can see which rules are locked,
- overrides must be explicit and traceable.

### FR-03 Scenario Builder

The system must let users define simulation scenarios using adjustable parameters.

Minimum parameters:

- `k_PC` for `PC -> ALPHA`
- `k_SP` for `SP -> ALPHA`
- global reward intensity
- pool reward intensity
- user and group caps
- sink target
- treasury runway threshold
- payout-to-inflow threshold
- cash-out mode
- cash-out minimum
- cash-out fee
- cash-out windows per year
- cash-out window length
- processing lag
- cooldown after large cash-out
- gas sponsorship caps
- referral cooldown
- max Tier-1 joins per actor per day
- duplicate device threshold
- audit sample rate
- penalty cooling-off period

### FR-04 Scenario Templates

The system must include at least these templates:

- `Baseline`
- `Conservative`
- `Growth`
- `Stress`

Users must be able to clone and edit templates.

### FR-05 Simulation Execution

The system must run scenarios deterministically and generate reproducible outputs from the selected dataset and assumptions.

Requirements:

- identical inputs must produce identical outputs,
- each run must record snapshot version and parameter version,
- system must store execution metadata.

### FR-06 Run History

The system must store and display prior simulation runs.

Requirements:

- run name,
- author,
- timestamp,
- snapshot used,
- parameter set,
- status,
- output summary.

### FR-07 Comparison View

The system must allow users to compare multiple runs side by side.

Comparison dimensions:

- total ALPHA issued,
- total ALPHA spent,
- sink utilization,
- payout demand,
- payout-to-inflow ratio,
- reserve runway,
- concentration of rewards,
- segment winners and losers,
- operational cost exposure,
- flagged abuse risk.

### FR-08 Distribution Analysis

The system must show how ALPHA is distributed across:

- user segment,
- affiliate tier,
- CP-related roles,
- reward source,
- hold vs spend vs cash-out behavior.

### FR-09 Treasury and Risk View

The system must show treasury and sustainability outcomes.

Minimum outputs:

- inflow vs outflow,
- reserve ratio over time,
- payout pressure,
- worst-month drawdown,
- cash-out demand shocks,
- threshold breach alerts.

### FR-10 Fairness View

The system must show reward concentration and fairness signals.

Minimum outputs:

- reward concentration by segment,
- inequality metric,
- cap-hit frequency,
- share of rewards captured by top cohorts.

### FR-11 Recommendation Output

The system must produce a recommendation summary for each run or comparison set.

Minimum recommendation sections:

- evaluated scenario basis,
- safe range,
- risky settings,
- blockers or rejection reasons,
- unresolved founder decisions.

### FR-12 Export

The system must export outputs to structured formats.

Minimum export formats:

- PDF summary,
- CSV tables,
- internal markdown memo.

### FR-13 Internal Access Control

The system must be internal-only and accessible only to approved users.

Minimum needs:

- authenticated access,
- role-based permissions,
- run ownership and audit visibility.

## 16. Simulation Engine Requirements

### Model Requirements

The engine must represent:

- members and segments,
- affiliate hierarchy,
- `PC` and `SP` generation,
- reward accrual and payout timing,
- ALPHA issuance, holding, spending, and cash-out equivalents,
- treasury and operational constraints,
- optional shocks.

### Time Requirements

- support monthly simulation as the default resolution,
- support weekly drill-down where needed,
- support 24 months historical and optional forward projection.

### Scenario Requirements

The engine must support:

- baseline continuation,
- conservative safety-first scenarios,
- growth-heavy scenarios,
- downside revenue shocks,
- member growth shocks,
- cash-out demand shocks,
- utility-shift shocks.

### Output Requirements

The engine must output:

- per-run summary metrics,
- time-series outcomes,
- segment outcomes,
- threshold breach events,
- recommendation signals.

## 17. Core Screens

The internal web console should include:

- `Overview`
  Snapshot status, recent runs, key alerts.
- `Data Snapshot`
  Dataset version, validation, coverage.
- `Scenario Builder`
  Parameters, templates, notes.
- `Run Results`
  Single-run output dashboard.
- `Compare Runs`
  Side-by-side comparison.
- `Distribution`
  Segment and cohort analysis.
- `Treasury and Risk`
  Sustainability and failure analysis.
- `Decision Pack`
  Recommendation summary and export.

## 18. Key Outputs

The product must generate the following outputs:

- `Scenario comparison dashboard`
- `Parameter recommendation table`
- `Distribution report`
- `Treasury and sustainability report`
- `Fairness report`
- `Founder-facing simulation report`
- `Whitepaper and Token Flow handoff values`
- `Implementation-ready config export`

The most important output is:

`a recommended ALPHA pilot policy`

## 19. Success Metrics

### Product Success

- founders can review and compare scenarios without external spreadsheet work,
- each run is reproducible and auditable,
- the product reduces ambiguity in pilot-parameter decisions,
- the product becomes the source used to finalize Whitepaper and Token Flow numbers.

### MVP Operational Metrics

- dataset validation completes before any run,
- simulation run completes within acceptable internal workflow time,
- users can compare at least 3 scenarios in one session,
- export pack is usable in founder review without manual rewriting.

### Decision Metrics

The product should make it possible to answer:

- Which policy keeps payout pressure within tolerance?
- Which policy gives acceptable fairness by segment?
- Which policy preserves enough runway?
- Which policy best balances user flexibility and treasury safety?

## 20. Non-Functional Requirements

- Internal-only security
- Reproducibility of runs
- Clear audit history
- Parameter versioning
- Snapshot immutability
- Export reliability
- Traceability from recommendation back to assumptions

## 21. Dependencies

- Access to a clean enough 24-month dataset
- Agreement on baseline business-rule encoding
- Internal owner for data validation
- Internal owner for policy approval
- Internal owner for simulator maintenance

## 22. Risks

- Source data may be incomplete or inconsistent.
- Some business rules may still be interpreted differently by different stakeholders.
- Cash-out policy is not fully settled across the document set.
- Founders may want outputs that go beyond current data quality.
- If the baseline model is wrong, scenario outputs will be misleading.

## 23. Open Questions

- Which exact source systems provide the official 24-month dataset?
- Which cash-out mode should be treated as the default comparison baseline: `ALWAYS_OPEN` or `WINDOWS`?
- Which ALPHA sinks are in Phase 1 versus later?
- Who owns final approval for parameter changes?
- Is the recommendation output advisory only, or should it support a formal approval workflow?
- What level of explanation is required in exports for founder sign-off?

## 24. Suggested Release Plan

### Phase 1: MVP Decision Console

- load snapshot,
- build scenario,
- run simulation,
- compare scenarios,
- export decision summary.

### Phase 2: Decision-Grade Console

- stronger recommendation logic,
- better charts and audit trail,
- parameter presets by founder policy style,
- clearer red/yellow/green risk signals.

### Phase 3: Operational Policy Console

- routine data refresh,
- recurring scenario packs,
- deeper collaboration and approval flows,
- direct handoff outputs for implementation planning.

## 25. Acceptance Criteria for PRD Completion

This PRD is successful if it gives product, ops, finance, and engineering a shared definition of:

- what this simulator is,
- who it is for,
- what it must do,
- what it will not do,
- what outputs it must produce,
- and how it supports Phase 1 ALPHA decision-making.

## 26. Final Product Statement

The BGC Alpha Use and Distribution Simulator is an internal web-based decision console backed by a real simulation engine. It exists to convert the current BGC and iBLOOMING reward system into a testable ALPHA policy model, compare policy options using real historical data, and produce a recommendation-ready pilot policy for founder approval.
