import {
  modelV1,
  type BaselineCashoutMode,
  type BaselineModelRuleset,
  type RecommendationThresholds,
  type StrategicKpiAssumptions
} from "./versions/model-v1";

const models = {
  "model-v1": modelV1
} as const;

type BaselineModelVersion = keyof typeof models;

type BaselineModelOverrides = Partial<BaselineModelRuleset> & {
  defaults?: Partial<BaselineModelRuleset["defaults"]>;
  conversionRules?: Partial<BaselineModelRuleset["conversionRules"]>;
  rewardRules?: Partial<BaselineModelRuleset["rewardRules"]>;
  capRules?: Partial<BaselineModelRuleset["capRules"]>;
  sinkRules?: Partial<BaselineModelRuleset["sinkRules"]>;
  cashoutRules?: Partial<BaselineModelRuleset["cashoutRules"]>;
  treasuryRules?: Partial<BaselineModelRuleset["treasuryRules"]>;
  recommendationThresholds?: Partial<RecommendationThresholds>;
  strategicKpiAssumptions?: Partial<StrategicKpiAssumptions> & {
    score_thresholds?: Partial<StrategicKpiAssumptions["score_thresholds"]>;
    revenue?: Partial<StrategicKpiAssumptions["revenue"]>;
    ops_cost?: Partial<StrategicKpiAssumptions["ops_cost"]>;
    tax?: Partial<StrategicKpiAssumptions["tax"]>;
    affiliate?: Partial<StrategicKpiAssumptions["affiliate"]>;
    active_user?: Partial<StrategicKpiAssumptions["active_user"]>;
  };
};

