import type {
  MilestoneEvaluation,
  RunSegmentMetric,
  RunFlag,
  RunTimeSeriesMetric,
  ScenarioCohortAssumptions,
  ScenarioMilestoneScheduleItem,
  ScenarioParameterOverride,
  ScenarioParameters,
  SimulationRunRequest,
  SimulationRunResult,
  SummaryMetrics
} from "@bgc-alpha/schemas";

import { evaluateStrategicObjectives } from "../strategic/evaluate-strategic-objectives";
import type { RecommendationThresholds } from "../flags/evaluate-flags";
import { evaluateFlags } from "../flags/evaluate-flags";
import { createDefaultSummaryMetrics } from "../metrics/default-summary";
import { evaluateRecommendation } from "../recommendation/evaluate-recommendation";

export type DatasetSimulationFact = {
  periodKey: string;
  memberKey: string;
  sourceSystem: string;
  memberTier?: string | null;
  groupKey?: string | null;
  pcVolume: number;
  spRewardBasis: number;
  globalRewardUsd: number;
  poolRewardUsd: number;
  cashoutUsd: number;
  sinkSpendUsd: number;
  activeMember: boolean;
  recognizedRevenueUsd?: number | null;
  grossMarginUsd?: number | null;
  memberJoinPeriod?: string | null;
  isAffiliate?: boolean | null;
  crossAppActive?: boolean | null;
  grossCashInUsd?: number | null;
  retainedRevenueUsd?: number | null;
  partnerPayoutOutUsd?: number | null;
  productFulfillmentOutUsd?: number | null;
  poolFundingEntries?:
    | Array<{
        poolCode: string;
        fundingAmount: number;
        distributionAmount: number;
        distributionCycle: string;
        cycleKey: string;
      }>
    | null;
};

export type DatasetPoolPeriodFact = {
  periodKey: string;
  poolCode: string;
  distributionCycle: string;
  unit: string;
  fundingAmount: number;
  distributionAmount: number;
  recipientCount: number;
  shareCountTotal: number;
};

export type SimulationBaselineModel = {
  version: string;
  defaults: {
    reward_global_factor: number;
    reward_pool_factor: number;
    cap_user_monthly: number;
    cap_group_monthly: number;
    sink_target: number;
    cashout_mode: "WINDOWS" | "ALWAYS_OPEN";
    cashout_min_usd: number;
    cashout_fee_bps: number;
    cashout_windows_per_year: number;
    cashout_window_days: number;
  };
  conversionRules: {
    pc_units_per_alpha: number;
    sp_units_per_alpha: number;
    pc_alpha_weight: number;
    sp_alpha_weight: number;
    active_member_multiplier: number;
    inactive_member_multiplier: number;
  };
  rewardRules: {
    global_reward_weight: number;
    pool_reward_weight: number;
  };
  capRules: {
    minimum_user_monthly_cap: number;
    minimum_group_monthly_cap: number;
  };
  sinkRules: {
    baseline_sink_target: number;
    spend_release_factor: number;
    max_spend_share: number;
  };
  cashoutRules: {
    always_open_release_factor: number;
    windowed_release_factor: number;
    min_window_coverage_ratio: number;
    fee_retention_factor: number;
  };
  treasuryRules: {
    reserve_buffer_months: number;
    inflow_capture_rate: number;
  };
  recommendationThresholds: RecommendationThresholds;
  strategicKpiAssumptions: {
    score_thresholds: {
      candidate: number;
      risky: number;
    };
    revenue: {
      recognized_revenue_inflow_weight: number;
      gross_margin_inflow_weight: number;
      proxy_revenue_capture_rate: number;
      target_revenue_per_active_member: number;
      target_cross_app_share_pct: number;
    };
    ops_cost: {
      automation_coverage_score: number;
      target_cost_to_serve_index: number;
      cashout_ops_penalty_weight: number;
    };
    tax: {
      legal_readiness_score: number;
      compliance_structure_score: number;
      target_tax_event_reduction_pct: number;
    };
    affiliate: {
      affiliate_member_multiplier: number;
      target_activation_rate_pct: number;
      target_retention_rate_pct: number;
      target_productivity_share_pct: number;
    };
    active_user: {
      new_member_multiplier: number;
      reactivated_member_multiplier: number;
      cross_app_active_multiplier: number;
      target_retention_rate_pct: number;
      target_cross_app_share_pct: number;
    };
  };
};

export type DatasetSimulationInput = {
  request: SimulationRunRequest;
  facts: DatasetSimulationFact[];
  poolPeriodFacts?: DatasetPoolPeriodFact[];
  baselineModel: SimulationBaselineModel;
};

type EffectiveScenarioParameters = {
  kPc: number;
  kSp: number;
  rewardGlobalFactor: number;
  rewardPoolFactor: number;
  capUserMonthly: number;
  capGroupMonthly: number;
  sinkTarget: number;
  cashoutMode: "WINDOWS" | "ALWAYS_OPEN";
  cashoutMinUsd: number;
  cashoutFeeBps: number;
  cashoutWindowsPerYear: number;
  cashoutWindowDays: number;
  cohortAssumptions: ScenarioCohortAssumptions;
};

type EffectiveMilestone = {
  milestoneKey: string;
  label: string;
  startMonth: number;
  endMonth: number;
  parameters: EffectiveScenarioParameters;
};

type ProjectedSimulationFact = DatasetSimulationFact & {
  periodIndex: number;
  sourcePeriodKey: string;
  milestoneKey: string;
  milestoneLabel: string;
};

type WorkingFactRow = ProjectedSimulationFact & {
  lifecycleStage: "existing" | "new" | "retained" | "reactivated" | "inactive";
  rawIssued: number;
  issued: number;
  spent: number;
  held: number;
  cashout: number;
  liability: number;
  inflow: number;
};

type PoolFundingPeriodRow = {
  periodKey: string;
  sourceSystem: string;
  poolCode: string;
  fundingAmount: number;
};

type FinancialPeriodLedger = {
  periodKey: string;
  grossCashIn: number;
  retainedRevenue: number;
  partnerPayoutOut: number;
  directRewardObligation: number;
  poolFundingObligation: number;
  actualPayoutOut: number;
  productFulfillmentOut: number;
  netTreasuryDelta: number;
};

type MemberProjectionState = {
  memberKey: string;
  templateMemberKey: string;
  joinMonthIndex: number;
  synthetic: boolean;
  valueScale: number;
  isAffiliate: boolean;
  crossAppActive: boolean;
};

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function computePayoutInflowRatio(liability: number, inflow: number) {
  if (liability <= 0) {
    return 0;
  }

  if (inflow <= 0) {
    return liability;
  }

  return liability / inflow;
}

