import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import {
  scenarioParametersSchema,
  type DecisionPack,
  type MilestoneEvaluation,
  type RunFlag,
  type SimulationRunRequest,
  type StrategicObjectiveScorecard,
  type SummaryMetrics
} from "@bgc-alpha/schemas";
import { evaluateRecommendation, simulateScenario } from "@bgc-alpha/simulation-core";

import { upsertRunDecisionPack } from "./decision-packs";
import { listSnapshotMemberMonthFacts } from "./snapshots";
import {
  getRunById,
  markRunFailed,
  markRunStarted,
  persistCompletedRun
} from "./runs";
import { writeAuditEvent } from "./audit";

function readMetadataRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function buildSummary(run: Awaited<ReturnType<typeof getRunById>>): SummaryMetrics {
  return {
    alpha_issued_total: run?.summaryMetrics.find((metric) => metric.metricKey === "alpha_issued_total")
      ?.metricValue ?? 0,
    alpha_spent_total: run?.summaryMetrics.find((metric) => metric.metricKey === "alpha_spent_total")
      ?.metricValue ?? 0,
    alpha_held_total: run?.summaryMetrics.find((metric) => metric.metricKey === "alpha_held_total")
      ?.metricValue ?? 0,
    alpha_cashout_equivalent_total:
      run?.summaryMetrics.find((metric) => metric.metricKey === "alpha_cashout_equivalent_total")
        ?.metricValue ?? 0,
    sink_utilization_rate:
      run?.summaryMetrics.find((metric) => metric.metricKey === "sink_utilization_rate")?.metricValue ?? 0,
    payout_inflow_ratio:
      run?.summaryMetrics.find((metric) => metric.metricKey === "payout_inflow_ratio")?.metricValue ?? 0,
    reserve_runway_months:
      run?.summaryMetrics.find((metric) => metric.metricKey === "reserve_runway_months")?.metricValue ?? 0,
    reward_concentration_top10_pct:
      run?.summaryMetrics.find((metric) => metric.metricKey === "reward_concentration_top10_pct")
        ?.metricValue ?? 0
  };
}

function buildFlags(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>): RunFlag[] {
  return run.flags.map((flag) => ({
    flag_type: flag.flagType,
    severity:
      flag.severity === "critical" || flag.severity === "warning" || flag.severity === "info"
        ? flag.severity
        : "warning",
    message: flag.message,
    period_key: flag.periodKey
  }));
}

function buildDecisionPack(
  run: NonNullable<Awaited<ReturnType<typeof getRunById>>>,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[]
): DecisionPack {
  const summary = buildSummary(run);
  const flags = buildFlags(run);
  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const recommendation = evaluateRecommendation(
    summary,
    flags,
    baselineModel.recommendationThresholds
  );
  const parameters = scenarioParametersSchema.parse(run.scenario.parameterJson);
  const strongObjectives = strategicObjectives.filter((objective) => objective.status === "candidate");
  const weakObjectives = strategicObjectives.filter((objective) => objective.status === "rejected");
  const proxyObjectives = strategicObjectives.filter((objective) => objective.evidence_level !== "direct");
  const failedMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status === "rejected");
  const riskyMilestones = milestoneEvaluations.filter((milestone) => milestone.policy_status === "risky");

  return {
    title: `${run.scenario.name} Decision Pack`,
    policy_status: recommendation.policy_status,
    recommendation:
      recommendation.policy_status === "candidate"
        ? strongObjectives.length > 0
          ? "This scenario stays within the current treasury thresholds and also shows strategic upside in at least one objective area."
          : "This scenario stays within the current treasury thresholds, but the strategic upside remains limited."
        : recommendation.policy_status === "risky"
          ? "This scenario is usable for discussion, but treasury or concentration flags still need founder review before adoption."
          : "This scenario breaches core treasury safety thresholds and should not be used as the pilot default.",
    preferred_settings: [
      `Snapshot: ${run.snapshot.name}`,
      `Template: ${run.scenario.templateType}`,
      `k_pc: ${parameters.k_pc}`,
      `k_sp: ${parameters.k_sp}`,
      `Cash-out mode: ${parameters.cashout_mode}`,
      `Sink target: ${parameters.sink_target}`,
      `Projection horizon: ${parameters.projection_horizon_months ?? "snapshot window"}`,
      `New members / month: ${parameters.cohort_assumptions.new_members_per_month}`,
      `Monthly churn: ${parameters.cohort_assumptions.monthly_churn_rate_pct}%`,
      `Monthly reactivation: ${parameters.cohort_assumptions.monthly_reactivation_rate_pct}%`,
      ...parameters.milestone_schedule.map(
        (milestone) =>
          `Milestone ${milestone.label}: starts month ${milestone.start_month}${
            milestone.end_month ? `, ends month ${milestone.end_month}` : ""
          }`
      ),
      ...milestoneEvaluations.map(
        (milestone) =>
          `Gate ${milestone.label}: ${milestone.policy_status} (${milestone.start_period_key} to ${milestone.end_period_key})`
      ),
      ...strongObjectives.map(
        (objective) =>
          `${objective.label}: ${objective.status} (${objective.score.toFixed(2)} / ${objective.evidence_level})`
      )
    ],
    rejected_settings: [
      ...flags.map((flag) => flag.message),
      ...failedMilestones.map(
        (milestone) =>
          `${milestone.label}: milestone gate failed (${milestone.reasons[0] ?? "Treasury thresholds are violated."})`
      ),
      ...weakObjectives.map(
        (objective) => `${objective.label}: ${objective.reasons[0] ?? "Strategic score is below threshold."}`
      )
    ],
    unresolved_questions: [
      "Confirm whether the pilot should keep the current cash-out baseline or use a windowed override.",
      "Confirm whether the sink target aligns with the initial utility scope approved for Phase 1.",
      ...riskyMilestones.map(
        (milestone) =>
          `${milestone.label}: milestone gate is risky and still needs founder review before promotion.`
      ),
      ...proxyObjectives.map(
        (objective) =>
          `${objective.label}: evidence level is ${objective.evidence_level}, so stronger source data is still needed.`
      )
    ],
    strategic_objectives: strategicObjectives,
    milestone_evaluations: milestoneEvaluations
  };
}

