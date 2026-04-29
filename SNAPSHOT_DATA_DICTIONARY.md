# Snapshot Data Dictionary

This document explains the snapshot data formats that the simulator can read today.

Language rule for this document:

- Use the simple English label that appears in the UI first.
- Show the internal code value in backticks for engineers.
- Add short Indonesian notes where the business meaning can be misunderstood.

## How The Engine Reads Snapshot Data

A snapshot is one version of business data used for simulation.

The flow is:

1. Create a snapshot record in the `Snapshots` screen.
2. Upload or link a data file.
3. Choose the file type.
4. Import the file.
5. Run **Data Check**.
6. Approve the snapshot.
7. Use the approved snapshot in a scenario run.

Indonesian note: snapshot itu bukan hasil simulasi. Snapshot adalah bahan baku data yang dipakai engine untuk menghitung hasil simulasi.

## Snapshot File Types

These are the choices in the `File type` dropdown.

| UI label | Internal value | What it means | Best use | Important limit |
| --- | --- | --- | --- | --- |
| Monthly CSV | `compatibility_csv` | One row is already summarized as one member in one month. | Fastest format for basic simulation. Good when the team only has monthly spreadsheet totals. | It only fills monthly simulation rows. It cannot make every Source Detail checklist green because it does not contain detailed source events. |
| Full Detail CSV | `canonical_csv` | One normal CSV with a `record_type` column. Each row tells the engine what kind of source detail it represents. | Best format for non-technical users who still need full source detail from CSV. | More columns are needed. Some rows only use a few columns and leave the rest blank. |
| Full Detail JSON | `canonical_json` | The same full-detail data model as Full Detail CSV, but written as nested JSON. | Best for system exports or engineering integrations. | Harder for non-technical users to edit manually. |
| Full Detail Bundle | `canonical_bundle` | A packaged full-detail source set. It can represent data prepared from multiple source files. | Best when source data comes from several controlled files instead of one CSV. | The bundle must still map back to the full-detail model. |
| Hybrid Data | `hybrid_verified` | Mixed data: some rows are backed by source detail, and some rows are monthly aggregate rows used for review. | Useful while migrating from spreadsheet-style data into full-detail data. | It can be approved and usable, but may still show Source Detail gaps if some source details are missing. |

Simple rule:

- Use **Monthly CSV** when you only need quick monthly simulation.
- Use **Full Detail CSV** when you want CSV and also want all Source Detail checks to become available.
- Use **Full Detail JSON** or **Full Detail Bundle** when data comes from systems or engineering pipelines.
- Use **Hybrid Data** when the dataset is partly detailed and partly monthly aggregate.

## Snapshot Check Methods

These are the choices in the `Check method` dropdown.

| UI label | Internal value | Meaning |
| --- | --- | --- |
| Monthly data | `monthly_facts` | Check the file as monthly member-period facts. This matches Monthly CSV. |
| Event data | `canonical_events` | Check the file as full-detail source records. This matches Full Detail CSV and Full Detail JSON. |
| Hybrid check | `hybrid_validation` | Check mixed source-detail plus monthly aggregate data. This matches Hybrid Data. |

## Snapshot Status Terms

| UI label | Internal value | Meaning |
| --- | --- | --- |
| Draft | `DRAFT` | Snapshot exists, but it has not passed Data Check yet. |
| Checking | `VALIDATING` | The system is checking the imported data. |
| Ready to Approve | `VALID` | Data Check passed. A user with approval access can approve it. |
| Approved | `APPROVED` | The snapshot can be used for scenario runs. |
| Needs Fixes | `INVALID` | Data Check found blocking problems. |
| Archived | `ARCHIVED` | Hidden from the default active list. The data is not deleted. |

## Data Quality Terms

| UI label | Meaning |
| --- | --- |
| Data Check OK | The snapshot has the P0 data fingerprint and passed the required integrity check. |
| Data Check Missing | The snapshot was created before P0 or was not re-imported, so the fingerprint is missing. Re-import before using it as strong evidence. |
| Data Quality: Strong | The data is good enough to treat as strong simulation evidence. |
| Data Quality: Some Gaps | The data can be used, but some parts are incomplete. Keep warnings visible. |
| Data Quality: Weak | The data can support discussion, but it should not be treated as final evidence. |
| Source Detail: Available | The detailed source records exist for that area. |
| Source Detail: Some Gaps | Some detailed records exist, but not enough for a complete check. |
| Source Detail: Missing | The engine does not have detailed source records for that area. |

