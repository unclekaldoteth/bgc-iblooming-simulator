import assert from "node:assert/strict";
import test from "node:test";

import { scenarioCohortAssumptionsSchema } from "@bgc-alpha/schemas";

import { simulateScenario } from "./index";
import type { DatasetSimulationInput, SimulationBaselineModel } from "./engine/run-simulation";

const baselineModel: SimulationBaselineModel = {
  version: "test-model",
  defaults: {
    reward_global_factor: 1,
    reward_pool_factor: 1,
    cap_user_monthly: 2500,
    cap_group_monthly: 25000,
    sink_target: 0.3,
    cashout_mode: "WINDOWS",
    cashout_min_usd: 25,
    cashout_fee_bps: 150,
    cashout_windows_per_year: 4,
    cashout_window_days: 7
  },
  conversionRules: {
    pc_units_per_alpha: 100,
    sp_units_per_alpha: 10,
    pc_alpha_weight: 1,
    sp_alpha_weight: 1,
    active_member_multiplier: 1,
    inactive_member_multiplier: 0.7
  },
  rewardRules: {
    global_reward_weight: 1,
    pool_reward_weight: 1
  },
  capRules: {
    minimum_user_monthly_cap: 50,
    minimum_group_monthly_cap: 250
  },
  sinkRules: {
    baseline_sink_target: 0.3,
    spend_release_factor: 1,
    max_spend_share: 0.95
  },
  cashoutRules: {
    always_open_release_factor: 1,
    windowed_release_factor: 0.72,
    min_window_coverage_ratio: 0.35,
    fee_retention_factor: 1
  },
  treasuryRules: {
    reserve_buffer_months: 9,
    inflow_capture_rate: 0.85
  },
  recommendationThresholds: {
    payout_inflow_warning: 1,
    payout_inflow_critical: 1.15,
    reserve_runway_warning: 6,
    reserve_runway_critical: 3,
    reward_concentration_warning: 55,
    reward_concentration_critical: 70
  },
  strategicKpiAssumptions: {
    score_thresholds: {
      candidate: 70,
      risky: 45
    },
    revenue: {
      recognized_revenue_inflow_weight: 0.12,
      gross_margin_inflow_weight: 0.18,
      proxy_revenue_capture_rate: 0.8,
      target_revenue_per_active_member: 60,
      target_cross_app_share_pct: 35
    },
    ops_cost: {
      automation_coverage_score: 35,
      target_cost_to_serve_index: 65,
      cashout_ops_penalty_weight: 0.6
    },
    tax: {
      legal_readiness_score: 25,
      compliance_structure_score: 35,
      target_tax_event_reduction_pct: 70
    },
    affiliate: {
      affiliate_member_multiplier: 1.04,
      target_activation_rate_pct: 70,
      target_retention_rate_pct: 55,
      target_productivity_share_pct: 30
    },
    active_user: {
      new_member_multiplier: 1.05,
      reactivated_member_multiplier: 1.03,
      cross_app_active_multiplier: 1.02,
      target_retention_rate_pct: 60,
      target_cross_app_share_pct: 30
    }
  }
};

function createInput(
  facts: DatasetSimulationInput["facts"],
  poolPeriodFacts: DatasetSimulationInput["poolPeriodFacts"] = []
): DatasetSimulationInput {
  return {
    request: {
      snapshotId: "snapshot-1",
      baselineModelVersionId: baselineModel.version,
      scenario: {
        name: "Test Scenario",
        template: "Baseline",
        parameters: {
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
          cohort_assumptions: scenarioCohortAssumptionsSchema.parse({}),
          projection_horizon_months: null,
          milestone_schedule: []
        }
      }
    },
    facts,
    poolPeriodFacts,
    baselineModel
  };
}

