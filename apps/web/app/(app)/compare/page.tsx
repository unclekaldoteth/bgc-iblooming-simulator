import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { listCompletedRuns, processSimulationRun } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import { PageHeader } from "@bgc-alpha/ui";

import { CompareConsole } from "@/components/compare-console";
import { requirePageUser } from "@/lib/auth-session";
import { getScenarioModeCaveat, getScenarioModeLabel } from "@/lib/common-language";
import { compareMetricKeys, compareMetricOptimization } from "@/lib/compare-config";
import {
  formatStrategicMetricValue,
  mergeDecisionLogWithResolutions,
  readCanonicalGapAudit,
  readDecisionLog,
  readDecisionLogResolutions,
  readHistoricalTruthCoverage,
  readMilestoneEvaluations,
  readRecommendedSetup,
  readStrategicObjectives,
  readTruthAssumptionMatrix,
  strategicObjectiveLabels,
  strategicObjectiveOrder
} from "@/lib/strategic-objectives";

export default async function ComparePage() {
  await requirePageUser(["compare.read"]);
  const databaseConfigured = hasDatabaseUrl();
  let runs = databaseConfigured ? await listCompletedRuns() : [];

  if (databaseConfigured && process.env.VERCEL) {
    const runsMissingDecisionPack = runs.filter((run) => !run.decisionPacks[0]);

    if (runsMissingDecisionPack.length > 0) {
      await Promise.all(runsMissingDecisionPack.map((run) => processSimulationRun(run.id)));
      runs = await listCompletedRuns();
    }
  }

  // Pre-compute extras on the server (these depend on server-only JSON parsing)
  const runExtras = runs.map((run) => {
    const recJson = run.decisionPacks[0]?.recommendationJson;
    const baselineModel = resolveBaselineModelRuleset(
      run.modelVersion.rulesetJson,
      run.modelVersion.versionName
    );
    const parameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
      reward_global_factor: baselineModel.defaults.reward_global_factor,
      reward_pool_factor: baselineModel.defaults.reward_pool_factor
    });
    const strategicObjectives = readStrategicObjectives(recJson).map((obj) => ({
      objective_key: obj.objective_key,
      label: obj.label,
      status: obj.status,
      score: obj.score,
      evidence_level: obj.evidence_level,
      primary_metrics: obj.primary_metrics.map((metric) => `${metric.label}: ${formatStrategicMetricValue(metric.value, metric.unit)}`),
      reasons: obj.reasons,
    }));
    const milestoneEvaluations = readMilestoneEvaluations(recJson).map((ms) => ({
      milestone_key: ms.milestone_key,
      label: ms.label,
      start_period_key: ms.start_period_key,
      end_period_key: ms.end_period_key,
      policy_status: ms.policy_status,
      reasons: ms.reasons,
      summary_metrics: {
        alpha_cashout_equivalent_total: ms.summary_metrics.alpha_cashout_equivalent_total,
        company_actual_payout_out_total: ms.summary_metrics.company_actual_payout_out_total,
        company_gross_cash_in_total: ms.summary_metrics.company_gross_cash_in_total,
        company_net_treasury_delta_total: ms.summary_metrics.company_net_treasury_delta_total,
        payout_inflow_ratio: ms.summary_metrics.payout_inflow_ratio,
        reserve_runway_months: ms.summary_metrics.reserve_runway_months,
        reward_concentration_top10_pct: ms.summary_metrics.reward_concentration_top10_pct,
      },
    }));
    const verdict = recJson
      ? (recJson as Record<string, unknown>).policy_status as string ?? "pending"
      : "pending";
    return {
      runId: run.id,
      verdict,
      parameters: {
        ...parameters,
        scenario_mode_label: getScenarioModeLabel(parameters.scenario_mode),
        forecast_mode_caveat: getScenarioModeCaveat(parameters.scenario_mode),
        milestone_count: parameters.milestone_schedule.length,
        cohort_projection_label:
          parameters.cohort_assumptions.new_members_per_month === 0 &&
          parameters.cohort_assumptions.monthly_churn_rate_pct === 0 &&
          parameters.cohort_assumptions.monthly_reactivation_rate_pct === 0
            ? parameters.scenario_mode === "advanced_forecast"
              ? "on, but growth assumptions are still 0"
              : "off in Imported Data Only"
            : `${parameters.cohort_assumptions.new_members_per_month} new/mo · ${parameters.cohort_assumptions.monthly_churn_rate_pct}% churn · ${parameters.cohort_assumptions.monthly_reactivation_rate_pct}% reactivation`
      },
      strategicObjectives,
      milestoneEvaluations,
      historicalTruthCoverage: readHistoricalTruthCoverage(recJson),
      recommendedSetup: readRecommendedSetup(recJson),
      decisionLog: mergeDecisionLogWithResolutions(
        readDecisionLog(recJson),
        readDecisionLogResolutions(
          run.decisionLogResolutions.map((resolution) => ({
            decision_key: resolution.decisionKey,
            status: resolution.status.toLowerCase(),
            owner: resolution.owner ?? "",
            resolution_note: resolution.resolutionNote ?? null,
            reviewed_at: resolution.reviewedAt?.toISOString() ?? null,
            reviewed_by_user_id: resolution.reviewedByUserId ?? null
          }))
        )
      ),
      truthAssumptionMatrix: readTruthAssumptionMatrix(recJson),
      canonicalGapAudit: readCanonicalGapAudit(recJson),
      adoptedBaselineRunId: run.scenario.adoptedBaselineRunId ?? null,
      adoptedBaselineAt: run.scenario.adoptedBaselineAt?.toISOString() ?? null,
      adoptedBaselineNote: run.scenario.adoptedBaselineNote ?? null
    };
  });

  // Serialize runs for client component (only plain data, no functions)
  const clientRuns = runs.map((run) => ({
    id: run.id,
    status: run.status,
    completedAt: run.completedAt?.toLocaleString("en-US") ?? null,
    scenario: { name: run.scenario.name },
    snapshot: { name: run.snapshot.name },
    summaryMetrics: run.summaryMetrics.map((m) => ({
      metricKey: m.metricKey,
      metricValue: m.metricValue,
    })),
    segmentMetrics: run.segmentMetrics.map((m) => ({
      segmentType: m.segmentType,
      segmentKey: m.segmentKey,
      metricKey: m.metricKey,
      metricValue: m.metricValue,
    })),
  }));

  return (
    <>
      <PageHeader
        step={{ current: 4, total: 4, label: "Compare Results" }}
        title="Compare Results"
        description="Choose simulation results and compare money, risk, ALPHA flow, goals, and data quality."
      />

      {!databaseConfigured ? (
        <section className="page-grid">
          <div className="card span-12">
            <h3>Database setup required</h3>
            <p className="muted">DATABASE_URL is required to load completed results.</p>
          </div>
        </section>
      ) : null}

      {databaseConfigured && runs.length === 0 ? (
        <section className="page-grid">
          <div className="card span-12">
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>Nothing to compare yet</h3>
              <p>Launch simulations first, then compare results here.</p>
            </div>
          </div>
        </section>
      ) : null}

      {databaseConfigured && runs.length > 0 ? (
        <CompareConsole
          runs={clientRuns}
          metricKeys={compareMetricKeys}
          metricOptimization={compareMetricOptimization}
          strategicObjectiveOrder={strategicObjectiveOrder}
          strategicObjectiveLabels={strategicObjectiveLabels as Record<string, string>}
          runExtras={runExtras}
        />
      ) : null}
    </>
  );
}
