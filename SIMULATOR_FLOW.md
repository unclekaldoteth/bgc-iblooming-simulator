# BGC Alpha Simulator Flow

This document explains the product flow in a short, presentation-friendly way, screen by screen.

## Baseline Simulator Context

Before going into the flow, there are a few core terms worth aligning on:

- `PC` is internal credit tied to BGC physical-product activity.
- Think of `PC` as business/product-side activity value.
- In the baseline simulator: `100 PC = $1`.
- `SP` is internal reward value or reward-right value from the existing reward system.
- Think of `SP` as incentive or entitlement value.
- In the baseline simulator: `1 SP = $1 reward basis`.

The simplest distinction is:

- `PC` is closer to business/product activity
- `SP` is closer to reward rights/incentives

The main parameters people usually discuss are:

- `k_pc` = how much `PC` is converted into ALPHA
- `k_sp` = how much `SP` is converted into ALPHA
- `reward_global_factor` = multiplier for global reward pressure
- `reward_pool_factor` = multiplier for pool-based reward pressure
- `sink_target` = target for how much ALPHA is absorbed into ecosystem use

The easiest mental model is:

- `PC + SP` = source of ALPHA formation
- `k_pc + k_sp` = knobs for how much ALPHA gets issued
- `reward_global_factor + reward_pool_factor` = knobs for reward/liability pressure
- `sink_target` = knob for how much ALPHA gets used inside the ecosystem

## Main Flow

1. **Sign in**  
   The product is an internal web console, so users log in first with internal accounts.  
   Access is role-based, which means founders mainly review and approve, while analysts and product users can create snapshots, scenarios, and runs.

2. **Overview**  
   The `Overview` page is the summary screen. It shows how many snapshots, scenarios, and runs already exist, so the team can quickly see whether data is ready and whether simulations have already been executed.

3. **Load historical data in `Snapshots`**  
   This is where the process starts.  
   The user creates a snapshot by entering:
   - snapshot name
   - source systems
   - file type
   - check method
   - date range
   - CSV upload or file URI
   - record count
   - notes

   The purpose of this page is to register one historical dataset version that will later be used in simulations.
   The file type tells the engine how detailed the uploaded data is:
   - `Monthly CSV`: one row is one member in one month. Fastest for basic simulation.
   - `Full Detail CSV`: one normal CSV with `record_type`. Best for non-technical users who need full source detail.
   - `Full Detail JSON`: same full-detail model as Full Detail CSV, but as JSON.
   - `Full Detail Bundle`: a packaged full-detail data set prepared from multiple source files.
   - `Hybrid Data`: a mix of source-detail rows and monthly aggregate rows.

   The most important rule is simple: **Monthly CSV is easy, but Full Detail CSV is the CSV format that can make the Source Detail checklist complete.**
   Once snapshots accumulate, the team can archive older ones from the default registry view without deleting their historical data.
   Storage cleanup stays below the registry as a secondary maintenance panel, so users read active business data first and cleanup candidates later.

4. **Import the dataset**  
   After the snapshot is created, the user clicks **Import**.
   This sends the file to a background worker, which reads the file row by row.

   Monthly CSV rows are imported directly as **member-month facts**.
   Full Detail CSV and Full Detail JSON rows are imported as detailed source records first, then the engine derives the monthly simulation rows from those details.

   Each row represents one member in one time period, with fields like:
   - `pc_volume`
   - `sp_reward_basis`
   - `global_reward_usd`
   - `pool_reward_usd`
   - `cashout_usd`
   - `sink_spend_usd`
   - `active_member`

   So this step changes raw CSV data into structured data that is ready for simulation.
   For Full Detail CSV, the key column is `record_type`. It tells the engine whether the row is a member, alias, role history, offer, business event, PC entry, SP entry, reward obligation, pool entry, cash-out event, qualification window, or qualification status.

5. **Clean and validate the data**  
   Still in `Snapshots`, the system checks whether the dataset is safe to use.  
   The current UI calls this **Data Check**. It checks:

   - snapshot details such as date range, source systems, and file URI
   - required columns
   - invalid numeric values
   - invalid boolean values
   - duplicate rows
   - source-detail coverage for detailed imports
   - the P0 data fingerprint

   If something is wrong, the screen shows the issue list. If it passes, the snapshot becomes ready to approve.
   A snapshot with `Data Check Missing` should be re-imported before it is used as strong evidence.

6. **Approve the snapshot**  
   Once the dataset is clean, the user clicks **Approve**.  
   This is the gate before simulation. The product does not allow a run unless the snapshot is in `APPROVED` status.  
   So approval means: "this historical dataset is the trusted input for policy testing."