test("treasury metrics follow recognized revenue and faithful reward distributions", () => {
  const result = simulateScenario(
    createInput([
      {
        periodKey: "2025-01",
        memberKey: "AFF-1",
        sourceSystem: "bgc",
        pcVolume: 10000,
        spRewardBasis: 0,
        globalRewardUsd: 20,
        poolRewardUsd: 10,
        cashoutUsd: 50,
        sinkSpendUsd: 40,
        activeMember: true,
        recognizedRevenueUsd: 100,
        grossCashInUsd: 100,
        retainedRevenueUsd: 100
      }
    ])
  );

  assert.equal(result.summary_metrics.alpha_issued_total, 100);
  assert.equal(result.summary_metrics.alpha_spent_total, 40);
  assert.equal(result.summary_metrics.alpha_cashout_equivalent_total, 35.46);
  assert.equal(result.summary_metrics.alpha_held_total, 24.54);
  assert.equal(result.summary_metrics.company_gross_cash_in_total, 100);
  assert.equal(result.summary_metrics.company_retained_revenue_total, 100);
  assert.equal(result.summary_metrics.company_direct_reward_obligation_total, 20);
  assert.equal(result.summary_metrics.company_pool_funding_obligation_total, 0);
  assert.equal(result.summary_metrics.company_actual_payout_out_total, 35.46);
  assert.equal(result.summary_metrics.company_net_treasury_delta_total, 64.54);
  assert.equal(result.summary_metrics.payout_inflow_ratio, 0.65);
  assert.equal(result.summary_metrics.sink_utilization_rate, 40);

  const revenueObjective = result.strategic_objectives.find(
    (objective) => objective.objective_key === "revenue"
  );
  assert.equal(revenueObjective?.primary_metrics[0]?.unit, "usd");
});

test("cashflow lens separates gross cash, retained revenue, partner payouts, pool funding, and fulfillment", () => {
  const result = simulateScenario(
    createInput(
      [
        {
          periodKey: "2025-01",
          memberKey: "AFF-1",
          sourceSystem: "bgc",
          pcVolume: 10000,
          spRewardBasis: 0,
          globalRewardUsd: 20,
          poolRewardUsd: 0,
          cashoutUsd: 50,
          sinkSpendUsd: 40,
          activeMember: true,
          recognizedRevenueUsd: 100,
          grossCashInUsd: 100,
          retainedRevenueUsd: 100,
          productFulfillmentOutUsd: 15
        },
        {
          periodKey: "2025-01",
          memberKey: "CP-1",
          sourceSystem: "iblooming",
          pcVolume: 0,
          spRewardBasis: 0,
          globalRewardUsd: 5,
          poolRewardUsd: 0,
          cashoutUsd: 0,
          sinkSpendUsd: 100,
          activeMember: true,
          recognizedRevenueUsd: 30,
          grossCashInUsd: 100,
          retainedRevenueUsd: 30,
          partnerPayoutOutUsd: 70
        }
      ],
      [
        {
          periodKey: "2025-01",
          poolCode: "IB_GMP_MONTHLY_POOL",
          distributionCycle: "MONTHLY",
          unit: "USD",
          fundingAmount: 12,
          distributionAmount: 12,
          recipientCount: 1,
          shareCountTotal: 1
        }
      ]
    )
  );

  assert.equal(result.summary_metrics.company_gross_cash_in_total, 200);
  assert.equal(result.summary_metrics.company_retained_revenue_total, 130);
  assert.equal(result.summary_metrics.company_partner_payout_out_total, 70);
  assert.equal(result.summary_metrics.company_direct_reward_obligation_total, 25);
  assert.equal(result.summary_metrics.company_pool_funding_obligation_total, 12);
  assert.equal(result.summary_metrics.company_actual_payout_out_total, 35.46);
  assert.equal(result.summary_metrics.company_product_fulfillment_out_total, 15);
  assert.equal(result.summary_metrics.company_net_treasury_delta_total, 9.54);
});

test("zero inflow no longer suppresses payout pressure", () => {
  const result = simulateScenario(
    createInput([
      {
        periodKey: "2025-01",
        memberKey: "AFF-2",
        sourceSystem: "bgc",
        pcVolume: 10000,
        spRewardBasis: 0,
        globalRewardUsd: 30,
        poolRewardUsd: 0,
        cashoutUsd: 0,
        sinkSpendUsd: 0,
        activeMember: true,
        recognizedRevenueUsd: 0,
        retainedRevenueUsd: 0
      }
    ])
  );

  assert.equal(result.summary_metrics.payout_inflow_ratio, 30);
  assert.equal(result.summary_metrics.reserve_runway_months, 0);
  assert.ok(
    result.flags.some((flag) => flag.flag_type === "payout_pressure_exceeds_inflow")
  );
  assert.ok(result.strategic_objectives.length > 0);
  assert.ok(
    result.strategic_objectives.every((objective) => objective.status !== "candidate")
  );
  assert.ok(
    result.strategic_objectives.every((objective) =>
      objective.reasons[0]?.startsWith("Cashflow gate:")
    )
  );
});
