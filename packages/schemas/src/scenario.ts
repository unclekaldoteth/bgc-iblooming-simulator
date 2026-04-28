import { z } from "zod";

export const scenarioTemplateSchema = z.enum([
  "Baseline",
  "Conservative",
  "Growth",
  "Stress"
]);

export const scenarioModeSchema = z.enum([
  "founder_safe",
  "advanced_forecast"
]);

export const scenarioCohortAssumptionsSchema = z.object({
  new_members_per_month: z.number().int().min(0).optional().default(0),
  monthly_churn_rate_pct: z.number().min(0).max(100).optional().default(0),
  monthly_reactivation_rate_pct: z.number().min(0).max(100).optional().default(0),
  affiliate_new_member_share_pct: z.number().min(0).max(100).optional().default(0),
  cross_app_adoption_rate_pct: z.number().min(0).max(100).optional().default(0),
  new_member_value_factor: z.number().min(0).max(10).optional().default(0.6),
  reactivated_member_value_factor: z.number().min(0).max(10).optional().default(0.7)
});

export const founderSafePassiveCohortAssumptions = Object.freeze(
  scenarioCohortAssumptionsSchema.parse({})
);

export const alphaTokenPolicySchema = z.object({
  classification: z
    .enum(["internal_credit", "points", "off_chain_token", "future_on_chain_token"])
    .optional()
    .default("internal_credit"),
  phase: z
    .enum(["phase_1_internal", "phase_2_bridge", "phase_3_on_chain"])
    .optional()
    .default("phase_1_internal"),
  transferability: z
    .enum(["non_transferable", "platform_limited", "externally_transferable"])
    .optional()
    .default("non_transferable"),
  settlement_unit: z
    .enum(["alpha_internal", "usd_equivalent", "on_chain_token"])
    .optional()
    .default("alpha_internal"),
  on_chain_status: z
    .enum(["not_on_chain", "planned", "testnet", "mainnet"])
    .optional()
    .default("not_on_chain"),
  evidence_standard: z
    .enum(["simulation_backed", "founder_decision_required", "legal_review_required"])
    .optional()
    .default("simulation_backed")
});

export const founderSafeAlphaTokenPolicy = Object.freeze(alphaTokenPolicySchema.parse({}));

export const forecastPolicySchema = z.object({
  mode: z
    .enum(["snapshot_window", "projection_overlay", "cohort_projection"])
    .optional()
    .default("snapshot_window"),
  actuals_through_period: z.string().min(7).nullable().optional().default(null),
  forecast_start_period: z.string().min(7).nullable().optional().default(null),
  forecast_basis: z
    .enum(["none", "repeat_snapshot", "milestone_overlay", "cohort_assumption"])
    .optional()
    .default("none"),
  stress_case: z.enum(["none", "base", "downside", "upside"]).optional().default("none")
});

export const founderSafeForecastPolicy = Object.freeze(forecastPolicySchema.parse({}));

export const sinkAdoptionModelSchema = z.object({
  sink_adoption_rate_pct: z.number().min(0).max(100).optional().default(0),
  eligible_member_share_pct: z.number().min(0).max(100).optional().default(0),
  avg_sink_ticket_usd: z.number().min(0).optional().default(0),
  sink_frequency_per_month: z.number().min(0).optional().default(0),
  alpha_payment_share_pct: z.number().min(0).max(100).optional().default(100),
  sink_growth_rate_pct: z.number().min(-100).max(1000).optional().default(0)
});

export const founderSafeSinkAdoptionModel = Object.freeze(sinkAdoptionModelSchema.parse({}));

