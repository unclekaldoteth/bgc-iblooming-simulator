# Project Overview

Last updated: 2026-05-15

## Purpose

BGC Alpha Simulator is an internal decision console for BGC and iBLOOMING founders, operators, finance, product, and engineering leads. It helps the team test ALPHA policy options against historical business data before approving a Phase 1 pilot.

The product is not a public token app, wallet, exchange, or smart-contract deployment. It is a simulation and decision-support system that keeps current BGC and iBLOOMING reward mechanics visible while testing ALPHA overlays.

Core question:

- If parts of the current PC and SP reward system are represented as ALPHA, what happens to distribution, internal use, treasury pressure, fairness, cash-out behavior, and operational risk?

## Source Materials

Primary repo references:

- `README.md` for current app status, local setup, and deployment notes.
- `bgc-alpha-simulator-prd.md` and `bgc-alpha-simulator-prd-founder-v1.md` for product intent and founder-facing framing.
- `bgc-alpha-simulator-tech-stack-and-repo-v1.md` for stack and repo shape.
- `bgc-alpha-simulator-mvp-execution-plan-v1.md` for MVP milestones and implementation status.
- `SIMULATOR_FAITHFUL_DATA_MODEL_SPEC.md` for source-detail data modeling rules.
- `SNAPSHOT_DATA_DICTIONARY.md` and `SNAPSHOT_DATA_DICTIONARY_ID.md` for snapshot input contracts.
- `SCENARIO_DICTIONARY.md`, `SCENARIO_PARAMETER_GUARDRAIL_MATRIX.md`, and Indonesian variants for scenario semantics.
- `RESULT_DICTIONARY.md` and `COMPARE_DICTIONARY.md` for result and compare page meaning.
- `COMPANY_CASHFLOW_LENS_SPEC.md` for money metrics separated from ALPHA policy math.

Data and output references:

- `examples/` contains sample Monthly CSV, Full Detail CSV/JSON, invalid fixtures, and Google Sheets-style references.
- `deliverables/` contains founder decks, final docs, and working-basis snapshots.
- `outputs/` contains generated artifacts and mapped KK May 2026 data.
- `NEW DATA FROM KK (MAY 26)/` contains latest imported source files and PDF/XLSX/CSV materials.

## Product Scope

Current working loop:

1. Internal user signs in.
2. User registers or uploads a dataset snapshot.
3. System imports Monthly CSV, Full Detail CSV, Full Detail JSON, bundle, or hybrid data.
4. System validates data quality, source detail coverage, fingerprints, and import issues.
5. Authorized user approves a valid snapshot.
6. User creates a scenario using baseline, conservative, growth, or stress templates.
7. User tunes ALPHA conversion, caps, sink, cash-out, forecast, and Web3 assumptions within guardrails.
8. User launches a queued simulation run.
9. Worker processes the run and persists summary, time-series, segment, flags, and decision-pack data.
10. User reviews run pages, compares completed results, resolves decision notes, and exports founder-ready reports.

## Primary Users

- Founders: approve or reject pilot policy settings based on trade-offs.
- Product and tokenomics lead: tune scenario parameters and compare ALPHA behavior.
- Operations and finance leads: review treasury pressure, cash-out risk, payout support, and data quality.
- Analyst/operator: prepare snapshots, run simulations, and export decision materials.
- Engineering lead: preserve deterministic contracts for later implementation.
- Legal/compliance reviewers: inspect assumptions and evidence labels before external claims.

## Current Product Principles

- Keep the simulator internal and evidence-first.
- Use real historical business data where available.
- Preserve PC, SP, fiat, pool, reward, cash-out, and ALPHA meanings separately.
- Treat ALPHA as Phase 1 internal and non-transferable by default unless scenario assumptions explicitly say otherwise.
- Do not make public token launch, market trading, or smart contracts part of the MVP.
- Money metrics must be read before ALPHA policy metrics.
- Forecast assumptions must be visible and labeled.
- Weak data can support discussion, but not final founder claims without explicit review.

## Main Feature Areas

- Auth and RBAC for founder, analyst, product, engineering, and admin roles.
- Snapshot registry, upload/registration, validation, approval, archive, import, export, cleanup report, source detail audit, and manifest generation.
- Faithful source-detail import path using canonical/full-detail rows plus derived monthly simulation rows.
- Scenario management with guardrails, baseline adoption, mode labels, milestone schedules, cohort assumptions, sink adoption, ALPHA token policy, forecast policy, and Web3/tokenomics assumptions.
- Queued background jobs for validation, import, simulation, decision-pack generation, and exports.
- Results pages: summary/run detail, distribution, token flow, treasury, and decision pack.
- Compare workflow with run selection, radar scan, cashflow-first tables, data completeness, recommended setup, open decisions, and export options.
- Founder-facing report exports in Markdown, PDF-like text, CSV/JSON, and deck/doc deliverables.

## Non-Goals

- No public-facing consumer product.
- No live wallet, exchange, cash-out execution, or production payout writes.
- No smart-contract deployment inside this app.
- No public market price proof.
- No legal finalization by the simulator.
- No rewriting of immutable BGC/iBLOOMING business semantics to fit a simpler model.

## Success Criteria

The project is working when an approved internal user can:

- Load and approve a historical business snapshot.
- Create a scenario with clear editable, conditional, and locked parameters.
- Run a deterministic simulation through the worker.
- Read money, ALPHA flow, distribution, treasury, and data quality outputs.
- Compare multiple completed runs and identify a candidate pilot baseline.
- Export a founder-ready decision pack that shows assumptions, blockers, and evidence strength.

## Current Project Assumptions

- Historical data is imported from files, not live production systems.
- PostgreSQL is the system of record for app metadata, canonical data, derived facts, runs, metrics, decisions, and audit events.
- Uploaded files use Vercel Blob when configured and local `storage/uploads/snapshots` in development fallback.
- Background processing uses `pg-boss` and a separate worker app.
- The deterministic simulation engine lives in TypeScript packages and should stay independent from request handlers.
- Some new business data and generated artifacts are untracked in the worktree; do not treat git cleanliness as project completeness.
