# Compare Dictionary

This document explains the `Compare` page in simple English.

## What Compare Is

Compare puts completed run results side by side.

It does not create a new simulation. It reads existing completed results and helps the team choose which setup is strongest.

## What Compare Should Answer

- Which result is financially safer?
- Which result has better internal use?
- Which result creates lower cash-out risk?
- Which result has better fairness?
- Which result has stronger data support?
- Which result should become the pilot baseline?

## Compare Flow

| Step | UI area | Meaning |
| --- | --- | --- |
| 1 | Choose results to compare | Select 2 to 5 completed results. |
| 2 | Quick Score Chart | Visual scan only. Do not use it as the only decision source. |
| 3 | Summary | Plain summary of strongest choice, treasury safety, and data quality. |
| 4 | Result Cards | One card per result with money impact and treasury pressure. |
| 5 | Money View / Money Comparison | Cashflow-first comparison. Read this before ALPHA tables. |
| 6 | Data Completeness / Source Detail Check | Checks whether data support is strong enough. |
| 7 | Recommended Setup | Best current setup from selected results. |
| 8 | Parameter Guide / Parameter Ranges | Shows what values were tested and which ranges are safer. |
| 9 | Open Decisions / Decision Notes | Tracks decisions that still need owner approval. |
| 10 | ALPHA Flow / Treasury / Distribution / Goal / Phase Comparison | Deeper comparison tables. |

## Selection Rules

| UI label | Meaning |
| --- | --- |
| Choose results to compare | Select completed runs to review side by side. |
| 2-5 completed results | Recommended selection size so charts and tables stay readable. |
| Page link updates | Selected run IDs are stored in the URL so the same comparison can be reopened. |
| Download Report PDF | Export compare report as PDF. |
| Download Notes | Export compare report as Markdown notes. |
| Download Data | Export compare report as JSON data. |
| Change Results | Open/close the result selector. |
| Reset | Return to default selected results. |

## Quick Score Chart

The radar chart is a quick visual only.

| Radar dimension | Metric used | Meaning | Direction |
| --- | --- | --- | --- |
| Treasury Safety | `reserve_runway_months` | More months of runway means safer treasury support. | Higher is better. |
| Fairness | `reward_concentration_top10_pct` | Lower top-10% concentration means rewards are less concentrated. | Lower is better. |
| Internal Use | `sink_utilization_rate` | Share of ALPHA used inside the ecosystem. | Higher is better. |
| Growth Support | `alpha_issued_total` | Total ALPHA issued to support participation. | Higher can support growth, but must be checked against treasury. |
| Cash-Out Risk | `payout_inflow_ratio` | Obligations compared with revenue support. | Lower is better. |

Important: the radar normalizes different metrics so they can be seen together. Always confirm the decision in the money and treasury tables.

## Compare Sections

| UI section | Meaning |
| --- | --- |
| Summary | Plain summary of selected results and decision posture. |
| Status Memo | Short review memo showing ready, decision required, or blocked. |
| Result Cards | High-level card for each selected result. |
| Money View by Result | Narrative money view per result, including tradeoff. |
| Money Comparison | Side-by-side cashflow metrics. |
| Data Completeness | Whether uploaded data is strong enough behind each result. |
| Source Detail Check | Which source-detail areas are available or missing. |
| Recommended Setup | The strongest setup among selected results. |
| Parameter Guide | Meaning, tested values, current default, suggested choice, and owner. |
| Parameter Ranges | Recommended, use-with-care, and do-not-use ranges. |
| Open Decisions | Questions that need founder or team decision. |
| Next Build Steps | Practical work needed before final evidence pack. |
| Decision Notes | Saved decision status and owner per result. |
| Data vs Assumptions | Separates imported data, editable levers, assumptions, locked values, and calculated outputs. |
| ALPHA Flow Comparison | ALPHA issued, used, actual used, modeled used, held, cash-out, ending, and burned. |
| Treasury Safety Comparison | Pressure, runway, internal use, and reward concentration. |
| Distribution View | Largest member group, largest ALPHA source, and source-level net cash. |
| Goal Comparison | Strategic goal status, score, evidence, and reason. |
| Phase Comparison | Milestone status, pressure, runway, payout, and net cash. |
| Result Details | Run ref, scenario, snapshot, status, and completion date. |

