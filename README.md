# BGC Alpha Simulator

Internal decision console for simulating `ALPHA` use and distribution across the BGC and iBLOOMING ecosystem.

## Documentation

- [SIMULATOR_GLOSSARY.md](./SIMULATOR_GLOSSARY.md): terms, statuses, parameters, metrics, and current engine behavior
- [SIMULATOR_GLOSSARY_ID.md](./SIMULATOR_GLOSSARY_ID.md): Indonesian version of the simulator glossary for terms, statuses, parameters, metrics, and current engine behavior
- [SNAPSHOT_DATA_DICTIONARY.md](./SNAPSHOT_DATA_DICTIONARY.md): plain-language snapshot file types, Monthly CSV columns, Full Detail CSV `record_type`, fixed choice values, and Web3 price terms
- [SNAPSHOT_DATA_DICTIONARY_ID.md](./SNAPSHOT_DATA_DICTIONARY_ID.md): Indonesian snapshot data dictionary with file types, check methods, CSV columns, `record_type`, fixed choices, and forecast placement
- [SCENARIO_DICTIONARY.md](./SCENARIO_DICTIONARY.md): plain-language scenario dictionary for templates, modes, editable fields, assumptions, cash-out policy, forecast policy, ALPHA policy, and Web3 settings
- [SCENARIO_DICTIONARY_ID.md](./SCENARIO_DICTIONARY_ID.md): Indonesian scenario dictionary with the same structure and simplified business explanations
- [RESULT_DICTIONARY.md](./RESULT_DICTIONARY.md): plain-language result dictionary for Summary, Distribution, Token Flow, Treasury, Decision Pack, metrics, statuses, and evidence labels
- [RESULT_DICTIONARY_ID.md](./RESULT_DICTIONARY_ID.md): Indonesian result dictionary with simplified explanations for all result sections and key metrics
- [COMPARE_DICTIONARY.md](./COMPARE_DICTIONARY.md): plain-language compare dictionary for result selection, radar, money comparison, ALPHA comparison, treasury comparison, data quality, and recommendation labels
- [COMPARE_DICTIONARY_ID.md](./COMPARE_DICTIONARY_ID.md): Indonesian compare dictionary with simplified explanations for compare workflow and decision terms
- [SIMULATOR_MEETING_GLOSSARY_ID.md](./SIMULATOR_MEETING_GLOSSARY_ID.md): Indonesian meeting-friendly glossary for key terms on Snapshots, Run, and Compare pages
- [SIMULATOR_FLOW.md](./SIMULATOR_FLOW.md): English presentation-friendly flow of the simulator, screen by screen
- [SIMULATOR_FLOW_ID.md](./SIMULATOR_FLOW_ID.md): Indonesian presentation-friendly flow of the simulator, screen by screen
- [SIMULATOR_FAITHFUL_DATA_MODEL_SPEC.md](./SIMULATOR_FAITHFUL_DATA_MODEL_SPEC.md): faithful snapshot contract and compatibility guidance for understanding-doc-aligned imports
- [COMPANY_CASHFLOW_LENS_SPEC.md](./COMPANY_CASHFLOW_LENS_SPEC.md): company cashflow metrics separated from ALPHA policy math
- [SCENARIO_PARAMETER_GUARDRAIL_MATRIX.md](./SCENARIO_PARAMETER_GUARDRAIL_MATRIX.md): scenario mode rules, editable fields, locked fields, and Web3 price basis rules
- [bgc-alpha-simulator-data-baseline-build-plan-v1.md](./bgc-alpha-simulator-data-baseline-build-plan-v1.md): implementation plan and current progress for full-detail ingestion and dataset-driven simulation
- [bgc-alpha-simulator-calibration-workflow-v1.md](./bgc-alpha-simulator-calibration-workflow-v1.md): calibration workflow and current sample calibration findings
- [bgc-alpha-simulator-mvp-execution-plan-v1.md](./bgc-alpha-simulator-mvp-execution-plan-v1.md): MVP execution plan with current implementation status notes

## Workspace

- `apps/web`: Next.js internal web console
- `apps/worker`: background job runner for validation, simulation, and exports
- `packages/*`: shared domain, schema, DB, auth, UI, and export packages