7. **Define policy rules in `Scenarios`**  
   After the data is approved, the user goes to `Scenarios`.  
   Here they create a reusable scenario by choosing:
   - a template: `Baseline`, `Conservative`, `Growth`, or `Stress`
   - a baseline model version
   - an optional default snapshot
   - policy parameters

   The main parameters are:
   - `k_pc`
   - `k_sp`
   - user monthly cap
   - group monthly cap
   - sink target
   - cash-out mode
   - cash-out minimum
   - cash-out fee
   - cash-out windows per year
   - window length
   - sink adoption assumptions
   - ALPHA and Web3 assumptions

   This is the policy design step: users are defining "what ALPHA rules do we want to test?"
   The scenario mode is important:
   - `Imported Data Only` keeps growth forecast locked and uses observed/imported periods.
   - `Add Forecast` unlocks growth assumptions and must be read as an estimate.

   Global reward factor and pool reward factor stay locked to the baseline model. They are visible for context, but changing them would rewrite core reward math and make scenario comparison less reliable.
   Older scenarios can also be archived so the default registry stays focused on active policy candidates.

   The `ALPHA & Web3` section controls language and assumptions for token flow and whitepaper output. It can describe ALPHA as internal credit, points, off-chain token, or future on-chain token. It also stores token price basis, supply model, treasury reserve, liquidity pool, buy demand, sell pressure, burn, vesting unlock, and decision rules.

8. **Run the simulation**  
   When the user clicks **Run**, the app:
   - checks that the scenario exists
   - checks that the snapshot exists and is approved
   - creates a run record
   - generates a seed hash from snapshot + model + parameters
   - sends the run to the worker queue

   This makes the run reproducible and auditable.

9. **Simulation engine processes the run**  
   In the background, the worker loads:
   - the approved historical facts
   - the selected baseline model
   - the scenario parameters

   Then the engine:
   - converts `PC` and `SP` into ALPHA
   - adjusts by member activity
   - applies user and group caps
   - reads actual internal use from `sink_spend_usd`
   - adds modeled internal use only when the scenario includes sink adoption assumptions
   - estimates how much ALPHA is cashed out or held
   - calculates treasury liability and inflow

   This is where the policy rules are applied to real historical behavior.

10. **Review results in `Run Detail`**  
    After processing, the run page shows:
    - run status
    - scenario, snapshot, and model used
    - summary metrics
    - warning flags
    - recommendation status

    The key outputs include:
    - company gross cash in
    - retained revenue
    - net treasury delta
    - actual payout out
    - total ALPHA issued
    - total spent
    - total held
    - payout/inflow ratio
    - reserve runway
    - reward concentration

11. **Manage historical refs in `Result Ref`**
    Completed runs are also collected in the `Result Ref` page.
    This page is used to:
    - browse saved run references
    - pin important refs so they stay easy to find and are protected for future cleanup policy
    - archive older refs from the default view without deleting the underlying outputs

    The current reading order in `Result Ref` puts pinned refs first, then other refs by recency.

12. **Review supporting views**
   From the run page, users can open:
   - `Distribution`: ALPHA behavior, issued-share concentration, phase totals, and source-system split
   - `Token Flow`: opening balance, issued, used, cash-out, held, ending balance, and token price basis
   - `Treasury`: company cashflow lens first, then runway, payout pressure, internal use, and risk flags
   - `Decision Pack`: founder-facing recommendation output with scenario basis, blockers, and export actions

    This is the decision layer, where raw metrics are translated into business meaning.

13. **Decision Pack**
    The system classifies the scenario internally as:
    - `candidate`
    - `risky`
    - `rejected`

    Founder-facing surfaces render those as:
    - `Ready`
    - `Needs Review`
    - `Do Not Use`

    It then generates a decision pack with:
    - policy verdict
    - scenario context
    - evaluated scenario basis
    - blockers or rejection reasons
    - unresolved questions
    - strategic-goal evidence
    - milestone gates
    - full simulation report export options

    This is the artifact intended for founder discussion.

14. **Compare scenarios in `Compare`**
    Finally, the team goes to `Compare`.  
    This page puts selected completed runs side by side so stakeholders can compare scenario shape and business outcome across scenarios.

    The current compare flow is:
    - select 2 to 5 runs
    - use the radar only as a quick scan
    - read business cashflow comparison first
    - then read ALPHA policy comparison, treasury risk, distribution, strategic goals, and milestones

## Short Meeting Version

"First we upload and approve historical data in `Snapshots`. Then we define policy rules in `Scenarios`. After that we run the model, review risk and recommendation in the run pages, and compare completed scenarios side by side before choosing a pilot policy."