## Monthly CSV Columns

Monthly CSV is the easiest input format. One row means: one member, one source system, one month.

Required columns are the first 12 columns. The last 6 columns are optional but recommended because they improve treasury and member-history reading.

| Column | Required | Meaning |
| --- | --- | --- |
| `period_key` | Yes | Month being reported. Use `YYYY-MM`, for example `2025-01`. |
| `member_key` | Yes | Stable member ID used in the monthly file. |
| `source_system` | Yes | Source system name, for example `bgc` or `iblooming`. |
| `member_tier` | Yes, can be blank | Member level or tier for that month, for example `PATHFINDER`. |
| `group_key` | Yes, can be blank | Group/cohort label, for example `FOUNDERS` or `CP_CREATORS`. |
| `pc_volume` | Yes | PC amount for that member-month. PC is product/business activity value. |
| `sp_reward_basis` | Yes | Reward-basis points for the row. For BGC this is SP/LTS. For iBLOOMING this may be Sales Point from product or channel activity. |
| `global_reward_usd` | Yes | Direct/global reward value in USD-equivalent. |
| `pool_reward_usd` | Yes | Pool-based reward value in USD-equivalent. |
| `cashout_usd` | Yes | Cash-out amount paid or expected for that member-month. Put `0` when there is no cash-out. |
| `sink_spend_usd` | Yes | Internal-use value in USD. This is ALPHA/PC used inside the ecosystem, not cash paid out. |
| `active_member` | Yes | Whether the member is active in that month. Accepted values: `true`, `false`, `1`, `0`, `yes`, `no`, `y`, `n`. |
| `recognized_revenue_usd` | Recommended | Revenue the company recognizes from that row. Used for cashflow and treasury support. |
| `gross_margin_usd` | Optional | Gross margin if known. Leave blank if unknown. |
| `member_join_period` | Recommended | First month the member joined. Use `YYYY-MM`. |
| `is_affiliate` | Recommended | Whether the member is treated as an affiliate. Same boolean values as `active_member`. |
| `cross_app_active` | Recommended | Whether the member is active across BGC and iBLOOMING. Same boolean values as `active_member`. |
| `extra_json` | Optional | Extra structured notes as JSON. Use this for breakdowns, source notes, and accountability checks. |

Indonesian note: `cashout_usd` wajib sebagai kolom di Monthly CSV. Kalau tidak ada cash-out, isi `0`, bukan dikosongkan.

## Monthly CSV Business Source And Calculation Basis

Monthly CSV rows are already summarized. That means the spreadsheet owner is responsible for providing the monthly totals, and the engine checks whether those totals still make business sense.

| Column | Business source | How the current engine reads it |
| --- | --- | --- |
| `pc_volume` | BGC affiliate entry or upgrade activity that grants PC. | For BGC rows with `extra_json.recognized_revenue_basis.entry_fee_usd`, the engine validates the PC against the BGC tier rule table below. In practice the current accepted BGC tiers use `entry_fee_usd x 100`, for example `$100 -> 10,000 PC`. For iBLOOMING rows, PC must be `0` because PC is treated as a BGC-only unit. |
| `sp_reward_basis` | Reward-basis points created by the business source. BGC can create SP/LTS from affiliate entry or upgrade rules. iBLOOMING can create Sales Point from product or channel activity. | For BGC rows with an entry-fee basis, the engine validates SP against the BGC tier rule table. For iBLOOMING rows, the engine now allows Sales Point in this field; use `extra_json.sp_breakdown`, for example `{"IB_SALES_POINT": 1200}`, so the source of the points is clear. |
| `global_reward_usd` | Direct/global rewards owed or distributed to members, such as BGC RR/GR or iBLOOMING rebate reward families. | The engine treats this as imported reward obligation value. If non-zero, `extra_json.global_reward_breakdown_usd` should explain which reward family produced it. |
| `pool_reward_usd` | Pool distribution value paid or allocated to members. | The engine treats this as imported pool reward value. If non-zero, `extra_json.pool_reward_breakdown_usd` should explain which pool produced it. |
| `cashout_usd` | Cash-out that was paid, or approved if payment detail is not separated yet. | This is actual cash leaving the ecosystem. It is separate from reward accrual and separate from internal ALPHA use. Put `0` when there is no cash-out. |
| `sink_spend_usd` | Internal-use spend inside the ecosystem, for example paying for an iBLOOMING/iBoomie product with ALPHA/PC. | This feeds Actual ALPHA Used. It is not company revenue by itself and it is not cash paid out. For iBLOOMING sales, the current compatibility rule expects this to match gross sale value when the row carries gross sale basis. |
| `recognized_revenue_usd` | Revenue the company recognizes from the event or monthly row. | For BGC this usually comes from entry/upgrade fee basis. For iBLOOMING this should be platform revenue, currently validated as `30%` of gross sale when gross sale basis is provided. |
| `gross_margin_usd` | Gross margin after direct cost, if the source system or finance team knows it. | The engine does not invent gross margin when it is blank. It uses the provided value for evidence and reporting when available. |
| `active_member`, `member_tier`, `member_join_period`, `is_affiliate`, `cross_app_active` | Member status and lifecycle data from CRM, membership, or role history. | These fields affect activity multipliers, lifecycle reading, and eligibility-style interpretation in scenario runs. |