## Current Status

This repository now supports the main internal simulator loop:

- internal auth and RBAC
- snapshot registration, browser upload, data fingerprinting, approval, Monthly CSV import, Full Detail CSV import, Full Detail JSON import, and full-detail export
- reversible archive lifecycle for snapshots, scenarios, and saved result refs
- understanding-doc-strict compatibility validation for faithful snapshot CSV uploads
- executable `model-v1` baseline ruleset
- simple scenario modes: `Imported Data Only` for evidence-backed runs and `Add Forecast` for forward-looking assumptions
- ALPHA and Web3 scenario settings for token classification, transferability, on-chain status, supply model, token price basis, treasury reserve, liquidity pool, buy demand, sell pressure, burn, vesting unlock, and decision rules
- queued run orchestration with worker processing
- dataset-driven simulation over imported `SnapshotMemberMonthFact` rows
- persisted results across summary, distribution, treasury, compare, and decision-pack views
- Result Ref management with pinning and archive filters
- snapshot storage cleanup policy report as a secondary maintenance panel below the snapshot registry, with collapsible candidate detail for non-destructive cleanup planning
- company cashflow lens separated from ALPHA policy outputs in run, treasury, compare, and export surfaces
- compare workflow with selected-run management, radar quick-scan, and cashflow-first comparison tables
- founder-facing full simulation report export from run and compare surfaces
- sample Full Detail CSV files and glossary files for local testing

## Next Steps

1. Start Docker or another Docker daemon
2. Run `pnpm dev:setup`
3. Run `pnpm dev`
4. Restart the worker after code changes that add new job handlers
5. Use [examples/sample-member-month-facts.csv](./examples/sample-member-month-facts.csv) for Monthly CSV tests, or [examples/sample-source-detail-all-green.csv](./examples/sample-source-detail-all-green.csv) for Full Detail CSV tests

## Local Dev

This workspace is prepared for local development with:

- root env file: `.env`
- Next.js env file: `apps/web/.env.local`
- Prisma env file: `packages/db/.env`

The fastest setup path is:

1. Start Docker or another Docker daemon
2. Run `pnpm dev:setup`
3. Run `pnpm dev`

Useful local helper scripts:

- `pnpm calibrate:snapshot <snapshotId>`: compare observed imported snapshot totals against simulated baseline outputs
- `pnpm snapshot:import '<json>'`: register a snapshot from the terminal
- `pnpm snapshot:queue-import <snapshotId> --wait`: queue and wait for a snapshot import run

Browser CSV upload:

- the `Snapshots` form now supports direct CSV upload from the browser
- if `BLOB_READ_WRITE_TOKEN` is configured, uploaded files go straight to Vercel Blob from the browser and the app stores the resulting Blob URL
- otherwise local development falls back to `storage/uploads/snapshots` and registers a `file://` URI
- the worker imports either the Blob `https://...` URL or the local `file://` URI without changing the snapshot/scenario/compare workflow

The local Docker Postgres instance is bound to `127.0.0.1:5433` to avoid conflicts with a host Postgres
server already using `5432`.

Local Postgres is configured for development-only trust auth inside the Docker container. Do not
reuse this setup for shared or production environments.

Local development can seed default users for testing. Configure or rotate seeded credentials through
the environment and seed scripts instead of relying on hard-coded README values.

## Vercel Deployment

This repository is a pnpm monorepo. The Next.js app lives in `apps/web`, not in the repository root.

For Vercel:

1. Set the project's `Root Directory` to `apps/web`
2. Keep the install command as `pnpm install`
3. Build the Next.js app from that directory
4. Set `DATABASE_URL` to a hosted Postgres connection string, not the local Docker URL from `/.env.example`
5. Connect a Vercel Blob store to the web project so `BLOB_READ_WRITE_TOKEN` is available for client uploads on the Snapshots page

If you use a Vercel Postgres integration, the app now also accepts the injected `POSTGRES_PRISMA_URL`,
`POSTGRES_URL`, and `POSTGRES_URL_NON_POOLING` variables as production fallbacks.

If Vercel is pointed at the repository root, it will fail with `No Next.js version detected` because the root `package.json` does not contain the `next` dependency. That is expected for this workspace layout.
