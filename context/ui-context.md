# UI Context

Last updated: 2026-05-15

## Product Feel

The UI is an internal policy lab and decision console. It should feel dense, calm, and operational, not like a marketing landing page. Users are founders, operators, finance/product leads, analysts, and engineers who need repeatable workflows and audit-friendly outputs.

Design priorities:

- Make the workflow obvious: Snapshots, Scenarios, Result Ref, Compare.
- Keep money, ALPHA flow, treasury, and data-quality evidence easy to scan.
- Prefer table, metric, and status layouts over decorative compositions.
- Keep founder-facing wording simple and business-oriented.
- Do not hide assumptions or weak data behind attractive visuals.

## Current Visual Language

The app uses a dark dashboard theme in `apps/web/app/globals.css`.

Current tokens:

- Background: deep slate (`#0F172A`) and related slate surfaces.
- Primary accent: green (`#10B981`) for active/candidate states.
- Warning: amber (`#F59E0B`).
- Danger/rejected: red (`#EF4444`).
- Info: indigo (`#6366F1`).
- Text: white/slate scale.
- Radius: mostly 8px to 20px, with small cards and round badges.
- Layout: sticky left sidebar, content grid, cards, tables, badges, and status dots.

The current palette leans dark slate. If redesigning, keep the internal-tool density and avoid turning the app into a one-note purple/blue gradient or marketing surface.

## App Shell

The main shell is `apps/web/components/app-shell.tsx`.

Structure:

- Left sticky sidebar.
- Brand block: `BGC Alpha`, `ALPHA Policy Simulator`.
- Workflow nav from `apps/web/lib/navigation.ts`.
- User panel and sign-out button.
- Main content area.

Navigation items:

- Overview: dashboard and system status.
- Snapshots: uploaded business data.
- Scenarios: policy configurations.
- Result Ref: saved run references.
- Compare: side-by-side results.

## Page Patterns

Use `PageHeader` from `@bgc-alpha/ui` for page titles, descriptions, and step indicators.

Use existing card/table/badge/status classes before inventing new component primitives:

- `.page-grid`
- `.card`
- `.span-4`, `.span-6`, `.span-8`, `.span-12`
- `.metric`, `.metric-sub`
- `.badge`
- `.status-dot`
- `.table`
- `.empty-state`

Avoid nested cards. Cards should frame individual repeated items, metrics, focused panels, modals, or tools, not whole sections inside other sections.

## Workflow UX

Preferred screen logic:

- Overview gives status and quick access, not a marketing intro.
- Snapshots explains data lifecycle through action state: upload/register, import, check, approve, archive.
- Scenarios shows editable levers with guardrail labels and locks.
- Results pages lead with money and risk before ALPHA narrative.
- Compare defaults to cashflow-first decision support and treats radar charts as a quick scan only.
- Decision Pack summarizes recommendation, blockers, assumptions, source detail, and export options.

## Language Rules

The app currently uses English UI copy with some Indonesian documentation variants. For new UI text:

- Use simple business English unless the target document or surface is explicitly Indonesian.
- Prefer user-facing labels from dictionaries:
  - `Imported Data Only`
  - `Add Forecast`
  - `Monthly CSV`
  - `Full Detail CSV`
  - `Full Detail JSON`
  - `Hybrid Data`
  - `Ready`, `Needs Review`, `Do Not Use`
- Avoid exposing internal terms like `canonical` in normal user copy when `Full Detail Data` is clearer.
- When a business meaning is easy to misunderstand, add short explanatory text, not technical jargon.

## Data And Evidence Display

Always preserve these distinctions in UI:

- Cash In, Revenue Kept, Partner Payout, Rewards Owed, Pool Funding Owed, Cash Paid Out, Fulfillment Cost, and Net Cash Change are money metrics.
- ALPHA Issued, Used, Held, Cash-Out, Ending Balance, and Burned are ALPHA movement metrics.
- Actual ALPHA Used comes from uploaded data.
- Modeled ALPHA Used comes from assumptions.
- Direct Data, Proxy Estimate, Checklist Only, Imported Data, Editable, Assumption, Locked, and Calculated should remain visible where relevant.

Do not make a weakly supported run look final. Weak data and source-detail gaps must stay visible in Compare and Decision Pack surfaces.

## Controls

For new controls:

- Use tabs for switching related views.
- Use segmented controls for modes like Imported Data Only vs Add Forecast.
- Use toggles or checkboxes for binary settings.
- Use numeric inputs, steppers, or sliders only where bounded ranges are clear.
- Use selects/menus for finite business choices.
- Use icon buttons for common actions when the icon is familiar; add accessible labels/tooltips.

The app currently uses inline SVG icons in the shell. If adding a proper icon library later, migrate consistently rather than mixing styles page by page.

## Tables And Charts

Tables are first-class. Make them readable:

- Align money and numeric metrics consistently.
- Keep units visible.
- Keep status labels near the metric they qualify.
- Avoid truncating important business labels without a way to inspect them.

Charts:

- ECharts is already available.
- Radar chart is only a quick scan; decision logic should still be visible in tables and text.
- Do not use decorative charts that obscure exact numbers.

## Responsive And Accessibility Bar

Minimum bar:

- Text must not overlap or overflow controls on desktop or mobile.
- Cards and grids should collapse predictably.
- Buttons and links need visible focus and meaningful accessible labels.
- Status should not rely on color alone; pair color with text labels.
- Tables should remain usable on narrower screens through scroll containers or responsive reshaping.
- Server-rendered pages should stay server components unless interactive state requires client components.

## UI Anti-Patterns

Avoid:

- Landing-page hero layouts for this product.
- Decorative blobs, orbs, stock-like imagery, or full-bleed marketing art.
- Large, sparse cards that hide decision density.
- Mixing cash and ALPHA in the same visual bucket.
- Hiding forecast caveats.
- Overusing client components for read-heavy pages.
- Creating new visual primitives when existing `.card`, `.table`, `.badge`, and shared components fit.