export const web3TokenomicsSchema = z.object({
  network_status: z
    .enum(["not_applicable_internal", "planned", "testnet", "mainnet"])
    .optional()
    .default("not_applicable_internal"),
  supply_model: z
    .enum(["not_applicable_internal", "uncapped_internal", "fixed_supply", "capped_emission"])
    .optional()
    .default("not_applicable_internal"),
  max_supply: z.number().positive().nullable().optional().default(null),
  allocation: z
    .object({
      community_pct: z.number().min(0).max(100).nullable().optional().default(null),
      treasury_pct: z.number().min(0).max(100).nullable().optional().default(null),
      team_pct: z.number().min(0).max(100).nullable().optional().default(null),
      investor_pct: z.number().min(0).max(100).nullable().optional().default(null),
      liquidity_pct: z.number().min(0).max(100).nullable().optional().default(null)
    })
    .optional()
    .default({}),
  vesting: z
    .object({
      team_cliff_months: z.number().int().min(0).nullable().optional().default(null),
      team_vesting_months: z.number().int().min(0).nullable().optional().default(null),
      investor_cliff_months: z.number().int().min(0).nullable().optional().default(null),
      investor_vesting_months: z.number().int().min(0).nullable().optional().default(null)
    })
    .optional()
    .default({}),
  liquidity: z
    .object({
      enabled: z.boolean().optional().default(false),
      reserve_pct: z.number().min(0).max(100).nullable().optional().default(null),
      launch_pool_usd: z.number().min(0).nullable().optional().default(null)
    })
    .optional()
    .default({}),
  market: z
    .object({
      price_basis: z
        .enum([
          "not_applicable_internal",
          "fixed_accounting",
          "oracle_feed",
          "liquidity_pool",
          "market_forecast"
        ])
        .optional()
        .default("not_applicable_internal"),
      alpha_usd_price: z.number().positive().nullable().optional().default(null),
      circulating_supply: z.number().min(0).nullable().optional().default(null),
      treasury_reserve_usd: z.number().min(0).nullable().optional().default(null),
      liquidity_pool_alpha: z.number().min(0).nullable().optional().default(null),
      liquidity_pool_usd: z.number().min(0).nullable().optional().default(null),
      monthly_buy_demand_usd: z.number().min(0).nullable().optional().default(null),
      monthly_sell_pressure_alpha: z.number().min(0).nullable().optional().default(null),
      monthly_burn_alpha: z.number().min(0).nullable().optional().default(null),
      vesting_unlock_alpha: z.number().min(0).nullable().optional().default(null)
    })
    .optional()
    .default({}),
  governance: z
    .object({
      mode: z.enum(["founder_admin", "multisig_admin", "token_voting", "dao"]).optional().default("founder_admin"),
      voting_token_enabled: z.boolean().optional().default(false)
    })
    .optional()
    .default({}),
  smart_contract: z
    .object({
      chain: z.string().min(1).nullable().optional().default(null),
      standard: z.string().min(1).nullable().optional().default(null),
      audit_status: z.enum(["not_started", "in_progress", "completed"]).optional().default("not_started")
    })
    .optional()
    .default({}),
  legal: z
    .object({
      classification: z
        .enum(["unreviewed", "utility_internal", "utility_transferable", "security_review_required"])
        .optional()
        .default("unreviewed"),
      kyc_required: z.boolean().nullable().optional().default(null),
      jurisdiction_notes: z.string().nullable().optional().default(null)
    })
    .optional()
    .default({})
});

export const founderSafeWeb3Tokenomics = Object.freeze(web3TokenomicsSchema.parse({}));

export type ScenarioGuardrailStatus = "allowed" | "conditional" | "not_safe";

export type ScenarioGuardrailParameterKey =
  | "scenario_mode"
  | "k_pc"
  | "k_sp"
  | "cap_user_monthly"
  | "cap_group_monthly"
  | "sink_target"
  | "cashout_mode"
  | "cashout_min_usd"
  | "cashout_fee_bps"
  | "cashout_windows_per_year"
  | "cashout_window_days"
  | "projection_horizon_months"
  | "milestone_schedule"
  | "reward_global_factor"
  | "reward_pool_factor"
  | "cohort_assumptions"
  | "sink_adoption_model"
  | "alpha_token_policy"
  | "forecast_policy"
  | "web3_tokenomics";

export type ScenarioGuardrailMatrixEntry = {
  parameter_key: ScenarioGuardrailParameterKey;
  status: ScenarioGuardrailStatus;
  founder_label: string;
  business_rationale: string;
  founder_action: string;
};

export type ScenarioGuardrailDefaults = {
  reward_global_factor?: number;
  reward_pool_factor?: number;
};

export type ScenarioGuardrailIssue = {
  severity: "ERROR" | "WARNING";
  status: ScenarioGuardrailStatus;
  parameter_path: string;
  message: string;
};