type StrategicScoreThresholdOverrides = Partial<StrategicKpiAssumptions["score_thresholds"]>;
type StrategicRevenueOverrides = Partial<StrategicKpiAssumptions["revenue"]>;
type StrategicOpsCostOverrides = Partial<StrategicKpiAssumptions["ops_cost"]>;
type StrategicTaxOverrides = Partial<StrategicKpiAssumptions["tax"]>;
type StrategicAffiliateOverrides = Partial<StrategicKpiAssumptions["affiliate"]>;
type StrategicActiveUserOverrides = Partial<StrategicKpiAssumptions["active_user"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readCashoutMode(value: unknown, fallback: BaselineCashoutMode): BaselineCashoutMode {
  return value === "ALWAYS_OPEN" || value === "WINDOWS" ? value : fallback;
}

export function getBaselineModelByVersion(version?: string): BaselineModelRuleset {
  return models[(version ?? "model-v1") as BaselineModelVersion] ?? modelV1;
}

export function resolveBaselineModelRuleset(
  rawRuleset: unknown,
  version?: string
): BaselineModelRuleset {
  const base = getBaselineModelByVersion(version);

  if (!isRecord(rawRuleset)) {
    return base;
  }

  const ruleset = rawRuleset as BaselineModelOverrides;
  const defaults = (isRecord(ruleset.defaults) ? ruleset.defaults : {}) as Partial<
    BaselineModelRuleset["defaults"]
  >;
  const conversionRules = (isRecord(ruleset.conversionRules) ? ruleset.conversionRules : {}) as Partial<
    BaselineModelRuleset["conversionRules"]
  >;
  const rewardRules = (isRecord(ruleset.rewardRules) ? ruleset.rewardRules : {}) as Partial<
    BaselineModelRuleset["rewardRules"]
  >;
  const capRules = (isRecord(ruleset.capRules) ? ruleset.capRules : {}) as Partial<
    BaselineModelRuleset["capRules"]
  >;
  const sinkRules = (isRecord(ruleset.sinkRules) ? ruleset.sinkRules : {}) as Partial<
    BaselineModelRuleset["sinkRules"]
  >;
  const cashoutRules = (isRecord(ruleset.cashoutRules) ? ruleset.cashoutRules : {}) as Partial<
    BaselineModelRuleset["cashoutRules"]
  >;
  const treasuryRules = (isRecord(ruleset.treasuryRules) ? ruleset.treasuryRules : {}) as Partial<
    BaselineModelRuleset["treasuryRules"]
  >;
  const recommendationThresholds = isRecord(ruleset.recommendationThresholds)
    ? (ruleset.recommendationThresholds as Partial<RecommendationThresholds>)
    : {};
  const strategicKpiAssumptions: BaselineModelOverrides["strategicKpiAssumptions"] | undefined =
    isRecord(ruleset.strategicKpiAssumptions)
      ? (ruleset.strategicKpiAssumptions as BaselineModelOverrides["strategicKpiAssumptions"])
      : undefined;
  const scoreThresholds: StrategicScoreThresholdOverrides = isRecord(
    strategicKpiAssumptions?.score_thresholds
  )
    ? (strategicKpiAssumptions.score_thresholds as StrategicScoreThresholdOverrides)
    : {};
  const revenueAssumptions: StrategicRevenueOverrides = isRecord(strategicKpiAssumptions?.revenue)
    ? (strategicKpiAssumptions.revenue as StrategicRevenueOverrides)
    : {};
  const opsCostAssumptions: StrategicOpsCostOverrides = isRecord(strategicKpiAssumptions?.ops_cost)
    ? (strategicKpiAssumptions.ops_cost as StrategicOpsCostOverrides)
    : {};
  const taxAssumptions: StrategicTaxOverrides = isRecord(strategicKpiAssumptions?.tax)
    ? (strategicKpiAssumptions.tax as StrategicTaxOverrides)
    : {};
  const affiliateAssumptions: StrategicAffiliateOverrides = isRecord(
    strategicKpiAssumptions?.affiliate
  )
    ? (strategicKpiAssumptions.affiliate as StrategicAffiliateOverrides)
    : {};
  const activeUserAssumptions: StrategicActiveUserOverrides = isRecord(
    strategicKpiAssumptions?.active_user
  )
    ? (strategicKpiAssumptions.active_user as StrategicActiveUserOverrides)
    : {};

  return {
    version: readString(ruleset.version, base.version),
    summary: readString(ruleset.summary, base.summary),
    lockedAssumptions: readStringArray(ruleset.lockedAssumptions, base.lockedAssumptions),
    openQuestions: readStringArray(ruleset.openQuestions, base.openQuestions),
    defaults: {
      k_pc: readNumber(defaults.k_pc, base.defaults.k_pc),
      k_sp: readNumber(defaults.k_sp, base.defaults.k_sp),
      reward_global_factor: readNumber(
        defaults.reward_global_factor,
        base.defaults.reward_global_factor
      ),
      reward_pool_factor: readNumber(defaults.reward_pool_factor, base.defaults.reward_pool_factor),
      cap_user_monthly: readNumber(defaults.cap_user_monthly, base.defaults.cap_user_monthly),
      cap_group_monthly: readNumber(defaults.cap_group_monthly, base.defaults.cap_group_monthly),
      sink_target: readNumber(defaults.sink_target, base.defaults.sink_target),
      cashout_mode: readCashoutMode(defaults.cashout_mode, base.defaults.cashout_mode),
      cashout_min_usd: readNumber(defaults.cashout_min_usd, base.defaults.cashout_min_usd),
      cashout_fee_bps: readNumber(defaults.cashout_fee_bps, base.defaults.cashout_fee_bps),
      cashout_windows_per_year: readNumber(
        defaults.cashout_windows_per_year,
        base.defaults.cashout_windows_per_year
      ),
      cashout_window_days: readNumber(
        defaults.cashout_window_days,
        base.defaults.cashout_window_days
      )
    },
    conversionRules: {
      pc_units_per_alpha: readNumber(
        conversionRules.pc_units_per_alpha,
        base.conversionRules.pc_units_per_alpha
      ),
      sp_units_per_alpha: readNumber(
        conversionRules.sp_units_per_alpha,
        base.conversionRules.sp_units_per_alpha
      ),
      pc_alpha_weight: readNumber(
        conversionRules.pc_alpha_weight,
        base.conversionRules.pc_alpha_weight
      ),
      sp_alpha_weight: readNumber(
        conversionRules.sp_alpha_weight,
        base.conversionRules.sp_alpha_weight
      ),
      active_member_multiplier: readNumber(
        conversionRules.active_member_multiplier,
        base.conversionRules.active_member_multiplier
      ),
      inactive_member_multiplier: readNumber(
        conversionRules.inactive_member_multiplier,
        base.conversionRules.inactive_member_multiplier
      )
    },
    rewardRules: {
      global_reward_weight: readNumber(
        rewardRules.global_reward_weight,
        base.rewardRules.global_reward_weight
      ),
      pool_reward_weight: readNumber(
        rewardRules.pool_reward_weight,
        base.rewardRules.pool_reward_weight
      )
    },
    capRules: {
      minimum_user_monthly_cap: readNumber(
        capRules.minimum_user_monthly_cap,
        base.capRules.minimum_user_monthly_cap
      ),
      minimum_group_monthly_cap: readNumber(
        capRules.minimum_group_monthly_cap,
        base.capRules.minimum_group_monthly_cap
      )
    },
    sinkRules: {
      baseline_sink_target: readNumber(
        sinkRules.baseline_sink_target,
        base.sinkRules.baseline_sink_target
      ),
      spend_release_factor: readNumber(
        sinkRules.spend_release_factor,
        base.sinkRules.spend_release_factor
      ),
      max_spend_share: readNumber(sinkRules.max_spend_share, base.sinkRules.max_spend_share)
    },
    cashoutRules: {
      always_open_release_factor: readNumber(
        cashoutRules.always_open_release_factor,
        base.cashoutRules.always_open_release_factor
      ),
      windowed_release_factor: readNumber(
        cashoutRules.windowed_release_factor,
        base.cashoutRules.windowed_release_factor
      ),
      min_window_coverage_ratio: readNumber(
        cashoutRules.min_window_coverage_ratio,
        base.cashoutRules.min_window_coverage_ratio
      ),
      fee_retention_factor: readNumber(
        cashoutRules.fee_retention_factor,
        base.cashoutRules.fee_retention_factor
      )
    },
    treasuryRules: {
      reserve_buffer_months: readNumber(
        treasuryRules.reserve_buffer_months,
        base.treasuryRules.reserve_buffer_months
      ),
      inflow_capture_rate: readNumber(
        treasuryRules.inflow_capture_rate,
        base.treasuryRules.inflow_capture_rate
      )
    },
    recommendationThresholds: {
      payout_inflow_warning: readNumber(
        recommendationThresholds.payout_inflow_warning,
        base.recommendationThresholds.payout_inflow_warning
      ),
      payout_inflow_critical: readNumber(
        recommendationThresholds.payout_inflow_critical,
        base.recommendationThresholds.payout_inflow_critical
      ),
      reserve_runway_warning: readNumber(
        recommendationThresholds.reserve_runway_warning,
        base.recommendationThresholds.reserve_runway_warning
      ),
      reserve_runway_critical: readNumber(
        recommendationThresholds.reserve_runway_critical,
        base.recommendationThresholds.reserve_runway_critical
      ),
      reward_concentration_warning: readNumber(
        recommendationThresholds.reward_concentration_warning,
        base.recommendationThresholds.reward_concentration_warning
      ),
      reward_concentration_critical: readNumber(
        recommendationThresholds.reward_concentration_critical,
        base.recommendationThresholds.reward_concentration_critical
      )
    },
    strategicKpiAssumptions: {
      score_thresholds: {
        candidate: readNumber(
          scoreThresholds?.candidate,
          base.strategicKpiAssumptions.score_thresholds.candidate
        ),
        risky: readNumber(scoreThresholds?.risky, base.strategicKpiAssumptions.score_thresholds.risky)
      },
      revenue: {
        recognized_revenue_inflow_weight: readNumber(
          revenueAssumptions?.recognized_revenue_inflow_weight,
          base.strategicKpiAssumptions.revenue.recognized_revenue_inflow_weight
        ),
        gross_margin_inflow_weight: readNumber(
          revenueAssumptions?.gross_margin_inflow_weight,
          base.strategicKpiAssumptions.revenue.gross_margin_inflow_weight
        ),
        proxy_revenue_capture_rate: readNumber(
          revenueAssumptions?.proxy_revenue_capture_rate,
          base.strategicKpiAssumptions.revenue.proxy_revenue_capture_rate
        ),
        target_revenue_per_active_member: readNumber(
          revenueAssumptions?.target_revenue_per_active_member,
          base.strategicKpiAssumptions.revenue.target_revenue_per_active_member
        ),
        target_cross_app_share_pct: readNumber(
          revenueAssumptions?.target_cross_app_share_pct,
          base.strategicKpiAssumptions.revenue.target_cross_app_share_pct
        )
      },
      ops_cost: {
        automation_coverage_score: readNumber(
          opsCostAssumptions?.automation_coverage_score,
          base.strategicKpiAssumptions.ops_cost.automation_coverage_score
        ),
        target_cost_to_serve_index: readNumber(
          opsCostAssumptions?.target_cost_to_serve_index,
          base.strategicKpiAssumptions.ops_cost.target_cost_to_serve_index
        ),
        cashout_ops_penalty_weight: readNumber(
          opsCostAssumptions?.cashout_ops_penalty_weight,
          base.strategicKpiAssumptions.ops_cost.cashout_ops_penalty_weight
        )
      },
      tax: {
        legal_readiness_score: readNumber(
          taxAssumptions?.legal_readiness_score,
          base.strategicKpiAssumptions.tax.legal_readiness_score
        ),
        compliance_structure_score: readNumber(
          taxAssumptions?.compliance_structure_score,
          base.strategicKpiAssumptions.tax.compliance_structure_score
        ),
        target_tax_event_reduction_pct: readNumber(
          taxAssumptions?.target_tax_event_reduction_pct,
          base.strategicKpiAssumptions.tax.target_tax_event_reduction_pct
        )
      },
      affiliate: {
        affiliate_member_multiplier: readNumber(
          affiliateAssumptions?.affiliate_member_multiplier,
          base.strategicKpiAssumptions.affiliate.affiliate_member_multiplier
        ),
        target_activation_rate_pct: readNumber(
          affiliateAssumptions?.target_activation_rate_pct,
          base.strategicKpiAssumptions.affiliate.target_activation_rate_pct
        ),
        target_retention_rate_pct: readNumber(
          affiliateAssumptions?.target_retention_rate_pct,
          base.strategicKpiAssumptions.affiliate.target_retention_rate_pct
        ),
        target_productivity_share_pct: readNumber(
          affiliateAssumptions?.target_productivity_share_pct,
          base.strategicKpiAssumptions.affiliate.target_productivity_share_pct
        )
      },
      active_user: {
        new_member_multiplier: readNumber(
          activeUserAssumptions?.new_member_multiplier,
          base.strategicKpiAssumptions.active_user.new_member_multiplier
        ),
        reactivated_member_multiplier: readNumber(
          activeUserAssumptions?.reactivated_member_multiplier,
          base.strategicKpiAssumptions.active_user.reactivated_member_multiplier
        ),
        cross_app_active_multiplier: readNumber(
          activeUserAssumptions?.cross_app_active_multiplier,
          base.strategicKpiAssumptions.active_user.cross_app_active_multiplier
        ),
        target_retention_rate_pct: readNumber(
          activeUserAssumptions?.target_retention_rate_pct,
          base.strategicKpiAssumptions.active_user.target_retention_rate_pct
        ),
        target_cross_app_share_pct: readNumber(
          activeUserAssumptions?.target_cross_app_share_pct,
          base.strategicKpiAssumptions.active_user.target_cross_app_share_pct
        )
      }
    }
  };
}

export function getBaselineScenarioDefaults(model: BaselineModelRuleset) {
  return {
    scenario_mode: "founder_safe",
    k_pc: model.defaults.k_pc,
    k_sp: model.defaults.k_sp,
    reward_global_factor: model.defaults.reward_global_factor,
    reward_pool_factor: model.defaults.reward_pool_factor,
    cap_user_monthly: String(model.defaults.cap_user_monthly),
    cap_group_monthly: String(model.defaults.cap_group_monthly),
    sink_target: model.defaults.sink_target,
    cashout_mode: model.defaults.cashout_mode,
    cashout_min_usd: model.defaults.cashout_min_usd,
    cashout_fee_bps: model.defaults.cashout_fee_bps,
    cashout_windows_per_year: model.defaults.cashout_windows_per_year,
    cashout_window_days: model.defaults.cashout_window_days,
    cohort_assumptions: {
      new_members_per_month: 0,
      monthly_churn_rate_pct: 0,
      monthly_reactivation_rate_pct: 0,
      affiliate_new_member_share_pct: 0,
      cross_app_adoption_rate_pct: 0,
      new_member_value_factor: 0.6,
      reactivated_member_value_factor: 0.7
    },
    sink_adoption_model: {
      sink_adoption_rate_pct: 0,
      eligible_member_share_pct: 0,
      avg_sink_ticket_usd: 0,
      sink_frequency_per_month: 0,
      alpha_payment_share_pct: 100,
      sink_growth_rate_pct: 0
    },
    projection_horizon_months: null,
    milestone_schedule: [],
    alpha_token_policy: {
      classification: "internal_credit",
      phase: "phase_1_internal",
      transferability: "non_transferable",
      settlement_unit: "alpha_internal",
      on_chain_status: "not_on_chain",
      evidence_standard: "simulation_backed"
    },
    forecast_policy: {
      mode: "snapshot_window",
      actuals_through_period: null,
      forecast_start_period: null,
      forecast_basis: "none",
      stress_case: "none"
    },
    web3_tokenomics: {
      network_status: "not_applicable_internal",
      supply_model: "not_applicable_internal",
      max_supply: null,
      allocation: {
        community_pct: null,
        treasury_pct: null,
        team_pct: null,
        investor_pct: null,
        liquidity_pct: null
      },
      vesting: {
        team_cliff_months: null,
        team_vesting_months: null,
        investor_cliff_months: null,
        investor_vesting_months: null
      },
      liquidity: {
        enabled: false,
        reserve_pct: null,
        launch_pool_usd: null
      },
      governance: {
        mode: "founder_admin",
        voting_token_enabled: false
      },
      smart_contract: {
        chain: null,
        standard: null,
        audit_status: "not_started"
      },
      legal: {
        classification: "unreviewed",
        kyc_required: null,
        jurisdiction_notes: null
      }
    }
  } as const;
}

export type { BaselineCashoutMode, BaselineModelRuleset, BaselineModelVersion, RecommendationThresholds };
export { modelV1 };