### Current BGC Tier Rule Table

These are the BGC tier values the engine currently accepts for Monthly CSV validation.

| BGC tier | Entry fee basis | PC volume | SP reward basis | Business note |
| --- | ---: | ---: | ---: | --- |
| `PATHFINDER` | `$100` | `10,000` | `70` | Entry-level BGC affiliate package. |
| `VOYAGER` | `$500` | `50,000` | `350` | Higher BGC affiliate package. |
| `EXPLORER` | `$1,725` | `172,500` | `1,207` | Higher BGC affiliate package. SP is the engine's accepted integer value. |
| `PIONEER` | `$2,875` | `287,500` | `2,012` | Higher BGC affiliate package. SP is the engine's accepted integer value. |
| `SPECIAL` | `$11,500` | `1,150,000` | `8,050` | Highest accepted BGC package in the current rule table. |

Simple answer for PC: yes, for the current BGC tier table `pc_volume` is effectively `entry_fee_usd x 100`. But the engine validates it as a locked business tier rule, so the safer way to explain it is: **PC comes from the BGC affiliate package rule, and today that rule maps each accepted entry fee to PC at 100 PC per USD.**

## Full Detail CSV Basic Idea

Full Detail CSV is still a normal spreadsheet-style CSV.

The key difference is the first column:

`record_type`

That value tells the engine how to read the row.

Example:

- `member` row creates or updates one internal member.
- `business_event` row records one business event such as a join, product sale, pool funding, or cash-out event.
- `cashout_event` row records real cash paid out.

Indonesian note: satu file Full Detail CSV memang punya banyak jenis baris. Itu normal. Kolom yang tidak relevan untuk jenis baris tertentu boleh dikosongkan.

## Why `member` And `member_alias` Are Separate

`member` means the internal person/account used by the simulator.

`member_alias` means the ID used by a source system.

They are separate because one real person can appear with different IDs in different systems.

Example:

- Internal simulator member: `AFF-ALPHA`
- BGC source ID: `BGC-AFF-ALPHA`
- iBLOOMING creator ID: `IB-CP-ALPHA`
- Wallet address: stored later as another alias or metadata when needed

Use one `member` row with `source_system`, `alias_key`, `alias_type`, and `confidence` filled when there is only one source-system ID.

Use extra `member_alias` rows only when the same internal member has more than one source-system ID.

## Full Detail CSV Record Types

