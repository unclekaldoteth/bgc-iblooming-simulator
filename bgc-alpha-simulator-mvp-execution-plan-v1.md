# MVP Execution Plan v1: BGC Alpha Simulator

Status: Draft v1  
Date: 2026-03-16  
Depends on: `bgc-alpha-simulator-prd-founder-v1.md`, `bgc-alpha-simulator-prd.md`, `bgc-alpha-simulator-build-spec-v1.md`

## 1. Purpose

This document converts the Build Spec into:

- implementation epics,
- MVP tickets,
- dependency order,
- milestone plan,
- delivery sequence.

This is the first execution document that engineering and product can use to plan actual work.

## 2. MVP Outcome

The MVP is complete when an approved internal user can:

1. log in,
2. select an approved historical data snapshot,
3. create or edit a policy scenario,
4. run a deterministic simulation,
5. compare run outputs,
6. review treasury, fairness, and distribution results,
7. export a founder-ready simulation report.

## 3. Delivery Principles

- Build the thinnest possible full loop first.
- Prioritize deterministic simulation over polished visuals.
- Keep unresolved founder choices configurable.
- Do not connect to live production writes in MVP.
- Keep recommendation logic rule-based and explainable.

## 4. Assumptions

- Historical data will be imported as snapshot files, not through real-time sync.
- The baseline reward model will be versioned manually in MVP.
- Internal authentication can be implemented with a simple role-based model.
- The first simulation engine can run synchronous jobs for small inputs or queued jobs for larger runs.
- Export quality should be decision-ready, not presentation-perfect.

## 4.1 Implementation Status Update

As of 2026-03-17, the following slices are already implemented in the repo:

- internal auth, RBAC, and audit logging
- snapshot registration, metadata validation, approval, and canonical CSV import
- baseline model persistence plus executable `model-v1` rules
- scenario persistence and run launch
- queued worker processing for runs, imports, and decision packs
- dataset-driven simulation over imported member-month facts
- run results, compare, distribution, treasury, and decision-pack pages

Current active gap:

- calibration, regression testing, and hardening are now higher priority than core workflow plumbing

## 5. Epic Overview

- `EP-00` Product and delivery setup
- `EP-01` Internal app foundation and auth
- `EP-02` Dataset snapshot lifecycle
- `EP-03` Baseline model and scenario management
- `EP-04` Simulation engine core
- `EP-05` Run results, comparison, and analysis UI
- `EP-06` Decision pack and exports
- `EP-07` QA, hardening, and MVP release

## 6. Recommended Milestones

### Milestone 0: Delivery Setup

Goal:

- establish repo, environment, ownership, and implementation sequence.

### Milestone 1: Foundation Loop

Goal:

- internal login,
- app shell,
- snapshot storage,
- scenario persistence.

### Milestone 2: Simulation Loop

Goal:

- baseline model,
- simulation engine,
- run orchestration,
- run results.

### Milestone 3: Decision Console Loop

Goal:

- comparison,
- distribution and treasury views,
- decision pack export.

### Milestone 4: Hardening and Release

Goal:

- QA,
- auditability,
- operational readiness,
- MVP sign-off.

## 7. Dependency Order

Recommended dependency chain:

1. `EP-00` must complete first.
2. `EP-01` and `EP-02` can start after `EP-00`.
3. `EP-03` depends on `EP-01` and partially on `EP-02`.
4. `EP-04` depends on `EP-02` and `EP-03`.
5. `EP-05` depends on `EP-04`.
6. `EP-06` depends on `EP-05`.
7. `EP-07` depends on all prior epics reaching MVP completeness.

## 8. Epic and Ticket Breakdown

## EP-00 Product and Delivery Setup

### Objective

Create the basic delivery structure so implementation can proceed without ambiguity.

### Tickets

`T-000` Create project repository structure  
Type: DevOps  
Depends on: none  
Acceptance criteria:

- app, api, and simulation-engine folders exist or equivalent structure is defined,
- local development instructions exist,
- environment variable template exists.

`T-001` Define MVP environment strategy  
Type: DevOps  
Depends on: `T-000`  
Acceptance criteria:

- local, staging, and production-like environment plan is documented,
- secrets strategy is defined,
- storage strategy for snapshots is defined.

`T-002` Define delivery conventions  
Type: Product/Engineering  
Depends on: `T-000`  
Acceptance criteria:

- naming conventions for snapshots, models, scenarios, and runs are documented,
- ticket labels and branch conventions are agreed,
- acceptance criteria format is standardized.

