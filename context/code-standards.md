# Code Standards

Last updated: 2026-05-15

## General Principles

- Follow the existing TypeScript-first monorepo patterns.
- Keep implementation changes scoped to the package or app boundary that owns the behavior.
- Prefer shared Zod schemas and shared types over duplicated request/body parsing logic.
- Keep deterministic business logic in packages, not in page components.
- Keep heavy background work in the worker/DB processing layer, not in Next.js request handlers.
- Keep business terms aligned with the dictionaries and PRD docs.

## TypeScript

Compiler baseline:

- `strict: true`
- `moduleResolution: Bundler`
- `target: ES2022`
- `isolatedModules: true`
- `noEmit: true`

Conventions:

- Use explicit exported types for cross-package contracts.
- Keep narrow local helpers private to their module.
- Use `type` imports where values are not needed at runtime.
- Parse unknown input with Zod or structured parsers.
- Avoid broad `any`.
- Keep pure calculation functions deterministic and testable.

## Next.js App Router

Patterns:

- Default to server components for read-heavy pages.
- Use client components for interactive consoles and charts.
- Route handlers live under `apps/web/app/api`.
- Use `dynamic = "force-dynamic"` where pages need fresh DB state.
- Use page-level guards such as `requirePageUser` for protected pages.
- Keep API authorization checks in route handlers as well as page guards.

Do not:

- Put long-running simulation logic in a route handler.
- Recompute compare outputs in the browser when persisted run outputs exist.
- Add global middleware assumptions without checking current auth flow.

## Data Access

Use `packages/db` as the primary data access layer.

Preferred pattern:

- Route/page asks DB package for business object or command.
- DB package handles Prisma includes, lifecycle transitions, audit events, import/run processors, and persistence details.
- Packages above DB should not know Prisma model internals unless there is an established local pattern.

Use Prisma schema enums and models as source of truth for persistence names. If schema changes alter snapshot, scenario, run, result, or canonical data meaning, update docs and context.

## Simulation Logic

Use `packages/simulation-core` for:

- Conversion and issuance calculations.
- Treasury and token-flow ledger calculations.
- Summary metrics.
- Flags and recommendation evaluation.
- Strategic objective and milestone evaluation.

Rules:

- Preserve PC, SP, fiat, pool, reward, cash-out, and ALPHA as separate concepts.
- Keep actual uploaded sink spend separate from modeled sink assumptions.
- Keep forecast effects separable from observed data.
- Keep calculation output stable enough for regression tests.
- Do not silently change baseline model semantics; version or document changes.

## Snapshot Imports

Snapshot parsing and import rules belong in `packages/db` and `packages/schemas`.

For input work:

- Prefer structured CSV/JSON parsers and existing parser helpers.
- Respect `understanding_doc_strict` validation.
- Full Detail CSV/JSON should populate canonical tables and derive monthly facts.
- Monthly CSV remains a compatibility path and cannot provide all source-detail evidence.
- Preserve source-detail identity for reward sources, pool codes, qualifications, cash-out events, and role history.

## Scenario Guardrails

Use `packages/schemas/src/scenario.ts` and `SCENARIO_PARAMETER_GUARDRAIL_MATRIX.md` as the source of guardrail behavior.

Keep these semantics:

- Allowed: policy overlays such as conversion ratios and monthly caps.
- Conditional: assumptions such as sink, cash-out, forecast, ALPHA token policy, and Web3/tokenomics settings.
- Locked: generic reward multipliers and founder-safe cohort assumptions.

UI should show locked values as context without enabling unsafe edits.

## UI And Styling

Current styling is global CSS in `apps/web/app/globals.css` plus small shared components in `packages/ui`.

Guidelines:

- Reuse existing classes and components first.
- Keep internal-tool density.
- Avoid introducing a second styling system without a clear migration.
- Keep page copy short and decision-oriented.
- Use tables and compact metrics for comparison-heavy content.
- Do not add public landing pages for internal workflows.

## File Organization

Common ownership:

- Web pages: `apps/web/app/**/page.tsx`
- API routes: `apps/web/app/api/**/route.ts`
- Web client consoles: `apps/web/components/*-console.tsx`
- Web helper logic: `apps/web/lib`
- Worker jobs: `apps/worker/src/jobs`
- DB lifecycle and processors: `packages/db/src`
- Prisma schema: `packages/db/prisma/schema.prisma`
- Scenario/snapshot/result contracts: `packages/schemas/src`
- Engine logic: `packages/simulation-core/src`
- Exports: `packages/exports/src`
- Product/business dictionaries: root Markdown docs
- Canonical AI context: `context`

## Documentation

Update context or root docs when a change modifies:

- Product scope or user flow.
- Data model or snapshot input contract.
- Scenario parameter semantics or guardrails.
- UI language rules.
- Money/ALPHA metric definitions.
- Local setup, deployment, or verification commands.
- Progress status or known gaps.

Prefer updating the most specific doc first, then summarize in the relevant `context/*.md` file.

## Verification Commands

Use focused commands first, then broaden as risk increases.

Common commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Package-focused commands:

```bash
pnpm --filter @bgc-alpha/schemas test
pnpm --filter @bgc-alpha/simulation-core test
pnpm --filter @bgc-alpha/db test
pnpm --filter @bgc-alpha/web typecheck
pnpm --filter @bgc-alpha/worker typecheck
```

Local setup:

```bash
pnpm dev:setup
pnpm dev
```

Snapshot helpers:

```bash
pnpm snapshot:import '<json>'
pnpm snapshot:queue-import <snapshotId> --wait
pnpm calibrate:snapshot <snapshotId>
pnpm snapshot:build-bgc-bundle
pnpm snapshot:verify-bgc-bundle
```

## Test Expectations

- Schema changes need schema tests or parser fixtures where practical.
- Simulation changes need deterministic unit/regression tests.
- Snapshot import changes need compatibility/canonical fixture coverage.
- DB lifecycle changes need at least package tests or a local run through queue/import path.
- UI-only changes need typecheck and browser verification when the app behavior or layout changes.
- Docs/context-only changes do not require full app tests, but should be checked for correct filenames and links.

## Safety

- Do not overwrite source data in `NEW DATA FROM KK (MAY 26)/`, `csv files from prof/`, `deliverables/`, `outputs/`, `storage/`, or `examples/` unless explicitly asked.
- Do not edit `.env`, `apps/web/.env.local`, or `packages/db/.env` unless the user explicitly requests environment changes.
- Do not delete or clean untracked generated files unless asked.
- Do not run destructive git commands.
- When the worktree is dirty, assume existing changes belong to the user.
