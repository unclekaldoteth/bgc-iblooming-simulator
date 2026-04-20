import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFounderScenarioGuardrails,
  evaluateFounderScenarioGuardrails,
  founderSafePassiveCohortAssumptions,
  parseFounderSafeScenarioParameters,
  scenarioParametersSchema
} from "./scenario";

test("founder-safe scenario passes without guardrail errors", () => {
  const parameters = scenarioParametersSchema.parse({
    k_pc: 1,
    k_sp: 1,
    reward_global_factor: 1,
    reward_pool_factor: 1,
    cap_user_monthly: "2500",
    cap_group_monthly: "25000",
    sink_target: 0.3,
    cashout_mode: "WINDOWS",
    cashout_min_usd: 25,
    cashout_fee_bps: 150,
    cashout_windows_per_year: 4,
    cashout_window_days: 7,
    cohort_assumptions: founderSafePassiveCohortAssumptions,
    projection_horizon_months: null,
    milestone_schedule: []
  });
  const issues = evaluateFounderScenarioGuardrails(parameters);

  assert.equal(issues.filter((issue) => issue.severity === "ERROR").length, 0);
  assert.equal(issues.filter((issue) => issue.severity === "WARNING").length, 0);
});

test("founder-safe guardrails reject generic reward factors and cohort projections", () => {
  const parameters = scenarioParametersSchema.parse({
    k_pc: 1,
    k_sp: 1,
    reward_global_factor: 1.2,
    reward_pool_factor: 0.8,
    cap_user_monthly: "2500",
    cap_group_monthly: "25000",
    sink_target: 0.3,
    cashout_mode: "WINDOWS",
    cashout_min_usd: 25,
    cashout_fee_bps: 150,
    cashout_windows_per_year: 4,
    cashout_window_days: 7,
    cohort_assumptions: {
      ...founderSafePassiveCohortAssumptions,
      new_members_per_month: 2
    },
    projection_horizon_months: null,
    milestone_schedule: []
  });
  const issues = evaluateFounderScenarioGuardrails(parameters);
  const messages = issues
    .filter((issue) => issue.severity === "ERROR")
    .map((issue) => issue.message);

  assert.ok(messages.some((message) => message.includes("reward_global_factor is locked")));
  assert.ok(messages.some((message) => message.includes("reward_pool_factor is locked")));
  assert.ok(messages.some((message) => message.includes("cohort_assumptions must remain disabled")));
});

test("applying founder-safe guardrails resets locked parameters", () => {
  const parameters = scenarioParametersSchema.parse({
    k_pc: 1,
    k_sp: 1,
    reward_global_factor: 1.2,
    reward_pool_factor: 0.8,
    cap_user_monthly: "2500",
    cap_group_monthly: "25000",
    sink_target: 0.3,
    cashout_mode: "WINDOWS",
    cashout_min_usd: 25,
    cashout_fee_bps: 150,
    cashout_windows_per_year: 4,
    cashout_window_days: 7,
    cohort_assumptions: {
      ...founderSafePassiveCohortAssumptions,
      new_members_per_month: 2
    },
    projection_horizon_months: null,
    milestone_schedule: []
  });
  const sanitized = applyFounderScenarioGuardrails(parameters, {
    reward_global_factor: 1,
    reward_pool_factor: 1
  });

  assert.equal(sanitized.reward_global_factor, 1);
  assert.equal(sanitized.reward_pool_factor, 1);
  assert.deepEqual(sanitized.cohort_assumptions, founderSafePassiveCohortAssumptions);
});

test("milestone overrides cannot re-enable locked parameters", () => {
  assert.throws(() =>
    scenarioParametersSchema.parse({
      k_pc: 1,
      k_sp: 1,
      reward_global_factor: 1,
      reward_pool_factor: 1,
      cap_user_monthly: "2500",
      cap_group_monthly: "25000",
      sink_target: 0.3,
      cashout_mode: "WINDOWS",
      cashout_min_usd: 25,
      cashout_fee_bps: 150,
      cashout_windows_per_year: 4,
      cashout_window_days: 7,
      cohort_assumptions: founderSafePassiveCohortAssumptions,
      projection_horizon_months: null,
      milestone_schedule: [
        {
          milestone_key: "m1",
          label: "M1",
          start_month: 1,
          parameter_overrides: {
            reward_global_factor: 1.1
          }
        }
      ]
    })
  );
});

test("legacy scenario payloads are sanitized into founder-safe parameters", () => {
  const parsed = parseFounderSafeScenarioParameters({
    k_pc: 1,
    k_sp: 1,
    reward_global_factor: 1.3,
    reward_pool_factor: 0.7,
    cap_user_monthly: "2500",
    cap_group_monthly: "25000",
    sink_target: 0.3,
    cashout_mode: "WINDOWS",
    cashout_min_usd: 25,
    cashout_fee_bps: 150,
    cashout_windows_per_year: 4,
    cashout_window_days: 7,
    cohort_assumptions: {
      ...founderSafePassiveCohortAssumptions,
      new_members_per_month: 3
    },
    projection_horizon_months: 12,
    milestone_schedule: [
      {
        milestone_key: "m1",
        label: "Legacy milestone",
        start_month: 1,
        parameter_overrides: {
          k_pc: 1.1,
          reward_global_factor: 1.2,
          reward_pool_factor: 0.8,
          cohort_assumptions: {
            new_members_per_month: 2
          }
        }
      }
    ]
  }, {
    reward_global_factor: 1,
    reward_pool_factor: 1
  });

  assert.equal(parsed.reward_global_factor, 1);
  assert.equal(parsed.reward_pool_factor, 1);
  assert.deepEqual(parsed.cohort_assumptions, founderSafePassiveCohortAssumptions);
  assert.equal(parsed.milestone_schedule[0]?.parameter_overrides.k_pc, 1.1);
  assert.equal(
    typeof parsed.milestone_schedule[0]?.parameter_overrides.reward_global_factor,
    "undefined"
  );
  assert.equal(
    typeof parsed.milestone_schedule[0]?.parameter_overrides.reward_pool_factor,
    "undefined"
  );
  assert.equal(
    typeof parsed.milestone_schedule[0]?.parameter_overrides.cohort_assumptions,
    "undefined"
  );
});
