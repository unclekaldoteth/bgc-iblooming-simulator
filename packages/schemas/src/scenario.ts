import { z } from "zod";

export const scenarioTemplateSchema = z.enum([
  "Baseline",
  "Conservative",
  "Growth",
  "Stress"
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

export type ScenarioGuardrailStatus = "allowed" | "conditional" | "not_safe";

export type ScenarioGuardrailParameterKey =
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
  | "cohort_assumptions";

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
    parameter_key: "k_pc",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Policy overlay on top of already-fixed PC truth.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "k_sp",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Policy overlay on top of already-fixed SP/LTS truth.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "cap_user_monthly",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Monthly ALPHA issuance cap; does not rewrite business-event truth.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "cap_group_monthly",
    status: "allowed",
    founder_label: "Allowed",
    business_rationale: "Monthly group-level ALPHA issuance cap; does not rewrite business-event truth.",
    founder_action: "Free to tune."
  },
  {
    parameter_key: "sink_target",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Represents ALPHA sink policy demand, not a direct understanding-doc rule.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_mode",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release policy assumption layered on top of business truth.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_min_usd",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release policy assumption layered on top of business truth.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_fee_bps",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release policy assumption layered on top of business truth.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_windows_per_year",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release policy assumption layered on top of business truth.",
    founder_action: "May be tuned, but results must be described as scenario assumptions."
  },
  {
    parameter_key: "cashout_window_days",
    status: "conditional",
    founder_label: "Assumption",
    business_rationale: "Release policy assumption layered on top of business truth.",
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
    business_rationale: "Time-staged policy changes are scenario assumptions, not historical truth.",
    founder_action: "May be tuned, but milestone outputs must be framed as assumptions."
  },
  {
    parameter_key: "reward_global_factor",
    status: "not_safe",
    founder_label: "Locked",
    business_rationale: "A generic global reward multiplier can distort named reward sources from the understanding document.",
    founder_action: "Locked to the neutral baseline model default."
  },
  {
    parameter_key: "reward_pool_factor",
    status: "not_safe",
    founder_label: "Locked",
    business_rationale: "A generic pool reward multiplier can distort pool semantics from the understanding document.",
    founder_action: "Locked to the neutral baseline model default."
  },
  {
    parameter_key: "cohort_assumptions",
    status: "not_safe",
    founder_label: "Locked",
    business_rationale: "Synthetic member growth/churn/reactivation is not faithful to understanding-doc event logic.",
    founder_action: "Founder-facing scenarios keep cohort projection disabled."
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
  cohort_assumptions: scenarioCohortAssumptionsSchema.optional().default({})
});

export const scenarioParameterOverrideSchema = scenarioCoreParametersSchema
  .omit({
    cohort_assumptions: true
  })
  .partial()
  .extend({
    cohort_assumptions: scenarioCohortAssumptionsSchema.partial().optional()
  })
  .superRefine((value, context) => {
    if (typeof value.reward_global_factor !== "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reward_global_factor"],
        message: "reward_global_factor cannot be overridden inside milestone_schedule in founder-safe mode."
      });
    }

    if (typeof value.reward_pool_factor !== "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reward_pool_factor"],
        message: "reward_pool_factor cannot be overridden inside milestone_schedule in founder-safe mode."
      });
    }

    if (typeof value.cohort_assumptions !== "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cohort_assumptions"],
        message: "cohort_assumptions cannot be overridden inside milestone_schedule in founder-safe mode."
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
    milestone_schedule: z.array(scenarioMilestoneScheduleItemSchema).optional().default([])
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

  return {
    ...parameters,
    reward_global_factor: lockedDefaults.reward_global_factor,
    reward_pool_factor: lockedDefaults.reward_pool_factor,
    cohort_assumptions: { ...founderSafePassiveCohortAssumptions },
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

  if (parameters.reward_global_factor !== lockedDefaults.reward_global_factor) {
    issues.push({
      severity: "ERROR",
      status: "not_safe",
      parameter_path: "reward_global_factor",
      message: `reward_global_factor is locked to ${lockedDefaults.reward_global_factor} in founder-safe mode.`
    });
  }

  if (parameters.reward_pool_factor !== lockedDefaults.reward_pool_factor) {
    issues.push({
      severity: "ERROR",
      status: "not_safe",
      parameter_path: "reward_pool_factor",
      message: `reward_pool_factor is locked to ${lockedDefaults.reward_pool_factor} in founder-safe mode.`
    });
  }

  if (!cohortAssumptionsEqual(parameters.cohort_assumptions, founderSafePassiveCohortAssumptions)) {
    issues.push({
      severity: "ERROR",
      status: "not_safe",
      parameter_path: "cohort_assumptions",
      message: "cohort_assumptions must remain disabled in founder-safe mode."
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
        message: "reward_global_factor cannot be overridden inside milestone_schedule in founder-safe mode."
      });
    }

    if (typeof milestone.parameter_overrides.reward_pool_factor !== "undefined") {
      issues.push({
        severity: "ERROR",
        status: "not_safe",
        parameter_path: `milestone_schedule.${index}.parameter_overrides.reward_pool_factor`,
        message: "reward_pool_factor cannot be overridden inside milestone_schedule in founder-safe mode."
      });
    }

    if (typeof milestone.parameter_overrides.cohort_assumptions !== "undefined") {
      issues.push({
        severity: "ERROR",
        status: "not_safe",
        parameter_path: `milestone_schedule.${index}.parameter_overrides.cohort_assumptions`,
        message: "cohort_assumptions cannot be overridden inside milestone_schedule in founder-safe mode."
      });
    }
  }

  return issues;
}

export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type ScenarioParameters = z.infer<typeof scenarioParametersSchema>;
export type ScenarioParameterOverride = z.infer<typeof scenarioParameterOverrideSchema>;
export type ScenarioMilestoneScheduleItem = z.infer<typeof scenarioMilestoneScheduleItemSchema>;
export type ScenarioCohortAssumptions = z.infer<typeof scenarioCohortAssumptionsSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