| Primary `record_type` | Accepted aliases | Meaning | Minimum important columns |
| --- | --- | --- | --- |
| `member` | `members` | One internal member/account. | `stable_key`; recommended: `display_name`, `group_key`, `join_period`, `source_system`, `alias_key` |
| `member_alias` | `member_aliases`, `alias` | A source-system ID for a member. | `member_stable_key`, `source_system`, `alias_key` |
| `role_history` | `member_role` | Member status over time, such as affiliate level, CP status, WEC status, or cross-app status. | `member_stable_key`, `role_type`, `role_value`, `effective_from` |
| `offer` | `offers` | Product, package, or offer definition. | `offer_code`, `offer_type`, `source_system`; recommended: `label`, `price_fiat_usd` |
| `business_event` | `business_events`, `event` | Business action that happened, such as join, purchase, product sale, pool funding, or reward accrual. | `event_ref`, `event_type`, `source_system`, `occurred_at`, `effective_period` |
| `pc_entry` | `pc_entries`, `pc_ledger` | PC ledger movement. | `member_stable_key`, `entry_type`, `effective_period`, `amount_pc` |
| `sp_entry` | `sp_entries`, `sp_ledger` | SP ledger movement. | `member_stable_key`, `entry_type`, `effective_period`, `amount_sp` |
| `reward_obligation` | `reward_obligations`, `reward` | Reward owed or distributed to a member. | `member_stable_key`, `reward_source_code`, `distribution_cycle`, `effective_period`, `amount`, `unit` |
| `pool_entry` | `pool_entries`, `pool` | Pool funding, allocation, adjustment, or distribution. | `pool_code`, `entry_type`, `distribution_cycle`, `effective_period`, `amount`, `unit` |
| `cashout_event` | `cashout_events`, `cashout` | Cash-out request, approval, payment, or rejection. | `member_stable_key`, `event_type`, `occurred_at`, `effective_period`, `amount_usd` |
| `qualification_window` | `qualification_windows` | Time window for qualification, for example WEC 60-day window. | `member_stable_key`, `qualification_type`, `window_key`, `starts_at`, `ends_at` |
| `qualification_status` | `qualification_status_history` | Status update inside or after a qualification window. | `member_stable_key`, `qualification_type`, `status`, `effective_from` |

## Full Detail CSV Columns