export const scenarioGuardrailMatrix: ScenarioGuardrailMatrixEntry[] = [
  {
    parameter_key: "scenario_mode",
    status: "conditional",
    founder_label: "Mode",
    business_rationale: "Controls whether the run uses imported data only or adds forecast assumptions.",
    founder_action: "Use Imported Data Only for evidence-backed runs; use Add Forecast only when estimates are acceptable."
  },
  {
    parameter_key: "k_pc",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Policy layer on top of imported PC data.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "k_sp",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Policy layer on top of imported SP/LTS data.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "cap_user_monthly",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Monthly ALPHA limit per user; does not change imported data.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "cap_group_monthly",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Monthly ALPHA limit per group; does not change imported data.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "sink_target",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Target internal ALPHA use, not observed data.",
    founder_action: "May be tuned, but results must be labeled as scenario assumptions."
  },
  {
    parameter_key: "sink_adoption_model",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Adds estimated internal use without changing actual sink_spend_usd.",
    founder_action: "May be tuned, but forecast sink output must stay separate from actual sink spend."
  },
  {
    parameter_key: "cashout_mode",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release rule assumption on top of imported data.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_min_usd",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release rule assumption on top of imported data.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_fee_bps",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release rule assumption on top of imported data.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_windows_per_year",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release rule assumption on top of imported data.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_window_days",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release rule assumption on top of imported data.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "projection_horizon_months",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Extending beyond observed history introduces projection assumptions.",
    founder_action: "May be tuned, but projections must be framed as assumptions."
  },
  {
    parameter_key: "milestone_schedule",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Time-staged policy changes are scenario assumptions, not observed data.",
    founder_action: "May be tuned, but milestone outputs must be framed as assumptions."
  },
  {
    parameter_key: "reward_global_factor",
    status: "not_safe",
    founder_label: "Locked",
    business_rationale: "This factor is part of the core reward formula. Changing it can bias scenario comparison.",
    founder_action: "Locked to the model default."
  },
  {
    parameter_key: "reward_pool_factor",
    status: "not_safe",
    founder_label: "Locked",
    business_rationale: "This factor is part of the core pool reward formula. Changing it can bias scenario comparison.",
    founder_action: "Locked to the model default."
  },
  {
    parameter_key: "cohort_assumptions",
    status: "conditional",
    founder_label: "Mode Controlled",
    business_rationale: "New members, churn, and reactivation are forecasts, not imported data.",
    founder_action: "Keep off in Imported Data Only. Turn on only when outputs can be labeled as estimates."
  },
  {
    parameter_key: "alpha_token_policy",
    status: "conditional",
    founder_label: "Spec Lock",
    business_rationale: "Defines whether ALPHA is an internal credit, points layer, off-chain token, or future on-chain token.",
    founder_action: "Must be explicitly selected before Tokenflow and Whitepaper language is locked."
  },
  {
    parameter_key: "forecast_policy",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Separates observed snapshot periods from forward-looking projection periods.",
    founder_action: "May be tuned, but all forecast periods must be labeled as assumptions."
  },
  {
    parameter_key: "web3_tokenomics",
    status: "conditional",
    founder_label: "Web3 Extension",
    business_rationale: "Tracks token price, supply, allocation, vesting, liquidity, governance, smart-contract, and legal assumptions outside imported data.",
    founder_action: "Founder, legal, and tokenomics review required before public Web3 claims."
  }
];

function normalizeScenarioGuardrailDefaults(defaults: ScenarioGuardrailDefaults = {}) {
  return {
    reward_global_factor: defaults.reward_global_factor ?? 1,
    reward_pool_factor: defaults.reward_pool_factor ?? 1
  };
}

function readScenarioRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cohortAssumptionsEqual(
  left: ScenarioCohortAssumptions,
  right: ScenarioCohortAssumptions
) {
  return (
    left.new_members_per_month === right.new_members_per_month &&
    left.monthly_churn_rate_pct === right.monthly_churn_rate_pct &&
    left.monthly_reactivation_rate_pct === right.monthly_reactivation_rate_pct &&
    left.affiliate_new_member_share_pct === right.affiliate_new_member_share_pct &&
    left.cross_app_adoption_rate_pct === right.cross_app_adoption_rate_pct &&
    left.new_member_value_factor === right.new_member_value_factor &&
    left.reactivated_member_value_factor === right.reactivated_member_value_factor
  );
}