## EP-01 Internal App Foundation and Auth

### Objective

Create a secure internal app shell with role-based access.

### Tickets

`T-100` Create frontend app shell  
Type: Frontend  
Depends on: `T-000`  
Acceptance criteria:

- app layout exists,
- navigation for all MVP sections exists,
- role-aware route guards exist.

`T-101` Create backend API shell  
Type: Backend  
Depends on: `T-000`  
Acceptance criteria:

- health endpoint exists,
- API routing structure exists,
- basic persistence integration is wired.

`T-102` Implement internal authentication  
Type: Backend  
Depends on: `T-101`  
Acceptance criteria:

- internal users can authenticate,
- sessions or tokens are issued,
- failed auth is handled cleanly.

`T-103` Implement role-based access control  
Type: Backend  
Depends on: `T-102`  
Acceptance criteria:

- founder, analyst, product, engineering, and admin roles are supported,
- protected endpoints enforce roles,
- unauthorized actions are blocked.

`T-104` Implement frontend auth state and route protection  
Type: Frontend  
Depends on: `T-100`, `T-102`, `T-103`  
Acceptance criteria:

- protected routes require login,
- unauthorized roles see appropriate access errors,
- current user role is available in UI state.

`T-105` Create audit event writer for auth and key actions  
Type: Backend  
Depends on: `T-103`  
Acceptance criteria:

- login, snapshot approval, scenario save, run launch, and export actions are audit logged.

## EP-02 Dataset Snapshot Lifecycle

### Objective

Support import, validation, approval, and selection of historical simulation snapshots.

### Tickets

`T-200` Create snapshot data model and storage integration  
Type: Backend  
Depends on: `T-101`  
Acceptance criteria:

- snapshot records can be created and stored,
- snapshot metadata fields match the build spec,
- file location or storage key is persisted.

`T-201` Build snapshot upload or registration endpoint  
Type: Backend  
Depends on: `T-200`  
Acceptance criteria:

- internal users can register a snapshot,
- required metadata is validated,
- invalid submissions are rejected.

`T-202` Implement snapshot validation service  
Type: Backend  
Depends on: `T-200`  
Acceptance criteria:

- schema, date-range, and record checks run,
- warnings and errors are persisted,
- validation status is updated correctly.

`T-203` Build snapshot list and detail UI  
Type: Frontend  
Depends on: `T-100`, `T-200`, `T-201`  
Acceptance criteria:

- users can browse snapshots,
- detail page shows metadata and validation state,
- invalid and approved states are clearly visible.

`T-204` Build snapshot validation UI  
Type: Frontend  
Depends on: `T-203`, `T-202`  
Acceptance criteria:

- users can trigger validation,
- users can review issues,
- validation results are understandable without raw logs.

`T-205` Implement snapshot approval flow  
Type: Backend/Frontend  
Depends on: `T-202`, `T-203`, `T-204`, `T-103`  
Acceptance criteria:

- approved roles can approve snapshots,
- approved snapshot becomes selectable in scenario run flow,
- approval event is audited.

## EP-03 Baseline Model and Scenario Management

### Objective

Version the baseline business model and allow users to define reusable scenarios.

### Tickets

`T-300` Create baseline model version data model  
Type: Backend  
Depends on: `T-101`  
Acceptance criteria:

- model versions can be stored,
- status and description fields exist,
- ruleset payload can be persisted.

`T-301` Seed first baseline model version  
Type: Product/Backend  
Depends on: `T-300`  
Acceptance criteria:

- first model version is stored,
- version is traceable to PRD/build spec assumptions,
- open policy choices remain configurable, not hard-coded.

`T-302` Create scenario data model  
Type: Backend  
Depends on: `T-101`  
Acceptance criteria:

- scenario records can be created, updated, and read,
- parameter payload is stored,
- template type is persisted.

`T-303` Implement scenario CRUD endpoints  
Type: Backend  
Depends on: `T-302`, `T-300`  
Acceptance criteria:

- create, read, update, and list actions work,
- model version linkage is enforced,
- invalid parameter payloads are rejected.

`T-304` Build Scenario Builder UI  
Type: Frontend  
Depends on: `T-100`, `T-302`, `T-303`  
Acceptance criteria:

- user can create a scenario from template,
- user can edit all MVP parameters,
- user can save scenario draft.

`T-305` Implement scenario template presets  
Type: Frontend/Backend  
Depends on: `T-303`, `T-304`  
Acceptance criteria:

- Baseline, Conservative, Growth, and Stress templates are available,
- template selection pre-fills parameters,
- user can override template values before save.