| Column | Used by | Meaning |
| --- | --- | --- |
| `record_type` | All | Tells the engine what kind of row this is. Required for every row. |
| `snapshot_id` | All | Batch ID for this file. Optional, but if used every row must use the same value. |
| `stable_key` | `member` | Internal member ID used by the simulator. |
| `display_name` | `member` | Human-readable member name. |
| `group_key` | `member` | Group/cohort label, for example `FOUNDERS`. |
| `join_period` | `member` | First month the member joined. Use `YYYY-MM`. |
| `member_stable_key` | Most detail rows | Link back to a `member.stable_key`. |
| `source_system` | `member`, `member_alias`, `role_history`, `offer`, `business_event` | Business system where the row came from. |
| `alias_key` | `member`, `member_alias` | Member ID in the original source system. |
| `alias_type` | `member`, `member_alias` | Type of source ID. If blank, the engine defaults to `member_id`. |
| `confidence` | `member`, `member_alias` | Match confidence from `0` to `1`. Use `1` when the mapping is certain. |
| `role_type` | `role_history` | Which status category is being recorded. |
| `role_value` | `role_history` | The actual status value, for example `PATHFINDER` or `CP`. |
| `effective_from` | `role_history`, `qualification_status` | Date/time when the status starts. |
| `effective_to` | `role_history`, `qualification_status` | Date/time when the status ends. Leave blank if still active. |
| `source_event_ref` | Detail rows | The `business_event.event_ref` that supports this row. Recommended for audit trail. |
| `offer_code` | `offer`, `business_event` | Product/package/offer code. |
| `offer_type` | `offer` | Offer category. |
| `label` | `offer` | Human-readable offer name. |
| `price_fiat_usd` | `offer` | Offer price in USD. |
| `pc_grant` | `offer` | Simple PC amount granted by this offer. |
| `sp_accrual` | `offer` | Simple SP / Sales Point amount accrued by this offer. |
| `pc_grant_rule` | `offer` | Advanced JSON object for PC grant logic. Overrides `pc_grant` when filled. |
| `lts_generation_rule` | `offer` | Advanced JSON object for SP/LTS or Sales Point generation logic. Overrides `sp_accrual` when filled. |
| `reward_rule_reference` | `offer` | Name or reference for the business rule behind the offer reward. |
| `event_ref` | `business_event` | Unique ID for a business event. Other rows can point to it with `source_event_ref`. |
| `event_type` | `business_event`, `cashout_event` | Kind of event that happened. Business events and cash-out events use different allowed values. |
| `occurred_at` | `business_event`, `cashout_event` | Date/time when the event happened. |
| `effective_period` | Event and ledger rows | Month where the row counts in simulation. Use `YYYY-MM`. |
| `actor_member_stable_key` | `business_event` | Member who performed the action. |
| `beneficiary_member_stable_key` | `business_event` | Member who received the benefit or reward. |
| `related_member_stable_key` | `business_event` | Another member related to the event, for example an upline. |
| `quantity` | `business_event` | Number of items or actions. |
| `amount` | `business_event`, `reward_obligation`, `pool_entry` | Generic amount. The `unit` column explains what the amount means. |
| `unit` | `business_event`, `reward_obligation`, `pool_entry` | Unit for `amount`, for example `USD`, `PC`, or `SP`. |
| `recognized_revenue_usd` | `business_event` | Revenue recognized by the company from this event. Used in cashflow and treasury metrics. |
| `gross_margin_usd` | `business_event` | Gross margin from this event if known. |
| `entry_type` | `pc_entry`, `sp_entry`, `pool_entry` | Ledger movement type. Values depend on the row type. |
| `amount_pc` | `pc_entry` | PC amount for one PC ledger movement. |
| `amount_sp` | `sp_entry` | SP / Sales Point amount for one reward-basis ledger movement. |
| `sink_spend_usd` | `pc_entry` | USD value of internal ecosystem use. Recommended when `entry_type=SPEND`. |
| `reward_source_code` | `reward_obligation` | Reward family code, for example `BGC_RR` or `IB_CPR`. |
| `distribution_cycle` | `reward_obligation`, `pool_entry` | How often the reward or pool distributes. |
| `obligation_status` | `reward_obligation` | Current reward obligation status. Defaults to `ACCRUED` when blank. |
| `origin_join_level` | `reward_obligation` | Source join level used by BGC reward validation. |
| `tier` | `reward_obligation` | Tier number used by selected reward formulas. |
| `imatrix_plan` | `reward_obligation` | iMatrix plan code used by selected iBLOOMING reward math. |
| `eligibility_snapshot_key` | `reward_obligation`, `pool_entry` | Reference to the eligibility snapshot used for the reward or pool. |
| `pool_code` | `pool_entry` | Pool identifier. |
| `recipient_member_stable_key` | `pool_entry` | Member receiving pool distribution. Leave blank for pool funding rows. |
| `share_count` | `pool_entry` | Recipient share count for pool distribution. |
| `pool_recipient_count` | `pool_entry` | Total recipient count for the pool distribution snapshot. |
| `pool_share_total` | `pool_entry` | Total share count for the pool distribution snapshot. |
| `amount_usd` | `cashout_event` | Cash-out amount in USD. Required for cash-out rows. |
| `fee_usd` | `cashout_event` | Cash-out fee in USD. Fill `0` when there is no fee. |
| `cashout_source_system` | `cashout_event` | Source system for the cash-out. If blank, the engine tries to infer it, then defaults to BGC. |
| `breakdown_key` | `cashout_event` | Label used to group cash-out breakdowns. If blank, the engine uses `CASHOUT`. |
| `scenario_code` | `cashout_event` | Optional cash-out scenario label for analysis. |
| `policy_group` | `cashout_event` | Optional cash-out policy group label. |
| `qualification_type` | `qualification_window`, `qualification_status` | Qualification program or rule type. |
| `window_key` | `qualification_window` | Unique ID for the qualification window. |
| `starts_at` | `qualification_window` | Date/time when the qualification window starts. |
| `ends_at` | `qualification_window` | Date/time when the qualification window ends. |
| `threshold_amount` | `qualification_window` | Target amount required for qualification. |
| `threshold_unit` | `qualification_window` | Unit for `threshold_amount`. |
| `status` | `qualification_status` | Qualification status value. |
| `source_window_key` | `qualification_status` | Link back to `qualification_window.window_key`. |
| `metadata` | All | Optional JSON object for source notes, row IDs, or extra details. |

## Full Detail CSV To Monthly Simulation Rows

Full Detail CSV contains source-detail rows. During import, the engine derives monthly simulation rows from those details.