## Money Comparison Metrics

| Metric | Good direction | Meaning |
| --- | --- | --- |
| Cash In | Higher | More total business cash collected. |
| Revenue Kept | Higher | More revenue retained by the company. |
| Partner Payout | Lower for treasury, but must respect business model | Cash passed through to partners/creators. |
| Direct Rewards Owed | Lower for treasury | Direct reward obligations. |
| Pool Funding Owed | Lower for treasury | Pool funding obligations. |
| Cash Paid Out | Lower | Actual cash-equivalent paid out. |
| Fulfillment Cost | Lower for treasury | Product fulfillment value. |
| Net Cash Change | Higher | Better net treasury result. |

## ALPHA Comparison Metrics

| Metric | Good direction | Meaning |
| --- | --- | --- |
| Total ALPHA Issued | Context-dependent | More issuance may support growth but can increase liability. |
| Total ALPHA Used | Higher | More ALPHA is being used internally. |
| Actual ALPHA Used | Higher | Stronger because it comes from uploaded data. |
| Modeled ALPHA Used | Useful but caveated | Comes from assumptions, not uploaded history. |
| Total ALPHA Held | Context-dependent | Held balance can show future liability or user retention. |
| ALPHA Cash-Out | Lower | Less ALPHA enters the cash-out path. |
| Ending ALPHA Balance | Context-dependent | Remaining ALPHA after flows. |
| Expired / Burned ALPHA | Context-dependent | Removed ALPHA if burn/expiry policy exists. |

## Treasury Safety Metrics

| Metric | Good direction | Meaning |
| --- | --- | --- |
| Treasury Pressure | Lower | Above `1.0x` means obligations exceed recognized revenue support. |
| Reserve Runway | Higher | More months reserve can support obligations. |
| Internal Use Rate | Higher | More issued ALPHA is used inside the ecosystem. |
| Actual Internal Use Rate | Higher | Stronger because it comes from uploaded data. |
| Modeled Internal Use Rate | Higher with caveat | Comes from forecast/adoption assumptions. |
| Top 10% Reward Share | Lower | Lower concentration means fairer distribution. |

## Status Labels

| UI label | Meaning |
| --- | --- |
| Recommended | Best current option among selected results. |
| Needs Review | Useful but needs review because of risk, data gaps, or assumptions. |
| Blocked | Should not be used until blockers are fixed. |
| Ready to Use | Comparison is strong enough for action. |
| Decision Required | Team must answer open questions before action. |
| Current Baseline | This result is already selected as the pilot baseline for its scenario. |
| Current strongest result | Best result within the current compare selection. |

## Data And Evidence Labels

| UI label | Meaning |
| --- | --- |
| Strong | Data support is strong enough for high-confidence discussion. |
| Some Gaps | Data can be used, but warnings must stay visible. |
| Weak | Data supports discussion only, not final claims. |
| Available | Source detail exists for the area. |
| Missing | Source detail is not available. |
| Not available | The selected result has no recorded row for that item. |
| Direct Data | Evidence comes directly from imported data. |
| Proxy Estimate | Evidence is estimated from indirect data. |
| Checklist Only | Evidence is only checklist-level. |

## Parameter Labels

| UI label | Meaning |
| --- | --- |
| Editable | Can be changed as a policy lever. |
| Assumption | Can be changed, but result must be treated as an assumption. |
| Locked | Protected because changing it would make results less reliable. |
| Recommended Values | Range that looks best among selected runs. |
| Use With Care | Range that can work but carries caveats. |
| Do Not Use | Range that produced unacceptable risk or poor output. |
| Tested Values | Values present in the selected runs. |
| Current Default | Current working default. |
| Suggested Choice | Recommended value or direction. |
| Decision Owner | Person or team responsible for approving the setting. |

## Important Reading Rules

- Compare does not prove a scenario is true. It compares completed results.
- Read money before ALPHA. Cashflow safety decides whether ALPHA policy is practical.
- The radar is only a quick scan.
- Lower cash-out risk is good only if growth and internal use remain acceptable.
- Forecast-heavy results must be labeled as forecast.
- A result with weak data quality should not win over a slightly weaker but better-supported result without explicit decision approval.