export const scenarioCoreParametersSchema = z.object({
  scenario_mode: scenarioModeSchema.optional().default("founder_safe"),
  k_pc: z.number().positive(),
  k_sp: z.number().positive(),
  reward_global_factor: z.number().positive(),
  reward_pool_factor: z.number().positive(),
  cap_user_monthly: z.string(),
  cap_group_monthly: z.string(),
  sink_target: z.number().min(0).max(1),
  cashout_mode: z.enum(["ALWAYS_OPEN", "WINDOWS"]),
  cashout_min_usd: z.number().min(0),
  cashout_fee_bps: z.number().min(0).max(10000),
  cashout_windows_per_year: z.number().int().positive(),
  cashout_window_days: z.number().int().positive(),
  cohort_assumptions: scenarioCohortAssumptionsSchema.optional().default({}),
  sink_adoption_model: sinkAdoptionModelSchema.optional().default({})
});

export const scenarioParameterOverrideSchema = scenarioCoreParametersSchema
  .omit({
    scenario_mode: true,
    cohort_assumptions: true
  })
  .partial()
  .extend({
    cohort_assumptions: scenarioCohortAssumptionsSchema.partial().optional(),
    sink_adoption_model: sinkAdoptionModelSchema.partial().optional()
  })
  .superRefine((value, context) => {
    if (typeof value.reward_global_factor !== "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reward_global_factor"],
        message: "reward_global_factor is locked and cannot be changed from a milestone."
      });
    }

    if (typeof value.reward_pool_factor !== "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reward_pool_factor"],
        message: "reward_pool_factor is locked and cannot be changed from a milestone."
      });
    }

    if (typeof value.cohort_assumptions !== "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cohort_assumptions"],
        message: "Growth forecast cannot be changed from a milestone."
      });
    }
  });

export const scenarioMilestoneScheduleItemSchema = z
  .object({
    milestone_key: z.string().min(1),
    label: z.string().min(1),
    start_month: z.number().int().positive(),
    end_month: z.number().int().positive().nullable().optional(),
    parameter_overrides: scenarioParameterOverrideSchema.optional().default({})
  })
  .superRefine((value, context) => {
    if (value.end_month !== null && value.end_month !== undefined && value.end_month < value.start_month) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_month"],
        message: "end_month must be greater than or equal to start_month."
      });
    }
  });

export const scenarioParametersSchema = scenarioCoreParametersSchema
  .extend({
    projection_horizon_months: z.number().int().positive().nullable().optional().default(null),
    milestone_schedule: z.array(scenarioMilestoneScheduleItemSchema).optional().default([]),
    alpha_token_policy: alphaTokenPolicySchema.optional().default({}),
    forecast_policy: forecastPolicySchema.optional().default({}),
    web3_tokenomics: web3TokenomicsSchema.optional().default({})
  })
  .superRefine((value, context) => {
    const milestoneKeys = new Set<string>();

    for (const [index, milestone] of value.milestone_schedule.entries()) {
      if (milestoneKeys.has(milestone.milestone_key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["milestone_schedule", index, "milestone_key"],
          message: "milestone_key must be unique within one scenario."
        });
      }

      milestoneKeys.add(milestone.milestone_key);
    }
  });

export const scenarioSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  template: scenarioTemplateSchema,
  parameters: scenarioParametersSchema
});

export const createScenarioSchema = z.object({
  name: z.string().min(3),
  templateType: scenarioTemplateSchema,
  description: z.string().max(1000).nullable().optional(),
  snapshotIdDefault: z.string().min(1).nullable().optional(),
  modelVersionId: z.string().min(1),
  parameters: scenarioParametersSchema
});

export const updateScenarioSchema = createScenarioSchema.extend({
  id: z.string().min(1)
});