function stableHash(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function stableRatio(input: string) {
  return stableHash(input) / 0xffffffff;
}

function parsePeriodKey(periodKey: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);

  if (!match) {
    throw new Error(`Invalid period key: ${periodKey}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}

function formatPeriodKey(year: number, month: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function addMonthsToPeriodKey(periodKey: string, monthOffset: number) {
  const parsed = parsePeriodKey(periodKey);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1 + monthOffset, 1));

  return formatPeriodKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

function parseCap(value: string, fallback: number, minimum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(minimum, parsed) : fallback;
}

function normalizeSourceSystem(sourceSystem: string) {
  return sourceSystem.trim().toLowerCase();
}

function inferPoolSourceSystem(poolCode: string) {
  return poolCode.startsWith("IB_") ? "iblooming" : "bgc";
}

function buildFactKey(fact: Pick<DatasetSimulationFact, "periodKey" | "memberKey" | "sourceSystem">) {
  return `${fact.periodKey}::${fact.memberKey}::${fact.sourceSystem}`;
}

function mergeScenarioParameters(
  parameters: ScenarioParameters,
  overrides: ScenarioParameterOverride = {}
): ScenarioParameters {
  return {
    ...parameters,
    ...overrides,
    cohort_assumptions: {
      ...parameters.cohort_assumptions,
      ...(overrides.cohort_assumptions ?? {})
    },
    projection_horizon_months: parameters.projection_horizon_months ?? null,
    milestone_schedule: parameters.milestone_schedule ?? []
  };
}

function buildEffectiveParameters(
  parameters: ScenarioParameters,
  baselineModel: SimulationBaselineModel
): EffectiveScenarioParameters {
  return {
    kPc: parameters.k_pc,
    kSp: parameters.k_sp,
    rewardGlobalFactor: parameters.reward_global_factor,
    rewardPoolFactor: parameters.reward_pool_factor,
    capUserMonthly: parseCap(
      parameters.cap_user_monthly,
      baselineModel.defaults.cap_user_monthly,
      baselineModel.capRules.minimum_user_monthly_cap
    ),
    capGroupMonthly: parseCap(
      parameters.cap_group_monthly,
      baselineModel.defaults.cap_group_monthly,
      baselineModel.capRules.minimum_group_monthly_cap
    ),
    sinkTarget: parameters.sink_target,
    cashoutMode: parameters.cashout_mode,
    cashoutMinUsd: parameters.cashout_min_usd,
    cashoutFeeBps: parameters.cashout_fee_bps,
    cashoutWindowsPerYear: parameters.cashout_windows_per_year,
    cashoutWindowDays: parameters.cashout_window_days,
    cohortAssumptions: parameters.cohort_assumptions
  };
}

function buildResolvedMilestones(
  parameters: ScenarioParameters,
  baselineModel: SimulationBaselineModel,
  horizonMonths: number
): EffectiveMilestone[] {
  const configuredMilestones =
    parameters.milestone_schedule.length > 0
      ? [...parameters.milestone_schedule].sort((left, right) => left.start_month - right.start_month)
      : [
          {
            milestone_key: "base",
            label: "Base scenario",
            start_month: 1,
            end_month: horizonMonths,
            parameter_overrides: {}
          } satisfies ScenarioMilestoneScheduleItem
        ];
  const milestoneInputs =
    configuredMilestones[0]?.start_month === 1
      ? configuredMilestones
      : ([
          {
            milestone_key: "base",
            label: "Base scenario",
            start_month: 1,
            end_month: Math.max(1, configuredMilestones[0]!.start_month - 1),
            parameter_overrides: {}
          } satisfies ScenarioMilestoneScheduleItem,
          ...configuredMilestones
        ] as ScenarioMilestoneScheduleItem[]);

  return milestoneInputs
    .map((milestone, index) => {
      const nextMilestone = milestoneInputs[index + 1];
      const resolvedStartMonth = Math.min(Math.max(milestone.start_month, 1), horizonMonths);
      const inferredEndMonth = nextMilestone ? nextMilestone.start_month - 1 : horizonMonths;
      const requestedEndMonth = milestone.end_month ?? inferredEndMonth;
      const resolvedEndMonth = Math.min(Math.max(requestedEndMonth, resolvedStartMonth), horizonMonths);
      const mergedParameters = mergeScenarioParameters(parameters, milestone.parameter_overrides ?? {});

      return {
        milestoneKey: milestone.milestone_key,
        label: milestone.label,
        startMonth: resolvedStartMonth,
        endMonth: resolvedEndMonth,
        parameters: buildEffectiveParameters(mergedParameters, baselineModel)
      };
    })
    .filter((milestone) => milestone.startMonth <= horizonMonths && milestone.endMonth >= 1);
}

function resolveMilestoneForMonth(monthIndex: number, milestones: EffectiveMilestone[]) {
  return (
    [...milestones]
      .reverse()
      .find(
        (milestone) =>
          monthIndex >= milestone.startMonth && monthIndex <= milestone.endMonth
      ) ?? milestones[0]
  );
}

function hasActiveCohortAssumptions(milestones: EffectiveMilestone[]) {
  return milestones.some((milestone) => {
    const assumptions = milestone.parameters.cohortAssumptions;

    return (
      assumptions.new_members_per_month > 0 ||
      assumptions.monthly_churn_rate_pct > 0 ||
      assumptions.monthly_reactivation_rate_pct > 0 ||
      assumptions.affiliate_new_member_share_pct > 0 ||
      assumptions.cross_app_adoption_rate_pct > 0
    );
  });
}

function chooseTemplateFact(
  templateFactsByMember: Map<string, Map<string, DatasetSimulationFact>>,
  templateMemberKey: string,
  sourcePeriodKey: string
) {
  const memberFacts = templateFactsByMember.get(templateMemberKey);

  if (!memberFacts) {
    return null;
  }

  return (
    memberFacts.get(sourcePeriodKey) ??
    [...memberFacts.entries()].sort(([left], [right]) => left.localeCompare(right))[0]?.[1] ??
    null
  );
}

function buildDirectProjectedFacts(
  facts: DatasetSimulationFact[],
  parameters: ScenarioParameters,
  milestones: EffectiveMilestone[]
) {
  const sourcePeriods = [...new Set(facts.map((fact) => fact.periodKey))].sort();
  const sourcePeriodIndex = new Map(sourcePeriods.map((periodKey, index) => [periodKey, index + 1] as const));

  if (!parameters.projection_horizon_months) {
    return facts.map<ProjectedSimulationFact>((fact) => {
      const periodIndex = sourcePeriodIndex.get(fact.periodKey) ?? 1;
      const milestone = resolveMilestoneForMonth(periodIndex, milestones);

      return {
        ...fact,
        periodIndex,
        sourcePeriodKey: fact.periodKey,
        milestoneKey: milestone.milestoneKey,
        milestoneLabel: milestone.label
      };
    });
  }

  const factsBySourcePeriod = new Map<string, DatasetSimulationFact[]>();

  for (const fact of facts) {
    const rows = factsBySourcePeriod.get(fact.periodKey) ?? [];
    rows.push(fact);
    factsBySourcePeriod.set(fact.periodKey, rows);
  }

  const basePeriodKey = sourcePeriods[0]!;
  const projectedFacts: ProjectedSimulationFact[] = [];

  for (let monthIndex = 1; monthIndex <= parameters.projection_horizon_months; monthIndex += 1) {
    const sourcePeriodKey = sourcePeriods[(monthIndex - 1) % sourcePeriods.length]!;
    const projectedPeriodKey = addMonthsToPeriodKey(basePeriodKey, monthIndex - 1);
    const milestone = resolveMilestoneForMonth(monthIndex, milestones);

    for (const fact of factsBySourcePeriod.get(sourcePeriodKey) ?? []) {
      projectedFacts.push({
        ...fact,
        periodKey: projectedPeriodKey,
        periodIndex: monthIndex,
        sourcePeriodKey,
        milestoneKey: milestone.milestoneKey,
        milestoneLabel: milestone.label
      });
    }
  }

  return projectedFacts;
}

function buildCohortProjectedFacts(
  facts: DatasetSimulationFact[],
  parameters: ScenarioParameters,
  milestones: EffectiveMilestone[]
) {
  const sourcePeriods = [...new Set(facts.map((fact) => fact.periodKey))].sort();
  const basePeriodKey = sourcePeriods[0]!;
  const horizonMonths = parameters.projection_horizon_months ?? sourcePeriods.length;
  const factsByMember = new Map<string, DatasetSimulationFact[]>();

  for (const fact of facts) {
    const rows = factsByMember.get(fact.memberKey) ?? [];
    rows.push(fact);
    factsByMember.set(fact.memberKey, rows);
  }

  const templateFactsByMember = new Map<string, Map<string, DatasetSimulationFact>>();
  const memberStates: MemberProjectionState[] = [];

  for (const [memberKey, memberFacts] of [...factsByMember.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const byPeriod = new Map(memberFacts.map((fact) => [fact.periodKey, fact] as const));
    templateFactsByMember.set(memberKey, byPeriod);
    const firstFact = [...memberFacts].sort((left, right) => left.periodKey.localeCompare(right.periodKey))[0];

    if (!firstFact) {
      continue;
    }

    memberStates.push({
      memberKey,
      templateMemberKey: memberKey,
      joinMonthIndex: 1,
      synthetic: false,
      valueScale: 1,
      isAffiliate: Boolean(memberFacts.some((fact) => fact.isAffiliate)),
      crossAppActive:
        Boolean(memberFacts.some((fact) => fact.crossAppActive)) ||
        new Set(memberFacts.map((fact) => fact.sourceSystem)).size > 1
    });
  }

  const newMemberPrototypeKeys = [
    ...new Set(
      facts
        .filter(
          (fact) =>
            fact.activeMember &&
            (fact.memberJoinPeriod === fact.periodKey ||
              ["starter", "builder", "leader"].includes((fact.memberTier ?? "").toLowerCase()))
        )
        .map((fact) => fact.memberKey)
    )
  ];
  const prototypeKeys = newMemberPrototypeKeys.length > 0 ? newMemberPrototypeKeys : [...factsByMember.keys()].sort();
  const projectedFacts: ProjectedSimulationFact[] = [];
  const lastActiveByMember = new Map<string, boolean>();

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex += 1) {
    const sourcePeriodKey = sourcePeriods[(monthIndex - 1) % sourcePeriods.length]!;
    const projectedPeriodKey = addMonthsToPeriodKey(basePeriodKey, monthIndex - 1);
    const milestone = resolveMilestoneForMonth(monthIndex, milestones);
    const cohortAssumptions = milestone.parameters.cohortAssumptions;
    const newMembersCount = Math.max(0, Math.round(cohortAssumptions.new_members_per_month));

    for (let newMemberIndex = 0; newMemberIndex < newMembersCount; newMemberIndex += 1) {
      const prototypeMemberKey =
        prototypeKeys[(monthIndex - 1 + newMemberIndex) % Math.max(prototypeKeys.length, 1)] ?? prototypeKeys[0];

      if (!prototypeMemberKey) {
        break;
      }

      const syntheticMemberKey = `SIM-${String(monthIndex).padStart(3, "0")}-${String(newMemberIndex + 1).padStart(3, "0")}`;

      memberStates.push({
        memberKey: syntheticMemberKey,
        templateMemberKey: prototypeMemberKey,
        joinMonthIndex: monthIndex,
        synthetic: true,
        valueScale:
          cohortAssumptions.new_member_value_factor * (0.85 + stableRatio(`${syntheticMemberKey}:value`) * 0.3),
        isAffiliate:
          stableRatio(`${syntheticMemberKey}:affiliate`) <
          cohortAssumptions.affiliate_new_member_share_pct / 100,
        crossAppActive:
          stableRatio(`${syntheticMemberKey}:cross-app`) <
          cohortAssumptions.cross_app_adoption_rate_pct / 100
      });
    }

    for (const state of memberStates) {
      if (monthIndex < state.joinMonthIndex) {
        continue;
      }

      const templateFact = chooseTemplateFact(
        templateFactsByMember,
        state.templateMemberKey,
        sourcePeriodKey
      );

      if (!templateFact) {
        continue;
      }

      const wasActiveLastMonth = lastActiveByMember.get(state.memberKey) ?? templateFact.activeMember;
      let activeMember = templateFact.activeMember;
      let reactivated = false;

      if (state.synthetic && monthIndex === state.joinMonthIndex) {
        activeMember = true;
      } else if (monthIndex > 1 && wasActiveLastMonth) {
        if (
          cohortAssumptions.monthly_churn_rate_pct > 0 &&
          stableRatio(`${state.memberKey}:${projectedPeriodKey}:churn`) <
            cohortAssumptions.monthly_churn_rate_pct / 100
        ) {
          activeMember = false;
        }
      } else if (
        monthIndex > 1 &&
        cohortAssumptions.monthly_reactivation_rate_pct > 0 &&
        stableRatio(`${state.memberKey}:${projectedPeriodKey}:reactivate`) <
          cohortAssumptions.monthly_reactivation_rate_pct / 100
      ) {
        activeMember = true;
        reactivated = true;
      }

      const memberJoinPeriod = state.synthetic
        ? addMonthsToPeriodKey(basePeriodKey, state.joinMonthIndex - 1)
        : templateFact.memberJoinPeriod;
      const valueScale = activeMember
        ? state.valueScale *
          (reactivated ? cohortAssumptions.reactivated_member_value_factor : 1)
        : 0;
      const memberTier =
        state.synthetic && state.isAffiliate
          ? templateFact.memberTier?.toLowerCase() === "starter" || !templateFact.memberTier
            ? "builder"
            : templateFact.memberTier
          : templateFact.memberTier;

      projectedFacts.push({
        ...templateFact,
        periodKey: projectedPeriodKey,
        memberKey: state.memberKey,
        memberTier,
        pcVolume: roundMetric(Math.max(templateFact.pcVolume, 0) * valueScale),
        spRewardBasis: roundMetric(Math.max(templateFact.spRewardBasis, 0) * valueScale),
        globalRewardUsd: roundMetric(Math.max(templateFact.globalRewardUsd, 0) * valueScale),
        poolRewardUsd: roundMetric(Math.max(templateFact.poolRewardUsd, 0) * valueScale),
        cashoutUsd: roundMetric(Math.max(templateFact.cashoutUsd, 0) * valueScale),
        sinkSpendUsd: roundMetric(Math.max(templateFact.sinkSpendUsd, 0) * valueScale),
        recognizedRevenueUsd: roundMetric(Math.max(templateFact.recognizedRevenueUsd ?? 0, 0) * valueScale),
        grossMarginUsd: roundMetric(Math.max(templateFact.grossMarginUsd ?? 0, 0) * valueScale),
        grossCashInUsd: roundMetric(Math.max(templateFact.grossCashInUsd ?? 0, 0) * valueScale),
        retainedRevenueUsd: roundMetric(Math.max(templateFact.retainedRevenueUsd ?? 0, 0) * valueScale),
        partnerPayoutOutUsd: roundMetric(Math.max(templateFact.partnerPayoutOutUsd ?? 0, 0) * valueScale),
        productFulfillmentOutUsd: roundMetric(
          Math.max(templateFact.productFulfillmentOutUsd ?? 0, 0) * valueScale
        ),
        poolFundingEntries:
          templateFact.poolFundingEntries?.map((entry) => ({
            ...entry,
            fundingAmount: roundMetric(Math.max(entry.fundingAmount, 0) * valueScale),
            distributionAmount: roundMetric(Math.max(entry.distributionAmount, 0) * valueScale)
          })) ?? null,
        activeMember,
        memberJoinPeriod,
        isAffiliate: state.synthetic ? state.isAffiliate : templateFact.isAffiliate,
        crossAppActive: activeMember ? (state.synthetic ? state.crossAppActive : templateFact.crossAppActive) : false,
        periodIndex: monthIndex,
        sourcePeriodKey,
        milestoneKey: milestone.milestoneKey,
        milestoneLabel: milestone.label
      });

      lastActiveByMember.set(state.memberKey, activeMember);
    }
  }

  return projectedFacts;
}

function buildProjectedFacts(
  facts: DatasetSimulationFact[],
  parameters: ScenarioParameters,
  milestones: EffectiveMilestone[]
) {
  const sourcePeriods = [...new Set(facts.map((fact) => fact.periodKey))].sort();

  if (sourcePeriods.length === 0) {
    return [];
  }

  return hasActiveCohortAssumptions(milestones)
    ? buildCohortProjectedFacts(facts, parameters, milestones)
    : buildDirectProjectedFacts(facts, parameters, milestones);
}

function buildLifecycleStages(facts: ProjectedSimulationFact[]) {
  const factsByMember = new Map<string, ProjectedSimulationFact[]>();

  for (const fact of facts) {
    const memberFacts = factsByMember.get(fact.memberKey) ?? [];
    memberFacts.push(fact);
    factsByMember.set(fact.memberKey, memberFacts);
  }

  const lifecycleStages = new Map<string, WorkingFactRow["lifecycleStage"]>();

  for (const memberFacts of factsByMember.values()) {
    const sortedFacts = [...memberFacts].sort((left, right) =>
      `${left.periodKey}::${left.sourceSystem}`.localeCompare(`${right.periodKey}::${right.sourceSystem}`)
    );
    let previouslyActive = false;
    let hasBeenActiveBefore = false;
    const hasLifecycleHints = sortedFacts.some(
      (fact) => Boolean(fact.memberJoinPeriod) || fact.crossAppActive === true
    );

    for (const fact of sortedFacts) {
      let lifecycleStage: WorkingFactRow["lifecycleStage"] = fact.activeMember ? "existing" : "inactive";

      if (hasLifecycleHints && fact.activeMember && fact.memberJoinPeriod === fact.periodKey) {
        lifecycleStage = "new";
      } else if (hasLifecycleHints && fact.activeMember && previouslyActive) {
        lifecycleStage = "retained";
      } else if (hasLifecycleHints && fact.activeMember && !previouslyActive && hasBeenActiveBefore) {
        lifecycleStage = "reactivated";
      }

      lifecycleStages.set(buildFactKey(fact), lifecycleStage);
      previouslyActive = fact.activeMember;
      hasBeenActiveBefore ||= fact.activeMember;
    }
  }

  return lifecycleStages;
}

function buildRawRows(
  facts: ProjectedSimulationFact[],
  lifecycleStages: Map<string, WorkingFactRow["lifecycleStage"]>,
  parameters: EffectiveScenarioParameters,
  baselineModel: SimulationBaselineModel
) {
  return facts.map<WorkingFactRow>((fact) => {
    const pcAlphaBase =
      safeDivide(fact.pcVolume, baselineModel.conversionRules.pc_units_per_alpha) *
      baselineModel.conversionRules.pc_alpha_weight;
    const spAlphaBase =
      safeDivide(fact.spRewardBasis, baselineModel.conversionRules.sp_units_per_alpha) *
      baselineModel.conversionRules.sp_alpha_weight;
    let activityMultiplier = fact.activeMember
      ? baselineModel.conversionRules.active_member_multiplier
      : baselineModel.conversionRules.inactive_member_multiplier;
    const lifecycleStage =
      lifecycleStages.get(buildFactKey(fact)) ?? (fact.activeMember ? "existing" : "inactive");

    if (fact.isAffiliate) {
      activityMultiplier *= baselineModel.strategicKpiAssumptions.affiliate.affiliate_member_multiplier;
    }

    if (lifecycleStage === "new" && fact.memberJoinPeriod) {
      activityMultiplier *= baselineModel.strategicKpiAssumptions.active_user.new_member_multiplier;
    }

    if (lifecycleStage === "reactivated" && fact.memberJoinPeriod) {
      activityMultiplier *= baselineModel.strategicKpiAssumptions.active_user.reactivated_member_multiplier;
    }

    if (fact.crossAppActive) {
      activityMultiplier *= baselineModel.strategicKpiAssumptions.active_user.cross_app_active_multiplier;
    }

    return {
      ...fact,
      lifecycleStage,
      rawIssued: (pcAlphaBase * parameters.kPc + spAlphaBase * parameters.kSp) * activityMultiplier,
      issued: 0,
      spent: 0,
      held: 0,
      cashout: 0,
      liability: 0,
      inflow: 0
    };
  });
}

function applyUserCaps(rows: WorkingFactRow[], capUserMonthly: number) {
  const totalsByMemberMonth = new Map<string, number>();

  for (const row of rows) {
    const key = `${row.periodKey}::${row.memberKey}`;
    totalsByMemberMonth.set(key, (totalsByMemberMonth.get(key) ?? 0) + row.rawIssued);
  }

  return rows.map((row) => {
    const key = `${row.periodKey}::${row.memberKey}`;
    const rawTotal = totalsByMemberMonth.get(key) ?? 0;
    const factor = rawTotal > capUserMonthly ? capUserMonthly / rawTotal : 1;
    return {
      ...row,
      issued: row.rawIssued * factor
    };
  });
}

function applyGroupCaps(rows: WorkingFactRow[], capGroupMonthly: number) {
  const totalsByGroupMonth = new Map<string, number>();

  for (const row of rows) {
    if (!row.groupKey) {
      continue;
    }

    const key = `${row.periodKey}::${row.groupKey}`;
    totalsByGroupMonth.set(key, (totalsByGroupMonth.get(key) ?? 0) + row.issued);
  }

  return rows.map((row) => {
    if (!row.groupKey) {
      return row;
    }

    const key = `${row.periodKey}::${row.groupKey}`;
    const issuedTotal = totalsByGroupMonth.get(key) ?? 0;
    const factor = issuedTotal > capGroupMonthly ? capGroupMonthly / issuedTotal : 1;

    return {
      ...row,
      issued: row.issued * factor
    };
  });
}

function finalizeFactRows(
  rows: WorkingFactRow[],
  parameters: EffectiveScenarioParameters,
  baselineModel: SimulationBaselineModel
) {
  const baselineWindowCoverage =
    (baselineModel.defaults.cashout_windows_per_year * baselineModel.defaults.cashout_window_days) / 365;
  const scenarioWindowCoverage =
    (parameters.cashoutWindowsPerYear * parameters.cashoutWindowDays) / 365;
  const coverageRatio =
    baselineWindowCoverage > 0 ? scenarioWindowCoverage / baselineWindowCoverage : 1;
  const normalizedWindowCoverage = clamp(
    coverageRatio,
    baselineModel.cashoutRules.min_window_coverage_ratio,
    1.25
  );
  const cashoutModeFactor =
    parameters.cashoutMode === "ALWAYS_OPEN"
      ? baselineModel.cashoutRules.always_open_release_factor
      : baselineModel.cashoutRules.windowed_release_factor * normalizedWindowCoverage;
  const feeRetentionFactor = clamp(
    1 - (parameters.cashoutFeeBps / 10_000) * baselineModel.cashoutRules.fee_retention_factor,
    0,
    1
  );
  const sinkScale = clamp(
    safeDivide(parameters.sinkTarget, baselineModel.sinkRules.baseline_sink_target || 0.01),
    0.25,
    2.5
  );

  return rows.map((row) => {
    const spendCandidate =
      row.sinkSpendUsd * sinkScale * baselineModel.sinkRules.spend_release_factor;
    const spent = Math.min(
      row.issued * baselineModel.sinkRules.max_spend_share,
      Math.max(spendCandidate, 0)
    );
    const cashoutEligible = row.cashoutUsd >= parameters.cashoutMinUsd ? row.cashoutUsd : 0;
    const cashout = Math.min(
      Math.max(row.issued - spent, 0),
      cashoutEligible * cashoutModeFactor * feeRetentionFactor
    );
    const held = Math.max(row.issued - spent - cashout, 0);
    // Treasury-facing pressure should stay anchored to the understanding-doc
    // reward distributions already present in the snapshot truth. Founder-safe
    // scenarios do not rewrite named reward families with generic multipliers.
    const rewardLiability =
      Math.max(row.globalRewardUsd, 0) +
      Math.max(row.poolRewardUsd, 0);
    const liability = rewardLiability + cashout;
    // Company inflow is anchored to imported recognized revenue, not proxy
    // conversions from PC issuance or internal ALPHA sink activity.
    const inflow = Math.max(row.retainedRevenueUsd ?? row.recognizedRevenueUsd ?? 0, 0);

    return {
      ...row,
      spent,
      cashout,
      held,
      liability,
      inflow
    };
  });
}

function buildFinalizedRows(
  facts: ProjectedSimulationFact[],
  milestones: EffectiveMilestone[],
  baselineModel: SimulationBaselineModel
) {
  const lifecycleStages = buildLifecycleStages(facts);
  const factsByPeriod = new Map<string, ProjectedSimulationFact[]>();

  for (const fact of facts) {
    const rows = factsByPeriod.get(fact.periodKey) ?? [];
    rows.push(fact);
    factsByPeriod.set(fact.periodKey, rows);
  }

  return [...factsByPeriod.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, periodFacts]) => {
      const monthIndex = periodFacts[0]?.periodIndex ?? 1;
      const milestone = resolveMilestoneForMonth(monthIndex, milestones);
      const rawRows = buildRawRows(periodFacts, lifecycleStages, milestone.parameters, baselineModel);
      const userCappedRows = applyUserCaps(rawRows, milestone.parameters.capUserMonthly);
      const groupCappedRows = applyGroupCaps(userCappedRows, milestone.parameters.capGroupMonthly);

      return finalizeFactRows(groupCappedRows, milestone.parameters, baselineModel);
    });
}

function buildProjectedPoolFundingRows(
  facts: ProjectedSimulationFact[],
  poolPeriodFacts: DatasetPoolPeriodFact[] = []
) {
  if (poolPeriodFacts.length > 0) {
    const projectedPeriods = [...new Set(facts.map((fact) => fact.periodKey))].sort();
    const sourcePeriods = [...new Set(poolPeriodFacts.map((fact) => fact.periodKey))].sort();
    const factsBySourcePeriod = new Map<string, DatasetPoolPeriodFact[]>();

    for (const fact of poolPeriodFacts) {
      const sourcePeriodFacts = factsBySourcePeriod.get(fact.periodKey) ?? [];
      sourcePeriodFacts.push(fact);
      factsBySourcePeriod.set(fact.periodKey, sourcePeriodFacts);
    }

    return projectedPeriods.flatMap<PoolFundingPeriodRow>((projectedPeriodKey, index) => {
      const sourcePeriodKey = sourcePeriods[index % Math.max(sourcePeriods.length, 1)];

      if (!sourcePeriodKey) {
        return [];
      }

      return (factsBySourcePeriod.get(sourcePeriodKey) ?? [])
        .filter((fact) => fact.unit === "USD" && fact.fundingAmount > 0)
        .map((fact) => ({
          periodKey: projectedPeriodKey,
          sourceSystem: inferPoolSourceSystem(fact.poolCode),
          poolCode: fact.poolCode,
          fundingAmount: fact.fundingAmount
        }));
    });
  }

  const uniqueEntries = new Map<string, PoolFundingPeriodRow>();

  for (const fact of facts) {
    for (const entry of fact.poolFundingEntries ?? []) {
      if (!(entry.fundingAmount > 0)) {
        continue;
      }

      const sourceSystem = normalizeSourceSystem(fact.sourceSystem);
      const uniqueKey = [fact.periodKey, sourceSystem, entry.poolCode, entry.cycleKey].join("::");

      if (!uniqueEntries.has(uniqueKey)) {
        uniqueEntries.set(uniqueKey, {
          periodKey: fact.periodKey,
          sourceSystem,
          poolCode: entry.poolCode,
          fundingAmount: entry.fundingAmount
        });
      }
    }
  }

  return [...uniqueEntries.values()].sort((left, right) => {
    return (
      left.periodKey.localeCompare(right.periodKey) ||
      left.sourceSystem.localeCompare(right.sourceSystem) ||
      left.poolCode.localeCompare(right.poolCode)
    );
  });
}

function buildFinancialPeriodLedgers(
  rows: WorkingFactRow[],
  poolFundingRows: PoolFundingPeriodRow[]
) {
  const periodLedgers = new Map<string, FinancialPeriodLedger>();
  const activePeriods = new Set(rows.map((row) => row.periodKey));

  for (const row of rows) {
    const periodLedger =
      periodLedgers.get(row.periodKey) ??
      ({
        periodKey: row.periodKey,
        grossCashIn: 0,
        retainedRevenue: 0,
        partnerPayoutOut: 0,
        directRewardObligation: 0,
        poolFundingObligation: 0,
        actualPayoutOut: 0,
        productFulfillmentOut: 0,
        netTreasuryDelta: 0
      } satisfies FinancialPeriodLedger);

    periodLedger.grossCashIn += Math.max(row.grossCashInUsd ?? 0, 0);
    periodLedger.retainedRevenue += Math.max(
      row.retainedRevenueUsd ?? row.recognizedRevenueUsd ?? 0,
      0
    );
    periodLedger.partnerPayoutOut += Math.max(row.partnerPayoutOutUsd ?? 0, 0);
    periodLedger.directRewardObligation += Math.max(row.globalRewardUsd, 0);
    periodLedger.actualPayoutOut += Math.max(row.cashout, 0);
    periodLedger.productFulfillmentOut += Math.max(row.productFulfillmentOutUsd ?? 0, 0);

    periodLedgers.set(row.periodKey, periodLedger);
  }

  for (const poolFundingRow of poolFundingRows) {
    if (!activePeriods.has(poolFundingRow.periodKey)) {
      continue;
    }

    const periodLedger =
      periodLedgers.get(poolFundingRow.periodKey) ??
      ({
        periodKey: poolFundingRow.periodKey,
        grossCashIn: 0,
        retainedRevenue: 0,
        partnerPayoutOut: 0,
        directRewardObligation: 0,
        poolFundingObligation: 0,
        actualPayoutOut: 0,
        productFulfillmentOut: 0,
        netTreasuryDelta: 0
      } satisfies FinancialPeriodLedger);

    periodLedger.poolFundingObligation += Math.max(poolFundingRow.fundingAmount, 0);
    periodLedgers.set(poolFundingRow.periodKey, periodLedger);
  }

  return [...periodLedgers.values()]
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey))
    .map((ledger) => ({
      ...ledger,
      netTreasuryDelta:
        ledger.retainedRevenue -
        ledger.partnerPayoutOut -
        ledger.actualPayoutOut -
        ledger.productFulfillmentOut
    }));
}

function buildSummaryMetrics(
  rows: WorkingFactRow[],
  baselineModel: SimulationBaselineModel,
  poolFundingRows: PoolFundingPeriodRow[]
): SummaryMetrics {
  const summary = createDefaultSummaryMetrics();
  const issuedTotal = rows.reduce((total, row) => total + row.issued, 0);
  const spentTotal = rows.reduce((total, row) => total + row.spent, 0);
  const heldTotal = rows.reduce((total, row) => total + row.held, 0);
  const cashoutTotal = rows.reduce((total, row) => total + row.cashout, 0);
  const liabilityTotal = rows.reduce((total, row) => total + row.liability, 0);
  const inflowTotal = rows.reduce((total, row) => total + row.inflow, 0);
  const financialLedgers = buildFinancialPeriodLedgers(rows, poolFundingRows);
  const grossCashInTotal = financialLedgers.reduce((total, ledger) => total + ledger.grossCashIn, 0);
  const retainedRevenueTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.retainedRevenue,
    0
  );
  const partnerPayoutOutTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.partnerPayoutOut,
    0
  );
  const directRewardObligationTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.directRewardObligation,
    0
  );
  const poolFundingObligationTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.poolFundingObligation,
    0
  );
  const actualPayoutOutTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.actualPayoutOut,
    0
  );
  const productFulfillmentOutTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.productFulfillmentOut,
    0
  );
  const netTreasuryDeltaTotal = financialLedgers.reduce(
    (total, ledger) => total + ledger.netTreasuryDelta,
    0
  );
  const periodCount = Math.max(
    1,
    new Set(rows.map((row) => row.periodKey)).size
  );
  const issuedByMember = new Map<string, number>();

  for (const row of rows) {
    issuedByMember.set(row.memberKey, (issuedByMember.get(row.memberKey) ?? 0) + row.issued);
  }

  const memberTotals = [...issuedByMember.values()].sort((left, right) => right - left);
  const topCount = Math.max(1, Math.ceil(memberTotals.length * 0.1));
  const topIssued = memberTotals.slice(0, topCount).reduce((total, value) => total + value, 0);
  const payoutInflowRatio = computePayoutInflowRatio(liabilityTotal, inflowTotal);
  const monthlyInflow = inflowTotal / periodCount;
  const monthlyLiability = liabilityTotal / periodCount;
  const reserveRunwayMonths =
    monthlyLiability <= monthlyInflow
      ? baselineModel.treasuryRules.reserve_buffer_months +
        safeDivide(monthlyInflow - monthlyLiability, Math.max(monthlyLiability, 1)) * 6
      : safeDivide(
          monthlyInflow * baselineModel.treasuryRules.reserve_buffer_months,
          Math.max(monthlyLiability - monthlyInflow, monthlyLiability * 0.05)
        );

  summary.alpha_issued_total = roundMetric(issuedTotal);
  summary.alpha_spent_total = roundMetric(spentTotal);
  summary.alpha_held_total = roundMetric(heldTotal);
  summary.alpha_cashout_equivalent_total = roundMetric(cashoutTotal);
  summary.company_gross_cash_in_total = roundMetric(grossCashInTotal);
  summary.company_retained_revenue_total = roundMetric(retainedRevenueTotal);
  summary.company_partner_payout_out_total = roundMetric(partnerPayoutOutTotal);
  summary.company_direct_reward_obligation_total = roundMetric(directRewardObligationTotal);
  summary.company_pool_funding_obligation_total = roundMetric(poolFundingObligationTotal);
  summary.company_actual_payout_out_total = roundMetric(actualPayoutOutTotal);
  summary.company_product_fulfillment_out_total = roundMetric(productFulfillmentOutTotal);
  summary.company_net_treasury_delta_total = roundMetric(netTreasuryDeltaTotal);
  summary.sink_utilization_rate = roundMetric(safeDivide(spentTotal, issuedTotal) * 100);
  summary.payout_inflow_ratio = roundMetric(payoutInflowRatio);
  summary.reserve_runway_months = roundMetric(clamp(reserveRunwayMonths, 0, 24));
  summary.reward_concentration_top10_pct = roundMetric(safeDivide(topIssued, issuedTotal) * 100);

  return summary;
}

function buildTimeSeriesMetrics(
  rows: WorkingFactRow[],
  poolFundingRows: PoolFundingPeriodRow[]
): RunTimeSeriesMetric[] {
  const periodMap = new Map<
    string,
    {
      issued: number;
      spent: number;
      held: number;
      cashout: number;
      liability: number;
      inflow: number;
    }
  >();
  const financialLedgers = buildFinancialPeriodLedgers(rows, poolFundingRows);
  const financialByPeriod = new Map(
    financialLedgers.map((ledger) => [ledger.periodKey, ledger] as const)
  );

  for (const row of rows) {
    const period = periodMap.get(row.periodKey) ?? {
      issued: 0,
      spent: 0,
      held: 0,
      cashout: 0,
      liability: 0,
      inflow: 0
    };

    period.issued += row.issued;
    period.spent += row.spent;
    period.held += row.held;
    period.cashout += row.cashout;
    period.liability += row.liability;
    period.inflow += row.inflow;
    periodMap.set(row.periodKey, period);
  }

  return [...periodMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([periodKey, period]) => {
      const financialLedger = financialByPeriod.get(periodKey);

      return [
        {
          period_key: periodKey,
          metric_key: "alpha_issued_total",
          metric_value: roundMetric(period.issued)
        },
        {
          period_key: periodKey,
          metric_key: "alpha_spent_total",
          metric_value: roundMetric(period.spent)
        },
        {
          period_key: periodKey,
          metric_key: "alpha_held_total",
          metric_value: roundMetric(period.held)
        },
        {
          period_key: periodKey,
          metric_key: "alpha_cashout_equivalent_total",
          metric_value: roundMetric(period.cashout)
        },
        {
          period_key: periodKey,
          metric_key: "company_gross_cash_in_total",
          metric_value: roundMetric(financialLedger?.grossCashIn ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_retained_revenue_total",
          metric_value: roundMetric(financialLedger?.retainedRevenue ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_partner_payout_out_total",
          metric_value: roundMetric(financialLedger?.partnerPayoutOut ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_direct_reward_obligation_total",
          metric_value: roundMetric(financialLedger?.directRewardObligation ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_pool_funding_obligation_total",
          metric_value: roundMetric(financialLedger?.poolFundingObligation ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_actual_payout_out_total",
          metric_value: roundMetric(financialLedger?.actualPayoutOut ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_product_fulfillment_out_total",
          metric_value: roundMetric(financialLedger?.productFulfillmentOut ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "company_net_treasury_delta_total",
          metric_value: roundMetric(financialLedger?.netTreasuryDelta ?? 0)
        },
        {
          period_key: periodKey,
          metric_key: "payout_inflow_ratio",
          metric_value: roundMetric(computePayoutInflowRatio(period.liability, period.inflow))
        }
      ];
    });
}

function buildSegmentMetrics(
  rows: WorkingFactRow[],
  summary: SummaryMetrics,
  poolFundingRows: PoolFundingPeriodRow[]
): RunSegmentMetric[] {
  const segmentMetrics: RunSegmentMetric[] = [];
  const totalsByTier = new Map<string, number>();
  const totalsBySource = new Map<string, number>();
  const financialBySource = new Map<
    string,
    {
      grossCashIn: number;
      retainedRevenue: number;
      partnerPayoutOut: number;
      directRewardObligation: number;
      poolFundingObligation: number;
      actualPayoutOut: number;
      productFulfillmentOut: number;
      netTreasuryDelta: number;
    }
  >();
  const totalsByMilestone = new Map<
    string,
    {
      label: string;
      periodStart: string;
      periodEnd: string;
      issued: number;
      spent: number;
      cashout: number;
      liability: number;
      inflow: number;
    }
  >();

  for (const row of rows) {
    const tierKey = row.memberTier?.trim() || "unknown";
    totalsByTier.set(tierKey, (totalsByTier.get(tierKey) ?? 0) + row.issued);
    const normalizedSourceSystem = normalizeSourceSystem(row.sourceSystem);
    totalsBySource.set(normalizedSourceSystem, (totalsBySource.get(normalizedSourceSystem) ?? 0) + row.issued);
    const sourceFinancial =
      financialBySource.get(normalizedSourceSystem) ?? {
        grossCashIn: 0,
        retainedRevenue: 0,
        partnerPayoutOut: 0,
        directRewardObligation: 0,
        poolFundingObligation: 0,
        actualPayoutOut: 0,
        productFulfillmentOut: 0,
        netTreasuryDelta: 0
      };
    sourceFinancial.grossCashIn += Math.max(row.grossCashInUsd ?? 0, 0);
    sourceFinancial.retainedRevenue += Math.max(
      row.retainedRevenueUsd ?? row.recognizedRevenueUsd ?? 0,
      0
    );
    sourceFinancial.partnerPayoutOut += Math.max(row.partnerPayoutOutUsd ?? 0, 0);
    sourceFinancial.directRewardObligation += Math.max(row.globalRewardUsd, 0);
    sourceFinancial.actualPayoutOut += Math.max(row.cashout, 0);
    sourceFinancial.productFulfillmentOut += Math.max(row.productFulfillmentOutUsd ?? 0, 0);
    financialBySource.set(normalizedSourceSystem, sourceFinancial);
    const milestone = totalsByMilestone.get(row.milestoneKey) ?? {
      label: row.milestoneLabel,
      periodStart: row.periodKey,
      periodEnd: row.periodKey,
      issued: 0,
      spent: 0,
      cashout: 0,
      liability: 0,
      inflow: 0
    };
    milestone.periodStart = row.periodKey < milestone.periodStart ? row.periodKey : milestone.periodStart;
    milestone.periodEnd = row.periodKey > milestone.periodEnd ? row.periodKey : milestone.periodEnd;
    milestone.issued += row.issued;
    milestone.spent += row.spent;
    milestone.cashout += row.cashout;
    milestone.liability += row.liability;
    milestone.inflow += row.inflow;
    totalsByMilestone.set(row.milestoneKey, milestone);
  }

  for (const poolFundingRow of poolFundingRows) {
    const sourceFinancial =
      financialBySource.get(poolFundingRow.sourceSystem) ?? {
        grossCashIn: 0,
        retainedRevenue: 0,
        partnerPayoutOut: 0,
        directRewardObligation: 0,
        poolFundingObligation: 0,
        actualPayoutOut: 0,
        productFulfillmentOut: 0,
        netTreasuryDelta: 0
      };
    sourceFinancial.poolFundingObligation += Math.max(poolFundingRow.fundingAmount, 0);
    financialBySource.set(poolFundingRow.sourceSystem, sourceFinancial);
  }

  for (const [tierKey, issued] of [...totalsByTier.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    segmentMetrics.push({
      segment_type: "member_tier",
      segment_key: tierKey,
      metric_key: "reward_share_pct",
      metric_value: roundMetric(safeDivide(issued, summary.alpha_issued_total) * 100)
    });
  }

  for (const [sourceSystem, issued] of [...totalsBySource.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const financial = financialBySource.get(sourceSystem);

    segmentMetrics.push(
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "alpha_issued_total",
        metric_value: roundMetric(issued)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_gross_cash_in_total",
        metric_value: roundMetric(financial?.grossCashIn ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_retained_revenue_total",
        metric_value: roundMetric(financial?.retainedRevenue ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_partner_payout_out_total",
        metric_value: roundMetric(financial?.partnerPayoutOut ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_direct_reward_obligation_total",
        metric_value: roundMetric(financial?.directRewardObligation ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_pool_funding_obligation_total",
        metric_value: roundMetric(financial?.poolFundingObligation ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_actual_payout_out_total",
        metric_value: roundMetric(financial?.actualPayoutOut ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_product_fulfillment_out_total",
        metric_value: roundMetric(financial?.productFulfillmentOut ?? 0)
      },
      {
        segment_type: "source_system",
        segment_key: sourceSystem,
        metric_key: "company_net_treasury_delta_total",
        metric_value: roundMetric(
          (financial?.retainedRevenue ?? 0) -
            (financial?.partnerPayoutOut ?? 0) -
            (financial?.actualPayoutOut ?? 0) -
            (financial?.productFulfillmentOut ?? 0)
        )
      }
    );
  }

  for (const [milestoneKey, totals] of [...totalsByMilestone.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const segmentKey = `${totals.label} (${totals.periodStart} to ${totals.periodEnd})`;

    segmentMetrics.push(
      {
        segment_type: "milestone",
        segment_key: segmentKey,
        metric_key: "alpha_issued_total",
        metric_value: roundMetric(totals.issued)
      },
      {
        segment_type: "milestone",
        segment_key: segmentKey,
        metric_key: "alpha_spent_total",
        metric_value: roundMetric(totals.spent)
      },
      {
        segment_type: "milestone",
        segment_key: segmentKey,
        metric_key: "alpha_cashout_equivalent_total",
        metric_value: roundMetric(totals.cashout)
      },
      {
        segment_type: "milestone",
        segment_key: segmentKey,
        metric_key: "payout_inflow_ratio",
        metric_value: roundMetric(computePayoutInflowRatio(totals.liability, totals.inflow))
      }
    );
  }

  segmentMetrics.push(
    {
      segment_type: "alpha_behavior",
      segment_key: "hold",
      metric_key: "alpha_total",
      metric_value: roundMetric(summary.alpha_held_total)
    },
    {
      segment_type: "alpha_behavior",
      segment_key: "spend",
      metric_key: "alpha_total",
      metric_value: roundMetric(summary.alpha_spent_total)
    },
    {
      segment_type: "alpha_behavior",
      segment_key: "cashout",
      metric_key: "alpha_cashout_equivalent_total",
      metric_value: roundMetric(summary.alpha_cashout_equivalent_total)
    }
  );

  return segmentMetrics;
}

function buildMilestoneEvaluations(
  rows: WorkingFactRow[],
  baselineModel: SimulationBaselineModel,
  poolFundingRows: PoolFundingPeriodRow[]
): MilestoneEvaluation[] {
  const rowsByMilestone = new Map<string, WorkingFactRow[]>();

  for (const row of rows) {
    const milestoneRows = rowsByMilestone.get(row.milestoneKey) ?? [];
    milestoneRows.push(row);
    rowsByMilestone.set(row.milestoneKey, milestoneRows);
  }

  return [...rowsByMilestone.entries()]
    .map(([milestoneKey, milestoneRows]) => {
      const orderedRows = [...milestoneRows].sort((left, right) =>
        `${left.periodKey}::${left.memberKey}::${left.sourceSystem}`.localeCompare(
          `${right.periodKey}::${right.memberKey}::${right.sourceSystem}`
        )
      );
      const summary = buildSummaryMetrics(orderedRows, baselineModel, poolFundingRows);
      const flags = evaluateFlags(summary, baselineModel.recommendationThresholds);
      const recommendation = evaluateRecommendation(
        summary,
        flags,
        baselineModel.recommendationThresholds
      );
      const strategicEvaluation = evaluateStrategicObjectives({
        rows: orderedRows,
        summary,
        baselineModel
      });
      const periods = [...new Set(orderedRows.map((row) => row.periodKey))].sort();
      const strongObjectives = strategicEvaluation.strategic_objectives
        .filter((objective) => objective.status === "candidate")
        .map((objective) => objective.label);
      const weakObjectives = strategicEvaluation.strategic_objectives
        .filter((objective) => objective.status === "rejected")
        .map((objective) => objective.label);
      const milestoneFlags: RunFlag[] = flags.map((flag) => ({
        ...flag,
        period_key: flag.period_key ?? periods[periods.length - 1] ?? null
      }));

      return {
        milestone_key: milestoneKey,
        label: orderedRows[0]?.milestoneLabel ?? milestoneKey,
        start_period_key: periods[0] ?? "",
        end_period_key: periods[periods.length - 1] ?? "",
        policy_status: recommendation.policy_status,
        reasons: recommendation.reasons,
        summary_metrics: summary,
        flags: milestoneFlags,
        strong_objectives: strongObjectives,
        weak_objectives: weakObjectives
      };
    })
    .sort((left, right) => left.start_period_key.localeCompare(right.start_period_key));
}

export function simulateScenario(input: DatasetSimulationInput): SimulationRunResult {
  if (input.facts.length === 0) {
    throw new Error("Snapshot does not contain imported member-month facts.");
  }

  const sourcePeriods = [...new Set(input.facts.map((fact) => fact.periodKey))].sort();
  const horizonMonths = input.request.scenario.parameters.projection_horizon_months ?? sourcePeriods.length;
  const milestones = buildResolvedMilestones(
    input.request.scenario.parameters,
    input.baselineModel,
    horizonMonths
  );
  const projectedFacts = buildProjectedFacts(
    input.facts,
    input.request.scenario.parameters,
    milestones
  );
  const projectedPoolFundingRows = buildProjectedPoolFundingRows(
    projectedFacts,
    input.poolPeriodFacts ?? []
  );
  const finalizedRows = buildFinalizedRows(projectedFacts, milestones, input.baselineModel);
  const summary = buildSummaryMetrics(finalizedRows, input.baselineModel, projectedPoolFundingRows);
  const timeSeriesMetrics = buildTimeSeriesMetrics(finalizedRows, projectedPoolFundingRows);
  const segmentMetrics = buildSegmentMetrics(finalizedRows, summary, projectedPoolFundingRows);
  const milestoneEvaluations = buildMilestoneEvaluations(
    finalizedRows,
    input.baselineModel,
    projectedPoolFundingRows
  );
  const strategicEvaluation = evaluateStrategicObjectives({
    rows: finalizedRows,
    summary,
    baselineModel: input.baselineModel
  });
  const flags = evaluateFlags(summary, input.baselineModel.recommendationThresholds);
  const recommendation = evaluateRecommendation(
    summary,
    flags,
    input.baselineModel.recommendationThresholds
  );

  return {
    run_id: `${input.request.snapshotId}-${input.request.scenario.name.toLowerCase().replace(/\s+/g, "-")}`,
    status: "completed",
    summary_metrics: summary,
    strategic_metrics: strategicEvaluation.strategic_metrics,
    time_series_metrics: timeSeriesMetrics,
    segment_metrics: segmentMetrics,
    flags,
    recommendation_signals: recommendation,
    strategic_objectives: strategicEvaluation.strategic_objectives,
    milestone_evaluations: milestoneEvaluations
  };
}