export async function generateDecisionPackForRun(
  runId: string,
  strategicObjectives: StrategicObjectiveScorecard[],
  milestoneEvaluations: MilestoneEvaluation[]
) {
  const run = await getRunById(runId);

  if (!run) {
    throw new Error(`Run ${runId} was not found.`);
  }

  const pack = buildDecisionPack(run, strategicObjectives, milestoneEvaluations);
  const savedPack = await upsertRunDecisionPack({
    runId,
    title: pack.title,
    recommendationJson: pack,
    createdBy: run.createdBy
  });

  await writeAuditEvent({
    actorUserId: run.createdBy,
    entityType: "decision_pack",
    entityId: savedPack.id,
    action: "decision_pack.generated",
    metadata: {
      runId,
      policyStatus: pack.policy_status
    }
  });

  return savedPack;
}

export async function processSimulationRun(runId: string) {
  const run = await getRunById(runId);

  if (!run) {
    throw new Error(`Run ${runId} was not found.`);
  }

  if (run.status === "COMPLETED") {
    if (!run.decisionPacks[0]) {
      await generateDecisionPackForRun(runId, [], []);
      return getRunById(runId);
    }

    return run;
  }

  if (run.status === "RUNNING") {
    return run;
  }

  const input: SimulationRunRequest = {
    snapshotId: run.snapshotId,
    baselineModelVersionId: run.modelVersionId,
    scenario: {
      id: run.scenario.id,
      name: run.scenario.name,
      template: run.scenario.templateType as "Baseline" | "Conservative" | "Growth" | "Stress",
      parameters: scenarioParametersSchema.parse(run.scenario.parameterJson)
    }
  };

  try {
    await markRunStarted(runId);

    const facts = await listSnapshotMemberMonthFacts(run.snapshotId);
    const baselineModel = resolveBaselineModelRuleset(
      run.modelVersion.rulesetJson,
      run.modelVersion.versionName
    );

    const result = simulateScenario({
      request: input,
      facts: facts.map((fact) => ({
        ...(readMetadataRecord(fact.metadataJson)
          ? {
              recognizedRevenueUsd: readOptionalNumber(
                readMetadataRecord(fact.metadataJson)?.recognizedRevenueUsd
              ),
              grossMarginUsd: readOptionalNumber(
                readMetadataRecord(fact.metadataJson)?.grossMarginUsd
              ),
              memberJoinPeriod: readOptionalString(
                readMetadataRecord(fact.metadataJson)?.memberJoinPeriod
              ),
              isAffiliate: readOptionalBoolean(readMetadataRecord(fact.metadataJson)?.isAffiliate),
              crossAppActive: readOptionalBoolean(
                readMetadataRecord(fact.metadataJson)?.crossAppActive
              )
            }
          : {}),
        periodKey: fact.periodKey,
        memberKey: fact.memberKey,
        sourceSystem: fact.sourceSystem,
        memberTier: fact.memberTier,
        groupKey: fact.groupKey,
        pcVolume: fact.pcVolume,
        spRewardBasis: fact.spRewardBasis,
        globalRewardUsd: fact.globalRewardUsd,
        poolRewardUsd: fact.poolRewardUsd,
        cashoutUsd: fact.cashoutUsd,
        sinkSpendUsd: fact.sinkSpendUsd,
        activeMember: fact.activeMember
      })),
      baselineModel
    });

    const persistedRun = await persistCompletedRun(runId, {
      summaryMetrics: {
        ...result.summary_metrics,
        ...result.strategic_metrics
      },
      timeSeriesMetrics: result.time_series_metrics,
      segmentMetrics: result.segment_metrics,
      flags: result.flags,
      recommendationSignals: result.recommendation_signals,
      runNotes: `policy_status=${result.recommendation_signals.policy_status}`
    });

    await generateDecisionPackForRun(
      runId,
      result.strategic_objectives as StrategicObjectiveScorecard[],
      result.milestone_evaluations as MilestoneEvaluation[]
    );

    await writeAuditEvent({
      actorUserId: persistedRun.createdBy,
      entityType: "simulation_run",
      entityId: runId,
      action: "run.completed",
      metadata: {
        policyStatus: result.recommendation_signals.policy_status,
        flagCount: result.flags.length
      }
    });

    return getRunById(runId);
  } catch (error) {
    await markRunFailed(runId, error instanceof Error ? error.message : "worker_run_failed");
    await writeAuditEvent({
      actorUserId: run.createdBy,
      entityType: "simulation_run",
      entityId: runId,
      action: "run.failed",
      metadata: {
        message: error instanceof Error ? error.message : "worker_run_failed"
      }
    });
    throw error;
  }
}
