# Progress Tracker

Last updated: 2026-05-15

## Current Phase

The repo appears to be past core MVP plumbing and in a calibration, hardening, evidence-quality, and founder-deliverable phase.

Current status from repo inspection:

- Main internal simulator loop exists.
- Snapshot import and validation support Monthly CSV and Full Detail data paths.
- Scenario guardrails and founder-safe labels exist.
- Worker-driven simulation, import, validation, decision-pack, and export jobs exist.
- Results, treasury, distribution, token-flow, decision-pack, and compare surfaces exist.
- Many final/founder deliverables, generated outputs, and latest KK May 2026 source data are present but untracked.

## Completed Work

Implemented or represented in the repo:

- pnpm/Turborepo monorepo structure.
- Next.js web app under `apps/web`.
- Worker app under `apps/worker`.
- Shared packages for auth, DB, schemas, simulation core, baseline model, exports, UI, and config.
- PostgreSQL/Prisma schema for users, roles, snapshots, full-detail canonical data, scenarios, runs, results, decision packs, decision log resolutions, and audit events.
- Local Docker Postgres setup scripts.
- Seed scripts for users and baseline model.
- Internal auth and RBAC capability model.
- Snapshot registry with upload/registration, import, validation, approval, archive, export, cleanup reporting, source detail audit, and manifest support.
- Import processors for Full Detail JSON, Full Detail CSV, and Monthly CSV compatibility data.
- Derived member-month, reward-source period, and pool-period facts from canonical/full-detail data.
- Baseline `model-v1` and deterministic simulation engine package.
- Scenario creation/editing, scenario modes, guardrails, milestone schedules, sink/cash-out/forecast/Web3 policy parameters, and baseline adoption.
- Queued simulation runs and persisted results.
- Overview, Snapshots, Scenarios, Result Ref, Compare, Run, Distribution, Token Flow, Treasury, and Decision Pack pages/routes.
- Founder-facing report/export infrastructure.
- Dictionaries for snapshot, scenario, result, compare, glossary, simulator flow, and faithful data model.
- Context pack created in `context/` with the six canonical files.
- Architecture context now includes a required Mermaid flow chart, and the reusable `context` skill now includes a flow chart template for future projects.

## In Progress Or Active Focus

Likely active work based on repo state:

- Mapping and validating latest KK May 2026 data.
- Improving faithful/full-detail dataset coverage.
- Calibration against observed snapshot totals.
- Hardening data quality warnings and source-detail gap reporting.
- Producing founder-ready final docs and decks.
- Comparing standard scenarios and policy finalization outputs.
- Improving evidence labels for whitepaper/token-flow support.

## Known Gaps And Risks

- `docs/` and `infra/` directories exist but appear empty from current file listing.
- Worktree is dirty with many untracked source data, examples, outputs, deliverables, scripts, and one modified canonical example CSV.
- Auth middleware currently just returns `NextResponse.next`; page/API guards carry access enforcement.
- Some package test scripts are placeholders.
- Generated deliverables and outputs should not be treated as reproducible unless scripts and source data are verified.
- Full-detail source data coverage may still have gaps depending on imported snapshot.
- Forecast and Web3 assumptions can be present in scenarios; outputs must continue to label them as assumptions.

## Open Questions

Business/product:

- Which latest KK May 2026 dataset should be treated as the current working baseline?
- Which completed run, if any, is the current founder-approved or preferred pilot baseline?
- Are final documents in `deliverables/final-docs` already approved, or still working drafts?
- Which Web3 assumptions are only exploratory versus intended for a near-term pilot?
- Should Indonesian docs/UI variants be kept in sync for every new English update?

Technical:

- Should route-level auth middleware be strengthened beyond page/API guards?
- Should generated artifacts be ignored, tracked, or moved outside the repo?
- Which import fixtures should become formal regression tests?
- Should `docs/` and `infra/` be populated or removed from expected repo shape?
- Should UI icons be standardized through an icon library later?

## Verification Status

Latest context-pack creation verification:

- `context/` did not exist before this update.
- The six canonical files were created.
- No code or data files were intentionally modified.
- Full app tests were not run because this change is documentation/context only.

Latest context update verification:

- `context/architecture.md` was updated with an `Architecture Flow Chart` Mermaid diagram.
- `/Users/fabiomaulana/.codex/skills/context/SKILL.md` was updated with a reusable Mermaid flow chart template requirement.
- Full app tests were not run because this change is documentation/context only.

Recommended verification before release-quality code changes:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Recommended focused verification for current high-risk areas:

```bash
pnpm --filter @bgc-alpha/schemas test
pnpm --filter @bgc-alpha/simulation-core test
pnpm --filter @bgc-alpha/db test
pnpm --filter @bgc-alpha/web typecheck
pnpm --filter @bgc-alpha/worker typecheck
```

## Next Implementation Direction

Best next engineering direction:

1. Decide which latest dataset is the active evidence baseline.
2. Turn current KK May 2026 mapping and import outcomes into repeatable fixtures or scripts.
3. Add regression coverage around snapshot import compatibility and source-detail gap audit.
4. Calibrate simulation output against observed totals for the active snapshot.
5. Tighten compare/decision-pack evidence language where source detail is weak or forecast assumptions are used.
6. Verify founder export outputs after the active baseline and scenario set are confirmed.

## Resume Checklist

When resuming:

1. Read this file and the other five context files.
2. Run `git status --short`.
3. Inspect the latest relevant code/docs rather than trusting stale notes.
4. Avoid editing source data and generated deliverables unless explicitly requested.
5. Keep changes scoped and update this tracker when the project state changes.
