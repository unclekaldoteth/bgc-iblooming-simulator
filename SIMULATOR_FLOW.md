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
   - date range
   - CSV upload or file URI
   - record count
   - notes

   The purpose of this page is to register one historical dataset version that will later be used in simulations.

4. **Import the dataset**  
   After the snapshot is created, the user clicks **Import facts**.  
   This sends the CSV to a background worker, which reads the file row by row and converts it into a standard internal format called a **member-month fact**.

   Each row represents one member in one time period, with fields like:
   - `pc_volume`
   - `sp_reward_basis`
   - `global_reward_usd`
   - `pool_reward_usd`
   - `cashout_usd`
   - `sink_spend_usd`
   - `active_member`

   So this step changes raw CSV data into structured data that is ready for simulation.

5. **Clean and validate the data**  
   Still in `Snapshots`, the system checks whether the dataset is safe to use.  
   There are 2 validation layers:

   - **Metadata validation**  
     It checks date range, record count, source systems, file URI format, and whether the snapshot covers enough history.
   - **CSV/import validation**  
     It checks required columns, invalid numeric values, invalid boolean values, and duplicate rows.

   If something is wrong, the screen shows the issue list. If it passes, the snapshot becomes valid.

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
   - reward global factor
   - reward pool factor
   - user monthly cap
   - group monthly cap
   - sink target
   - cash-out mode
   - cash-out minimum
   - cash-out fee
   - cash-out windows per year
   - window length

   This is the policy design step: users are defining "what ALPHA rules do we want to test?"

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
   - estimates how much ALPHA is spent, cashed out, or held
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

11. **Review supporting views**  
    From the run page, users can open:
    - `Distribution`: ALPHA behavior, issued-share concentration, phase totals, and source-system split
    - `Treasury`: company cashflow lens first, then runway, payout pressure, internal use, and risk flags
    - `Decision Pack`: founder-facing recommendation output with scenario basis, blockers, and export actions

    This is the decision layer, where raw metrics are translated into business meaning.

12. **Decision Pack**  
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

13. **Compare scenarios in `Compare`**  
    Finally, the team goes to `Compare`.  
    This page puts selected completed runs side by side so stakeholders can compare scenario shape and business outcome across scenarios.

    The current compare flow is:
    - select 2 to 5 runs
    - use the radar only as a quick scan
    - read business cashflow comparison first
    - then read ALPHA policy comparison, treasury risk, distribution, strategic goals, and milestones

## Short Meeting Version

"First we upload and approve historical data in `Snapshots`. Then we define policy rules in `Scenarios`. After that we run the model, review risk and recommendation in the run pages, and compare completed scenarios side by side before choosing a pilot policy."