`T-306` Build scenario validation layer  
Type: Backend  
Depends on: `T-303`  
Acceptance criteria:

- parameter ranges are validated,
- incompatible combinations are flagged,
- users receive actionable error messages.

## EP-04 Simulation Engine Core

### Objective

Implement the first deterministic simulation loop.

### Tickets

`T-400` Create simulation run data model  
Type: Backend  
Depends on: `T-101`  
Acceptance criteria:

- run records support status transitions,
- run links to scenario, snapshot, and model version,
- run metadata fields match the build spec.

`T-401` Implement run orchestration endpoint  
Type: Backend  
Depends on: `T-400`, `T-205`, `T-303`  
Acceptance criteria:

- user can start a run with approved snapshot and valid scenario,
- invalid combinations are blocked,
- run status moves from queued to running to completed or failed.

`T-402` Create deterministic engine input builder  
Type: Backend/Simulation  
Depends on: `T-401`, `T-205`, `T-301`, `T-303`  
Acceptance criteria:

- run input payload is generated deterministically,
- input signature is stored,
- engine version is recorded.

`T-403` Implement baseline simulation engine v1  
Type: Simulation  
Depends on: `T-402`  
Acceptance criteria:

- engine consumes snapshot, model, and parameter payload,
- engine returns summary metrics, time-series metrics, segment metrics, and flags,
- repeated runs with same inputs return identical outputs.

`T-404` Persist run outputs  
Type: Backend  
Depends on: `T-403`  
Acceptance criteria:

- summary metrics are saved,
- time-series metrics are saved,
- segment metrics and flags are saved,
- failed runs record error metadata.

`T-405` Implement run status polling or refresh strategy  
Type: Frontend/Backend  
Depends on: `T-401`, `T-404`  
Acceptance criteria:

- user can observe run progress,
- completed runs become viewable without manual DB inspection,
- failed runs show useful status.

`T-406` Add rule-based recommendation signals v1  
Type: Simulation/Backend  
Depends on: `T-403`, `T-404`  
Acceptance criteria:

- candidate, risky, and rejected states are generated from rule bands,
- reasons are stored,
- recommendation logic is explainable and configurable.

## EP-05 Run Results, Comparison, and Analysis UI

### Objective

Turn raw run outputs into usable decision views.

### Tickets

`T-500` Build Run Results page  
Type: Frontend  
Depends on: `T-404`, `T-405`, `T-406`  
Acceptance criteria:

- summary metrics are shown,
- recommendation state is visible,
- key flags are displayed,
- run metadata is accessible.

`T-501` Build Distribution page  
Type: Frontend  
Depends on: `T-404`  
Acceptance criteria:

- distribution by segment and reward source is visible,
- hold vs spend vs cash-out split is visible,
- top cohort concentration view exists.

`T-502` Build Treasury and Risk page  
Type: Frontend  
Depends on: `T-404`  
Acceptance criteria:

- inflow/outflow and reserve views exist,
- threshold breaches are visible,
- risk summary is understandable.

`T-503` Build Compare Runs backend  
Type: Backend  
Depends on: `T-404`  
Acceptance criteria:

- backend accepts run ids,
- returns compare-ready summary and deltas,
- invalid compare requests are rejected cleanly.

`T-504` Build Compare Runs page  
Type: Frontend  
Depends on: `T-500`, `T-503`  
Acceptance criteria:

- user can compare 2 to 5 runs,
- selected runs can be managed without overcrowding the page,
- cashflow comparison is shown before ALPHA policy comparison,
- recommendation status and key deltas are visible.

`T-505` Build overview page with recent runs and alerts  
Type: Frontend  
Depends on: `T-203`, `T-500`, `T-504`  
Acceptance criteria:

- latest approved snapshot is shown,
- recent runs are shown,
- important flags and shortcut actions exist.

## EP-06 Decision Pack and Exports

### Objective

Turn simulation outputs into founder-ready recommendation materials.

### Tickets

`T-600` Create decision pack data model  
Type: Backend  
Depends on: `T-101`  
Acceptance criteria:

- decision pack records can be persisted,
- run-based and compare-based source references are supported.

`T-601` Build decision pack generator backend  
Type: Backend  
Depends on: `T-406`, `T-503`, `T-600`  
Acceptance criteria:

- generator can create a recommendation payload,
- evaluated scenario basis, blockers, and unresolved sections are populated,
- output is tied to source run(s).

`T-602` Build Decision Pack page  
Type: Frontend  
Depends on: `T-600`, `T-601`  
Acceptance criteria:

- user can review recommendation summary,
- user can edit human-written note fields if allowed,
- unresolved founder decisions are clearly listed.

`T-603` Implement markdown export  
Type: Backend  
Depends on: `T-601`  
Acceptance criteria:

- system exports full simulation report as markdown,
- export is stored and downloadable.

`T-604` Implement PDF export  
Type: Backend  
Depends on: `T-601`  
Acceptance criteria:

- system exports a readable PDF summary,
- file can be downloaded from the UI.

`T-605` Implement CSV export for core result tables  
Type: Backend  
Depends on: `T-404`  
Acceptance criteria:

- summary, time-series, or segment metrics can be exported as CSV.

## EP-07 QA, Hardening, and MVP Release

### Objective

Make the MVP safe enough for internal use and founder review.

### Tickets

`T-700` Add backend tests for snapshot, scenario, and run lifecycle  
Type: Backend QA  
Depends on: `T-205`, `T-303`, `T-404`  
Acceptance criteria:

- critical backend flows are covered,
- deterministic behavior is asserted where possible.

`T-701` Add simulation determinism test suite  
Type: Simulation QA  
Depends on: `T-403`, `T-406`  
Acceptance criteria:

- same input payload reproduces the same result,
- changed payload yields changed signature and stored run.

`T-702` Add frontend tests for core decision flows  
Type: Frontend QA  
Depends on: `T-500`, `T-504`, `T-602`  
Acceptance criteria:

- snapshot selection, scenario save, run launch, compare, and export flows are tested.

`T-703` Add audit review and access-control review  
Type: Security/Backend  
Depends on: `T-105`, `T-103`, `T-602`  
Acceptance criteria:

- privileged actions are audited,
- role leaks are checked,
- export access is role-safe.

`T-704` Prepare staging acceptance checklist  
Type: Product/QA  
Depends on: all MVP features  
Acceptance criteria:

- checklist exists for end-to-end validation,
- sign-off owners are identified.

`T-705` Conduct founder-demo dry run  
Type: Product  
Depends on: `T-704`  
Acceptance criteria:

- one complete scenario can be run and exported end to end,
- known issues are logged before live founder review.

## 9. Suggested Parallel Workstreams

Once `EP-00` is complete, these can run in parallel:

- Frontend foundation work under `EP-01`
- Snapshot backend work under `EP-02`
- Model and scenario backend work under `EP-03`

Once the run contract is stable, these can run in parallel:

- Simulation engine work under `EP-04`
- Results page scaffolding under `EP-05`

Once outputs are stable, these can run in parallel:

- Compare and analysis views
- Decision pack generation
- QA hardening

## 10. Critical Path

The critical path for the MVP is:

`T-000 -> T-101 -> T-200 -> T-202 -> T-205 -> T-300 -> T-301 -> T-302 -> T-303 -> T-401 -> T-402 -> T-403 -> T-404 -> T-500 -> T-503 -> T-504 -> T-601 -> T-602 -> T-604 -> T-704 -> T-705`

## 11. Recommended Milestone Mapping

### Milestone 0

- `T-000`
- `T-001`
- `T-002`

### Milestone 1

- `T-100` to `T-105`
- `T-200` to `T-205`
- `T-300` to `T-306`

### Milestone 2

- `T-400` to `T-406`

### Milestone 3

- `T-500` to `T-605`

### Milestone 4

- `T-700` to `T-705`

## 12. Exit Criteria By Milestone

### Exit Criteria: Milestone 1

- internal users can sign in,
- snapshots can be registered and approved,
- scenarios can be created and saved.

### Exit Criteria: Milestone 2

- a saved scenario can be run against an approved snapshot,
- outputs are stored deterministically,
- recommendation signals exist.

### Exit Criteria: Milestone 3

- users can review run results,
- compare multiple runs,
- generate and export a decision pack.

### Exit Criteria: Milestone 4

- core flows are tested,
- access and audit rules are verified,
- staging is ready for founder-facing review.

## 13. What Not To Build Early

Do not build these before the MVP full loop works:

- live system integrations,
- advanced chart libraries beyond what is needed,
- AI-generated recommendation text,
- formal approval workflow,
- collaboration comments,
- public token modeling,
- production wallet or contract hooks.

## 14. Definition of Planning Completion

This execution plan is complete enough when:

- each epic has a clear objective,
- each MVP ticket has acceptance criteria,
- the dependency order is explicit,
- the critical path is known,
- milestones can be assigned to engineering capacity.
