# AI Workflow Rules

Last updated: 2026-05-15

## How To Use This Context Pack

Read these files first, in order, before substantial repo work:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`

Treat them as current project guidance, not permanent law. If repo code or latest user instruction conflicts with context, inspect the code and follow the newest verified source.

## First Response Workflow

When starting a new task:

1. Confirm the task scope from the user's latest message.
2. Check `git status --short`.
3. Read the relevant context files and project docs.
4. Inspect current code before assuming architecture.
5. Identify the smallest safe implementation surface.
6. Make changes only in files needed for the request.
7. Run focused verification.
8. Update context if product scope, architecture, UI rules, code standards, workflow rules, or progress changed.

## Source Priority

Use this order when sources disagree:

1. Latest explicit user instruction.
2. Current code and runtime behavior.
3. Canonical business specs and dictionaries.
4. This `context/` pack.
5. Older plans, deliverables, generated docs, or archived outputs.

Important: the understanding-document-aligned business semantics are treated as the business source of truth. Do not weaken them for convenience.

## Scoping Rules

Prefer narrow, complete changes:

- Fix the requested behavior, not unrelated design debt.
- Preserve existing naming and package boundaries.
- Avoid broad refactors unless they remove real risk or unblock the task.
- Do not migrate styling, auth, DB, or worker architecture opportunistically.
- Keep product copy aligned with dictionaries.

If a task spans multiple domains, split mentally by owner:

- Product/documentation.
- Web UI.
- API route.
- DB lifecycle.
- Worker job.
- Schema contract.
- Simulation engine.
- Export/reporting.

## Missing Requirement Handling

Make a reasonable assumption when:

- The repo already has a clear pattern.
- The choice is low risk.
- The change is reversible.

Ask the user only when:

- A business policy choice affects founder decision output.
- A data migration or destructive action is involved.
- Multiple plausible interpretations would create materially different results.
- Required credentials, private source files, or external approvals are missing.

## Protected Areas

Be careful with:

- `.env`, `apps/web/.env.local`, `packages/db/.env`
- `NEW DATA FROM KK (MAY 26)/`
- `csv files from prof/`
- `deliverables/`
- `outputs/`
- `storage/`
- `tmp/`
- source data and generated decks/docs

Do not delete, overwrite, reformat, or regenerate these unless the user asks.

## Dirty Worktree Rules

The worktree may include user edits, generated files, imported data, and untracked deliverables.

Rules:

- Do not reset or revert user changes.
- Do not clean untracked files.
- If a file you need is already modified, inspect it and work with the current content.
- If unrelated files are dirty, ignore them.
- If user changes make the requested task impossible, explain the conflict and ask for direction.

## Business Semantics Rules

For simulator work:

- Keep PC, SP, LTS, fiat revenue, product spend, reward obligations, pools, cash-out, and ALPHA distinct.
- Preserve named reward sources: RR, GR, BGC-MC, GPSP, WEC Pool, LR, iBLOOMING-MC, CPR, GRR, iRR, GPS, GMP, and GEC.
- Preserve pool identity and distribution cycles.
- Preserve member role/status time history.
- Do not make member-month aggregates the canonical truth when full-detail rows exist.
- Do not present forecast assumptions as observed facts.
- Do not mix cashflow safety and ALPHA movement in the same metric definition.

## UI Workflow Rules

For frontend work:

- Build the real internal workflow screen, not a landing page.
- Keep the shell/sidebar workflow consistent.
- Use `PageHeader`, `.card`, `.table`, `.badge`, and existing CSS patterns when possible.
- Keep money and ALPHA sections visually distinct.
- Keep source detail gaps and data-quality warnings visible.
- Avoid decorative-only visuals.
- Verify significant UI changes in a browser when a local target is available.

## Documentation Sync Rules

Update documentation when:

- A snapshot input field, file type, validation rule, or source-detail behavior changes.
- A scenario parameter, guardrail, or label changes.
- A metric definition or recommendation status changes.
- A new page, workflow step, export, or worker job is added.
- Local setup, env vars, deployment, or test command behavior changes.

Update these context files as a concise map, not a full duplicate of every root doc.

## Verification Strategy

Choose verification by risk:

- Docs/context only: confirm files exist and review diff.
- Schema/parser changes: run package tests for `@bgc-alpha/schemas` and relevant DB tests.
- Simulation changes: run `@bgc-alpha/simulation-core` tests and any affected schema tests.
- Import changes: run `@bgc-alpha/db` tests and, when possible, queue/import a fixture.
- Web route/page changes: run `@bgc-alpha/web typecheck`; use browser verification for UI.
- Worker changes: run `@bgc-alpha/worker typecheck`; restart worker in local dev if needed.
- Cross-package changes: run root `pnpm typecheck`, `pnpm test`, and maybe `pnpm build`.

## Resume Notes

When resuming work:

- Read `context/progress-tracker.md`.
- Check latest git status.
- Prefer current repo state over older progress notes.
- Continue from the newest user request, not from stale context.