| Source row | Business meaning | What it becomes in monthly simulation |
| --- | --- | --- |
| `member` | The internal person/account used by the simulator. | Provides member identity, group, and join period. |
| `member_alias` | The member's ID in BGC, iBLOOMING, wallet, or another source system. | Improves source traceability. It does not create PC, revenue, or reward by itself. |
| `role_history` | Member status over time, such as affiliate level or CP status. | Sets active member status, tier/status, and active role for each period. |
| `offer` | Product/package definition, including price, PC grant, and SP accrual rule. | Defines the business product. It does not count as monthly activity unless there is a matching event or ledger row. |
| `business_event` | A real business event: join, upgrade, product sale, pool funding, reward accrual, or qualification event. | Feeds recognized revenue, gross margin, sink spend, and activity period depending on event type and metadata. |
| `pc_entry` with `GRANT` or `ADJUSTMENT` | PC was granted or adjusted. | Adds to `pc_volume`. |
| `pc_entry` with `SPEND` | PC/ALPHA was used inside the ecosystem. | Adds to `sink_spend_usd`. If `metadata.sink_spend_usd` is missing, the engine defaults to `amount_pc / 100`. |
| `sp_entry` with `ACCRUAL` or `ADJUSTMENT` | Reward-basis points were created or adjusted. For BGC this usually means SP/LTS. For iBLOOMING this can mean Sales Point. | Adds to `sp_reward_basis`. When the linked source event is iBLOOMING, the derived breakdown uses `IB_SALES_POINT` or `IB_SALES_POINT_ADJUSTMENT`. |
| `reward_obligation` | Reward owed, eligible, or distributed to a member. | Adds compatible USD reward value to `global_reward_usd`, grouped by `reward_source_code`. Cancelled obligations are ignored. |
| `pool_entry` with a recipient and distribution type | Pool distribution to a member. | Adds USD pool distribution value to `pool_reward_usd`. Pool funding rows alone do not become member reward. |
| `cashout_event` with `PAID` | Cash-out actually paid. | Adds to `cashout_usd`. |
| `cashout_event` with `APPROVED` and no matching `PAID` row | Approved cash-out when payment detail is not separated. | Adds to `cashout_usd` so the simulator can still reflect expected payout. |
| `qualification_window` and `qualification_status` | Qualification windows and status history, such as WEC or CPR. | Improves source-detail checks and eligibility evidence. It does not create revenue by itself. |

## Columns With Fixed Choices

Use uppercase values for Full Detail CSV. The importer uppercases many fields, but uppercase keeps the file easier to audit.

