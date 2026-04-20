# PRD v1: BGC Alpha Simulator

Status: Founder-facing draft v1  
Date: 2026-03-16  
Product Type: Internal web app backed by a simulation engine

## 1. Executive Summary

We should build an internal decision console for `ALPHA` use and distribution.

This product is not a public token app. It is an internal simulator that uses the real BGC and iBLOOMING reward system as the baseline, runs policy scenarios against historical data, and produces a recommended `ALPHA` pilot policy for founder approval.

The purpose is to replace assumption-based decisions with data-backed decisions before finalizing:

- `PC -> ALPHA` conversion
- `SP -> ALPHA` conversion
- cash-out policy
- reward intensity
- caps and guardrails
- sink priorities

## 2. Why This Product Should Exist

The current document set is already strong. The missing piece is a product that can test the proposed `ALPHA` model safely.

Today we have:

- the `AS-IS` reward system in BGC and iBLOOMING,
- draft `ALPHA` logic,
- draft token flow and policy tables,
- a simulation-first direction agreed in the later strategy documents.

What we do not yet have is a single internal system that can answer:

- Which `ALPHA` policy is sustainable?
- Which policy is fair enough across user segments?
- Which policy protects treasury and payout stability?
- Which policy should become the Phase 1 pilot recommendation?

## 3. Product Definition

The product should be:

- an `internal web app`,
- backed by a `real simulation engine`,
- using a validated `24-month historical dataset`,
- and producing a `decision-ready ALPHA pilot policy`.

This should be treated as an internal policy lab, not a chart dashboard.

## 4. Strategic Position

This PRD assumes the following Phase 1 position:

- `ALPHA` is an internal rights and simulation unit.
- `ALPHA` is not a public tradeable token in Phase 1.
- the simulator is for internal policy design, not external launch.
- any public token track such as `iBC` or `iBTC` remains outside the Phase 1 simulator scope.

## 5. Product Goal

### Primary Goal

Produce a recommended `ALPHA` pilot policy for BGC and iBLOOMING.

### Secondary Goals

- preserve the real business logic as the baseline,
- compare policy scenarios before commitment,
- quantify sustainability, fairness, and risk,
- generate outputs that can finalize Whitepaper and Token Flow decisions.

## 6. Users

Primary users:

- founders,
- product and tokenomics lead,
- operations and finance leads,
- internal analyst or operator running simulation scenarios.

Secondary users:

- engineering lead,
- legal or compliance reviewers,
- internal strategy team.

## 7. What The Product Must Do

The simulator must let approved users:

- load a historical data snapshot,
- configure policy parameters,
- run scenarios,
- compare results side by side,
- export a founder-ready simulation report.

At minimum, the product must support these scenario types:

- `Baseline`
- `Conservative`
- `Growth`
- `Stress`

## 8. Core Inputs

The simulator should use:

- the existing BGC and iBLOOMING reward logic as baseline,
- `PC`, `SP`, and related reward/pool flows,
- user and affiliate segmentation,
- cash-out behavior,
- historical operational data covering at least 24 months.

Important baseline rules to preserve unless explicitly overridden in a scenario:

- affiliate membership remains fiat-based,
- `100 PC = $1`,
- `1 SP = $1 reward basis`,
- `PC` remains tied to BGC physical-product logic,
- Phase 1 `ALPHA` remains internal and non-transferable by default.

## 9. Core Policy Variables To Simulate

The simulator must support testing at least:

- `PC -> ALPHA` ratio
- `SP -> ALPHA` ratio
- reward intensity
- pool intensity
- user and group caps
- sink target
- cash-out mode
- cash-out thresholds and fees
- windows vs always-open cash-out logic
- cooldown rules
- anti-abuse rules
- treasury protection thresholds

## 10. Core Outputs

The product must produce:

- `Scenario comparison dashboard`
- `Parameter recommendation table`
- `Distribution report`
- `Treasury and sustainability report`
- `Fairness report`
- `Founder-facing simulation report`
- `Whitepaper and Token Flow handoff values`

The most important output is:

`a recommended ALPHA pilot policy`

## 11. Recommended MVP

The MVP should include:

- dataset snapshot selection and validation,
- baseline business-model encoding,
- scenario builder,
- simulation execution,
- run history,
- comparison view,
- founder-ready report export.

The MVP does not need:

- public access,
- live wallet behavior,
- token deployment,
- direct production integration,
- real payout execution.

## 12. Key Screens

Recommended MVP screens:

- `Overview`
- `Data Snapshot`
- `Scenario Builder`
- `Run Results`
- `Compare Runs`
- `Distribution`
- `Treasury and Risk`
- `Decision Pack`

## 13. Founder Decisions Needed

This PRD cannot be fully finalized without founder alignment on these items:

- Should the default comparison baseline for cash-out be `always-open`, `window-based`, or both equally?
- Which ALPHA sinks are in Phase 1?
- Which source systems are the official 24-month data source of truth?
- Who owns final parameter approval?
- Is the simulator output advisory only, or should it support a formal approval workflow?

## 14. Success Criteria

This product is successful if:

- founders can compare multiple policy options without relying on spreadsheets,
- each scenario run is reproducible,
- the product highlights trade-offs clearly,
- the output is strong enough to support Whitepaper and Token Flow finalization,
- the product ends with a recommended pilot policy rather than only analysis.

## 15. Risks

Main risks:

- source data quality may be weaker than expected,
- some current business rules may still be interpreted differently,
- cash-out policy is not fully settled across all documents,
- the team may expect precise outputs before baseline data is clean enough.

## 16. Recommendation

I recommend approving this product direction as:

`an internal web-based decision console backed by a real simulation engine`

and not as:

- a dashboard-only analytics tool,
- a public token app,
- or an implementation project for live token behavior.

## 17. Proposed Next Step After PRD Approval

Once this founder-facing PRD is aligned, the next document should be:

`Build Spec v1`

That build spec should define:

- product screens,
- state and user flows,
- simulation inputs and outputs,
- core data model,
- MVP implementation boundaries.