export function applyFounderScenarioGuardrails(
  parameters: ScenarioParameters,
  defaults: ScenarioGuardrailDefaults = {}
): ScenarioParameters {
  const lockedDefaults = normalizeScenarioGuardrailDefaults(defaults);
  const scenarioMode = scenarioModeSchema.parse(parameters.scenario_mode ?? "founder_safe");
  const cohortAssumptions =
    scenarioMode === "advanced_forecast"
      ? scenarioCohortAssumptionsSchema.parse(parameters.cohort_assumptions ?? {})
      : { ...founderSafePassiveCohortAssumptions };

  return {
    ...parameters,
    scenario_mode: scenarioMode,
    reward_global_factor: lockedDefaults.reward_global_factor,
    reward_pool_factor: lockedDefaults.reward_pool_factor,
    cohort_assumptions: cohortAssumptions,
    sink_adoption_model: sinkAdoptionModelSchema.parse(parameters.sink_adoption_model ?? {}),
    alpha_token_policy: alphaTokenPolicySchema.parse(parameters.alpha_token_policy),
    forecast_policy: forecastPolicySchema.parse(parameters.forecast_policy),
    web3_tokenomics: web3TokenomicsSchema.parse(parameters.web3_tokenomics),
    milestone_schedule: parameters.milestone_schedule.map((milestone) => ({
      ...milestone,
      parameter_overrides: {
        ...milestone.parameter_overrides,
        reward_global_factor: undefined,
        reward_pool_factor: undefined,
        cohort_assumptions: undefined
      }
    }))
  };
}

function stripLegacyFounderUnsafeMilestoneOverrides(value: unknown) {
  const record = readScenarioRecord(value);

  if (!record || !Array.isArray(record.milestone_schedule)) {
    return value;
  }

  return {
    ...record,
    milestone_schedule: record.milestone_schedule.map((milestone) => {
      const milestoneRecord = readScenarioRecord(milestone);

      if (!milestoneRecord) {
        return milestone;
      }

      const parameterOverrides = readScenarioRecord(milestoneRecord.parameter_overrides);

      if (!parameterOverrides) {
        return milestone;
      }

      const sanitizedOverrides = { ...parameterOverrides };

      delete sanitizedOverrides.reward_global_factor;
      delete sanitizedOverrides.reward_pool_factor;
      delete sanitizedOverrides.cohort_assumptions;

      return {
        ...milestoneRecord,
        parameter_overrides: sanitizedOverrides
      };
    })
  };
}

export function parseFounderSafeScenarioParameters(
  value: unknown,
  defaults: ScenarioGuardrailDefaults = {}
): ScenarioParameters {
  return applyFounderScenarioGuardrails(
    scenarioParametersSchema.parse(stripLegacyFounderUnsafeMilestoneOverrides(value)),
    defaults
  );
}