| Column | Allowed values | Simple meaning |
| --- | --- | --- |
| `source_system` | `BGC`, `IBLOOMING` | Source business system. The importer also accepts `I-BLOOMING` and `I_BLOOMING` and stores them as `IBLOOMING`. |
| `role_type` | `AFFILIATE_LEVEL`, `CP_STATUS`, `EXECUTIVE_CP_STATUS`, `WEC_STATUS`, `CROSS_APP_STATUS` | Which member status category is being recorded. |
| `offer_type` | `BGC_AFFILIATE_JOIN`, `BGC_AFFILIATE_UPGRADE`, `BGC_PHYSICAL_PRODUCT`, `IB_CP_DIGITAL_PRODUCT`, `IB_GIM_PRODUCT`, `IB_IMATRIX_PRODUCT` | What kind of product, package, or offer produced value. |
| `business_event.event_type` | `AFFILIATE_JOINED`, `AFFILIATE_UPGRADED`, `PHYSICAL_PRODUCT_PURCHASED`, `CP_PRODUCT_SOLD`, `GIM_SIGNUP_COMPLETED`, `IMATRIX_PURCHASE_COMPLETED`, `REWARD_ACCRUED`, `POOL_FUNDED`, `POOL_DISTRIBUTED`, `QUALIFICATION_WINDOW_OPENED`, `QUALIFICATION_ACHIEVED`, `CASHOUT_REQUESTED`, `CASHOUT_APPROVED`, `CASHOUT_PAID` | What happened in the business system. |
| `cashout_event.event_type` | `REQUESTED`, `APPROVED`, `PAID`, `REJECTED` | Status of a cash-out event. Only `PAID` becomes actual cash paid out. |
| `unit` / `threshold_unit` | `USD`, `PC`, `SP`, `COUNT`, `SHARE` | Unit for the amount. |
| `pc_entry.entry_type` | `GRANT`, `SPEND`, `ADJUSTMENT` | PC was granted, spent internally, or adjusted. |
| `sp_entry.entry_type` | `ACCRUAL`, `DISTRIBUTION`, `ADJUSTMENT` | SP was accrued, distributed, or adjusted. |
| `pool_entry.entry_type` | `FUNDING`, `DISTRIBUTION`, `ALLOCATION`, `ADJUSTMENT` | Pool money was funded, distributed, allocated, or adjusted. |
| `reward_source_code` | `BGC_RR`, `BGC_GR`, `BGC_MIRACLE_CASH`, `BGC_GPSP`, `BGC_WEC_POOL`, `IB_LR`, `IB_MIRACLE_CASH`, `IB_CPR`, `IB_GRR`, `IB_IRR`, `IB_GPS`, `IB_GMP`, `IB_GEC` | Named reward family. Keep the code exact so the engine can preserve the business rule identity. |
| `distribution_cycle` | `EVENT_BASED`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `YEARLY`, `ADHOC` | How often the reward or pool is evaluated or distributed. |
| `obligation_status` | `ACCRUED`, `ELIGIBLE`, `DISTRIBUTED`, `CANCELLED` | Current state of the reward obligation. |
| `pool_code` | `BGC_GPSP_MONTHLY_POOL`, `BGC_WEC_QUARTERLY_POOL`, `IB_GPS_SEMIANNUAL_POOL`, `IB_WEC_USER_MONTHLY_POOL`, `IB_GMP_MONTHLY_POOL`, `IB_GEC_INTERNAL_POOL` | Named pool identity. |
| `qualification_type` | `WEC_60_DAY`, `CPR_YEAR_1`, `CPR_YEAR_2`, `EXECUTIVE_CP_APPOINTMENT`, `POOL_RECIPIENT_SNAPSHOT` | Qualification rule being tracked. |
| `qualification_status.status` | `OPEN`, `ELIGIBLE`, `ACHIEVED`, `ACTIVE`, `EXPIRED`, `CANCELLED` | State of the qualification. |

## Web3 And Token Price Terms

These are scenario settings, not snapshot columns. They are included here because snapshot data and Web3 assumptions are often discussed together.

| UI label | Internal value | Meaning |
| --- | --- | --- |
| ALPHA classification: Internal credit | `internal_credit` | ALPHA is an internal accounting credit. This is the safest default for phase 1. |
| ALPHA classification: Points | `points` | ALPHA is described as points, not a transferable token. |
| ALPHA classification: Token off-chain | `off_chain_token` | ALPHA behaves like a token in the platform database, but not on a public chain. |
| ALPHA classification: Future on-chain token | `future_on_chain_token` | ALPHA is planned to become a public/on-chain token later. Requires stronger tokenomics, legal, and implementation review. |
| Price basis: Internal only / no market price | `not_applicable_internal` | No public token price is used. |
| Price basis: Fixed internal rate | `fixed_accounting` | Team sets a fixed internal accounting value, for example `1 ALPHA = $1`. This is an assumption, not a market price. |
| Price basis: Oracle price feed | `oracle_feed` | Price comes from an external price feed. This only makes sense after ALPHA has a reliable market or approved pricing source. |
| Price basis: Liquidity pool price | `liquidity_pool` | Price is derived from pool reserves, such as USDC and ALPHA in a liquidity pool. |
| Price basis: Market forecast | `market_forecast` | Price is an estimated future market price. This is forecast language, not observed data. |

Indonesian note: kalau `ALPHA price ($)` diisi `1`, artinya skenario mengasumsikan 1 ALPHA = 1 USD. Engine bisa membaca angkanya, tetapi engine tidak membuktikan bahwa pasar benar-benar akan menghargai ALPHA sebesar 1 USD. Bukti pasar tetap harus datang dari tokenomics, reserve, liquidity, atau market assumption.

## Recommended Files

- Blank Full Detail CSV template: `examples/full-detail-csv-template.csv`
- CSV column legend: `examples/full-detail-csv-glossary.csv`
- Small all-green example: `examples/sample-source-detail-all-green.csv`
- 24-month BGC + iBLOOMING example: `examples/sample-24m-bgc-iblooming-full-detail.csv`
- Forecast/on-chain example: `examples/forecast-iboomie-alpha-onchain-12m.csv`
