import Link from "next/link";
import { notFound } from "next/navigation";

import { getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { scenarioParametersSchema } from "@bgc-alpha/schemas";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { RunStatusRefresh } from "@/components/run-status-refresh";
import {
  formatStrategicMetricValue,
  readMilestoneEvaluations,
  readDecisionPack,
  readStrategicObjectives,
  strategicObjectiveLabels
} from "@/lib/strategic-objectives";
import { SummaryMetricsChart } from "@/components/summary-metrics-chart";
import { requirePageUser } from "@/lib/auth-session";
import {
  formatPlanningHorizonLabel,
  getEvidenceLevelLabel,
  getPolicyStatusLabel,
  getRiskSeverityLabel,
  getRunReference,
  getRunStatusLabel
} from "@/lib/common-language";
import {
  formatSummaryMetricValue,
  summaryMetricDefinitions,
} from "@/lib/summary-metrics";

function getVerdictStatus(policyStatus: string) {
  if (policyStatus === "candidate" || policyStatus === "approved") return "candidate";
  if (policyStatus === "risky" || policyStatus === "caution") return "risky";
  if (policyStatus === "rejected" || policyStatus === "failed") return "rejected";
  return "neutral";
}

function getRunStatusTone(status: string) {
  if (status === "FAILED") return "rejected";
  if (status === "QUEUED" || status === "RUNNING") return "info";
  return "neutral";
}

function getGaugeStatus(key: string, value: number) {
  if (key === "payout_inflow_ratio") return value > 1.0 ? "danger" : value > 0.8 ? "warning" : "safe";
  if (key === "reserve_runway_months") return value < 6 ? "danger" : value < 12 ? "warning" : "safe";
  if (key === "sink_utilization_rate") return value < 20 ? "danger" : value < 30 ? "warning" : "safe";
  if (key === "reward_concentration_top10_pct") return value > 60 ? "danger" : value > 45 ? "warning" : "safe";
  return "safe";
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  await requirePageUser(["runs.read"]);
  const databaseConfigured = hasDatabaseUrl();

  if (!databaseConfigured) {
    return (
      <>
        <PageHeader eyebrow="Simulation runs" title={`Run ${runId}`} description="Configure the database before viewing stored run results." />
        <section className="page-grid">
          <Card className="span-12" title="Database setup required">
            <p className="muted">DATABASE_URL is required to load persisted run output.</p>
          </Card>
        </section>
      </>
    );
  }

  const run = await getRunById(runId);
  if (!run) notFound();

  const decisionPack = readDecisionPack(run.decisionPacks[0]?.recommendationJson);
  const strategicObjectives = readStrategicObjectives(run.decisionPacks[0]?.recommendationJson);
  const milestoneEvaluations = readMilestoneEvaluations(run.decisionPacks[0]?.recommendationJson);
  const scenarioParameters = scenarioParametersSchema.parse(run.scenario.parameterJson);
  const failureMessage = run.status === "FAILED" ? run.runNotes?.trim() || "Run failed without a recorded error." : null;
  const activeRefresh = run.status === "QUEUED" || run.status === "RUNNING" || (run.status === "COMPLETED" && !decisionPack);
  const policyStatusLabel = failureMessage ? "failed" : decisionPack?.policy_status ?? (run.status === "COMPLETED" ? "completed" : "pending");
  const verdictStatus = getVerdictStatus(policyStatusLabel);

  const summaryMetricsByKey = new Map(run.summaryMetrics.map((m) => [m.metricKey, m] as const));
  const orderedSummaryMetrics = summaryMetricDefinitions.map((def) => {
    const metric = summaryMetricsByKey.get(def.key);
    return { ...def, id: metric?.id ?? def.key, value: metric?.metricValue ?? 0 };
  });

  const signalMetrics = orderedSummaryMetrics.filter((m) => m.group === "signal");

  return (
    <>
      <RunStatusRefresh active={activeRefresh} />
      <PageHeader
        eyebrow="Simulation Result"
        title={`Run Summary · ${getRunReference(runId)}`}
        description="Policy verdict, treasury health, goal scorecards, and milestone checkpoints."
      />

      {/* Tab-like navigation */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item active">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item">Distribution</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {/* Verdict Hero */}
        <Card className="span-8" title="Policy Verdict">
          <div className="verdict-hero">
            <div>
              <span className="verdict-label" data-status={verdictStatus}>
                {getPolicyStatusLabel(policyStatusLabel)}
              </span>
              <div className="verdict-details">
                <p>Scenario: <strong>{run.scenario.name}</strong></p>
                <p className="muted" style={{ fontSize: "0.82rem" }}>Data: {run.snapshot.name} · Rule set: {run.modelVersion.versionName}</p>
              </div>
            </div>
          </div>
          {failureMessage ? <p className="error-text" style={{ padding: "0 1.5rem 1rem" }}>{failureMessage}</p> : null}
        </Card>

        {/* Run Info */}
        <Card className="span-4" title="Run Details">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span className={`badge badge--${getRunStatusTone(run.status)}`}>
              {getRunStatusLabel(run.status)}
            </span>
          </div>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Horizon: {formatPlanningHorizonLabel(scenarioParameters.projection_horizon_months)}<br />
            New members/mo: {scenarioParameters.cohort_assumptions.new_members_per_month}<br />
            Churn: {scenarioParameters.cohort_assumptions.monthly_churn_rate_pct}%
          </p>
          {scenarioParameters.milestone_schedule.length > 0 ? (
            <div style={{ marginTop: "0.5rem" }}>
              <p className="muted" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Milestones:</p>
              {scenarioParameters.milestone_schedule.map((ms) => (
                <p key={ms.milestone_key} className="muted" style={{ fontSize: "0.75rem", margin: "0.1rem 0" }}>
                  <strong>{ms.label}</strong>: month {ms.start_month}{ms.end_month ? `–${ms.end_month}` : "+"}
                </p>
              ))}
            </div>
          ) : null}
        </Card>

        {/* Gauge Cards */}
        <Card className="span-8" title="Health Signals">
          <div className="gauge-grid">
            {signalMetrics.map((metric) => (
              <div className="gauge-card" data-status={getGaugeStatus(metric.key, metric.value)} key={metric.id}>
                <p className="metric-label">{metric.shortLabel}</p>
                <p className="metric">{formatSummaryMetricValue(metric.key, metric.value)}</p>
                <p className="muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>{metric.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk Flags */}
        <Card className="span-4" title="Risk Flags">
          {failureMessage ? <p className="error-text">{failureMessage}</p> : null}
          {!failureMessage && run.flags.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>✓ No risk warnings.</p>
          ) : null}
          {!failureMessage && run.flags.length > 0 ? (
            <div className="flag-list">
              {run.flags.map((flag) => (
                <div className="flag-item" data-severity={flag.severity === "ERROR" ? "critical" : flag.severity === "WARNING" ? "warning" : "info"} key={flag.id}>
                  <span className="flag-label">{getRiskSeverityLabel(flag.severity)}</span>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{flag.message}</div>
                </div>
              ))}
            </div>
          ) : null}
          {decisionPack?.recommendation ? (
            <p style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>{decisionPack.recommendation}</p>
          ) : null}
        </Card>

        {/* Summary Metrics Chart */}
        <Card className="span-12" title="Summary Metrics">
          <SummaryMetricsChart metrics={orderedSummaryMetrics.map((m) => ({ key: m.key, value: m.value }))} />
          <table className="table">
            <thead><tr><th>Key Metric</th><th>Value</th></tr></thead>
            <tbody>
              {orderedSummaryMetrics.map((metric) => (
                <tr key={metric.id}>
                  <td>
                    <div className="summary-metric-label">
                      <strong>{metric.label}</strong>
                      <span className="muted">{metric.description}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatSummaryMetricValue(metric.key, metric.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Strategic Goals */}
        <Card className="span-12" title="Strategic Goals">
          {strategicObjectives.length === 0 ? (
            <p className="muted">Goal scorecards will appear once the recommendation pack is ready.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Objective</th><th>Assessment</th><th>Evidence</th><th>Score</th><th>Primary Metrics</th><th>Reasons</th></tr></thead>
                <tbody>
                  {strategicObjectives.map((obj) => (
                    <tr key={obj.objective_key}>
                      <td>{obj.label}</td>
                      <td><span className={`badge badge--${obj.status === "candidate" ? "candidate" : obj.status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(obj.status)}</span></td>
                      <td>{getEvidenceLevelLabel(obj.evidence_level)}</td>
                      <td style={{ fontWeight: 600 }}>{obj.score.toFixed(2)}</td>
                      <td><ul className="issue-list">{obj.primary_metrics.map((m) => <li key={`${obj.objective_key}-${m.metric_key}`}>{m.label}: {formatStrategicMetricValue(m.value, m.unit)}</li>)}</ul></td>
                      <td><ul className="issue-list">{obj.reasons.map((r) => <li key={`${obj.objective_key}-${r}`}>{r}</li>)}</ul></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Milestone Checkpoints */}
        <Card className="span-12" title="Milestone Checkpoints">
          {milestoneEvaluations.length === 0 ? (
            <p className="muted">Milestone results will appear once the recommendation pack is ready.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Milestone</th><th>Assessment</th><th>Pressure</th><th>Runway</th><th>Top 10%</th><th>Goals</th><th>Reasons</th></tr></thead>
                <tbody>
                  {milestoneEvaluations.map((ms) => (
                    <tr key={ms.milestone_key}>
                      <td><strong>{ms.label}</strong><div className="muted" style={{ fontSize: "0.75rem" }}>{ms.start_period_key} → {ms.end_period_key}</div></td>
                      <td><span className={`badge badge--${ms.policy_status === "candidate" ? "candidate" : ms.policy_status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(ms.policy_status)}</span></td>
                      <td style={{ fontWeight: 600 }}>{ms.summary_metrics.payout_inflow_ratio.toFixed(2)}x</td>
                      <td>{formatSummaryMetricValue("reserve_runway_months", ms.summary_metrics.reserve_runway_months)}</td>
                      <td>{ms.summary_metrics.reward_concentration_top10_pct.toFixed(2)}%</td>
                      <td>
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          <span style={{ color: "var(--status-candidate)" }}>Strong: </span>{ms.strong_objectives.length > 0 ? ms.strong_objectives.map((k) => strategicObjectiveLabels[k as keyof typeof strategicObjectiveLabels] ?? k).join(", ") : "none"}
                        </div>
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          <span style={{ color: "var(--status-risky)" }}>Weak: </span>{ms.weak_objectives.length > 0 ? ms.weak_objectives.map((k) => strategicObjectiveLabels[k as keyof typeof strategicObjectiveLabels] ?? k).join(", ") : "none"}
                        </div>
                      </td>
                      <td><ul className="issue-list">{ms.reasons.map((r) => <li key={`${ms.milestone_key}-${r}`}>{r}</li>)}</ul></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </section>
    </>
  );
}
