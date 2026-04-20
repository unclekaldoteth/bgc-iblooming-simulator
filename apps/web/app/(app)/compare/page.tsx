import { listCompletedRuns, processSimulationRun } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { PageHeader } from "@bgc-alpha/ui";

import { CompareConsole } from "@/components/compare-console";
import { requirePageUser } from "@/lib/auth-session";
import { compareMetricKeys, compareMetricOptimization } from "@/lib/compare-config";
import {
  formatStrategicMetricValue,
  readMilestoneEvaluations,
  readStrategicObjectives,
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
    const strategicObjectives = readStrategicObjectives(recJson).map((obj) => ({
      objective_key: obj.objective_key,
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
    return { runId: run.id, verdict, strategicObjectives, milestoneEvaluations };
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
        step={{ current: 4, total: 4, label: "Side-by-Side Analysis" }}
        title="Compare Runs"
        description="Select which scenarios to compare across key metrics, goal scores, and milestone checkpoints."
      />

      {!databaseConfigured ? (
        <section className="page-grid">
          <div className="card span-12">
            <h3>Database setup required</h3>
            <p className="muted">DATABASE_URL is required to load completed runs.</p>
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