export function evaluateFounderScenarioGuardrails(
  parameters: ScenarioParameters,
  defaults: ScenarioGuardrailDefaults = {}
): ScenarioGuardrailIssue[] {
  const issues: ScenarioGuardrailIssue[] = [];
  const lockedDefaults = normalizeScenarioGuardrailDefaults(defaults);
  const scenarioMode = scenarioModeSchema.parse(parameters.scenario_mode ?? "founder_safe");

  if (parameters.reward_global_factor !== lockedDefaults.reward_global_factor) {
    issues.push({
      severity: "ERROR",
      status: "not_safe",
      parameter_path: "reward_global_factor",
      message: `reward_global_factor is locked at ${lockedDefaults.reward_global_factor} so the core reward formula stays unchanged.`
    });
  }

  if (parameters.reward_pool_factor !== lockedDefaults.reward_pool_factor) {
    issues.push({
      severity: "ERROR",
      status: "not_safe",
      parameter_path: "reward_pool_factor",
      message: `reward_pool_factor is locked at ${lockedDefaults.reward_pool_factor} so the pool reward formula stays unchanged.`
    });
  }

  if (
    scenarioMode === "founder_safe" &&
    !cohortAssumptionsEqual(parameters.cohort_assumptions, founderSafePassiveCohortAssumptions)
  ) {
    issues.push({
      severity: "ERROR",
      status: "not_safe",
      parameter_path: "cohort_assumptions",
      message: "Growth forecast must stay off in Imported Data Only mode."
    });
  }

  if (scenarioMode === "advanced_forecast") {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "scenario_mode",
      message: "Add Forecast uses growth assumptions. Result, Compare, and Whitepaper outputs must label them as estimates."
    });
  }

  if (parameters.projection_horizon_months !== null) {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "projection_horizon_months",
      message: "projection_horizon_months introduces forward-looking assumptions beyond the observed snapshot."
    });
  }

  const sinkAdoption = sinkAdoptionModelSchema.parse(parameters.sink_adoption_model ?? {});
  const hasSinkAdoptionAssumption =
    sinkAdoption.sink_adoption_rate_pct > 0 ||
    sinkAdoption.eligible_member_share_pct > 0 ||
    sinkAdoption.avg_sink_ticket_usd > 0 ||
    sinkAdoption.sink_frequency_per_month > 0 ||
    sinkAdoption.sink_growth_rate_pct !== 0;

  if (hasSinkAdoptionAssumption) {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "sink_adoption_model",
      message: "sink_adoption_model adds forecast internal-use assumptions and must be separated from actual sink_spend_usd."
    });
  }

  if (parameters.alpha_token_policy.classification !== "internal_credit") {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "alpha_token_policy.classification",
      message: "alpha_token_policy changes ALPHA language away from internal credit and requires founder/legal review."
    });
  }

  if (
    parameters.alpha_token_policy.on_chain_status !== "not_on_chain" ||
    parameters.alpha_token_policy.transferability === "externally_transferable"
  ) {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "alpha_token_policy",
      message: "On-chain or externally transferable ALPHA claims require the Web3 tokenomics extension to be completed."
    });
  }

  if (parameters.forecast_policy.mode !== "snapshot_window") {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "forecast_policy.mode",
      message: "forecast_policy makes part of the run forward-looking and must not be described as observed data."
    });
  }

  if (
    parameters.web3_tokenomics.network_status !== "not_applicable_internal" ||
    parameters.web3_tokenomics.supply_model !== "not_applicable_internal" ||
    parameters.web3_tokenomics.market.price_basis !== "not_applicable_internal"
  ) {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "web3_tokenomics",
      message: "web3_tokenomics contains public-token or market-price assumptions that require founder, legal, and implementation review."
    });
  }

  if (parameters.milestone_schedule.length > 0) {
    issues.push({
      severity: "WARNING",
      status: "conditional",
      parameter_path: "milestone_schedule",
      message: "milestone_schedule introduces time-staged policy assumptions on top of the understanding-doc baseline."
    });
  }

  for (const [index, milestone] of parameters.milestone_schedule.entries()) {
    if (typeof milestone.parameter_overrides.reward_global_factor !== "undefined") {
      issues.push({
        severity: "ERROR",
        status: "not_safe",
        parameter_path: `milestone_schedule.${index}.parameter_overrides.reward_global_factor`,
        message: "reward_global_factor is locked and cannot be changed from a milestone."
      });
    }

    if (typeof milestone.parameter_overrides.reward_pool_factor !== "undefined") {
      issues.push({
        severity: "ERROR",
        status: "not_safe",
        parameter_path: `milestone_schedule.${index}.parameter_overrides.reward_pool_factor`,
        message: "reward_pool_factor is locked and cannot be changed from a milestone."
      });
    }

    if (typeof milestone.parameter_overrides.cohort_assumptions !== "undefined") {
      issues.push({
        severity: "ERROR",
        status: "not_safe",
        parameter_path: `milestone_schedule.${index}.parameter_overrides.cohort_assumptions`,
        message: "Growth forecast cannot be changed from a milestone."
      });
    }
  }

  return issues;
}

export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type ScenarioMode = z.infer<typeof scenarioModeSchema>;
export type ScenarioParameters = z.infer<typeof scenarioParametersSchema>;
export type ScenarioParameterOverride = z.infer<typeof scenarioParameterOverrideSchema>;
export type ScenarioMilestoneScheduleItem = z.infer<typeof scenarioMilestoneScheduleItemSchema>;
export type ScenarioCohortAssumptions = z.infer<typeof scenarioCohortAssumptionsSchema>;
export type ScenarioSinkAdoptionModel = z.infer<typeof sinkAdoptionModelSchema>;
export type AlphaTokenPolicy = z.infer<typeof alphaTokenPolicySchema>;
export type ForecastPolicy = z.infer<typeof forecastPolicySchema>;
export type Web3Tokenomics = z.infer<typeof web3TokenomicsSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
