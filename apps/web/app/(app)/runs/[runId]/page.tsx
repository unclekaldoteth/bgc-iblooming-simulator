import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { RunStatusRefresh } from "@/components/run-status-refresh";
import { AlphaDistributionChart } from "@/components/summary-metrics-chart";
import {
  readMilestoneEvaluations,
  readDecisionPack,
  readStrategicObjectives,
} from "@/lib/strategic-objectives";
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
  type SummaryMetricKey
} from "@/lib/summary-metrics";

function getVerdictStatus(policyStatus: string) {
  if (policyStatus === "candidate" || policyStatus === "approved") return "candidate";
  if (policyStatus === "risky" || policyStatus === "caution") return "risky";
  if (policyStatus === "rejected" || policyStatus === "failed") return "rejected";
  return "neutral";
}

function getGaugeStatus(key: string, value: number) {
  if (key === "payout_inflow_ratio") return value > 1.0 ? "danger" : value > 0.8 ? "warning" : "safe";
  if (key === "reserve_runway_months") return value < 6 ? "danger" : value < 12 ? "warning" : "safe";
  if (key === "sink_utilization_rate") return value < 20 ? "danger" : value < 30 ? "warning" : "safe";
  if (key === "reward_concentration_top10_pct") return value > 60 ? "danger" : value > 45 ? "warning" : "safe";
  if (key === "company_net_treasury_delta_total") return value < 0 ? "danger" : "safe";
  return "safe";
}

const businessOutcomeMetricKeys = [
  "company_gross_cash_in_total",
  "company_retained_revenue_total",
  "company_net_treasury_delta_total",
  "company_actual_payout_out_total"
] as const satisfies readonly SummaryMetricKey[];

const alphaOutcomeMetricKeys = [
  "alpha_issued_total",
  "alpha_spent_total",
  "alpha_held_total",
  "alpha_cashout_equivalent_total"
] as const satisfies readonly SummaryMetricKey[];

const healthSignalMetricKeys = [
  "payout_inflow_ratio",
  "reserve_runway_months",
  "sink_utilization_rate",
  "reward_concentration_top10_pct"
] as const satisfies readonly SummaryMetricKey[];

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const user = await requirePageUser(["runs.read"]);
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

  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const decisionPack = readDecisionPack(run.decisionPacks[0]?.recommendationJson);
  const strategicObjectives = readStrategicObjectives(run.decisionPacks[0]?.recommendationJson);
  const milestoneEvaluations = readMilestoneEvaluations(run.decisionPacks[0]?.recommendationJson);
  const scenarioParameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
    reward_global_factor: baselineModel.defaults.reward_global_factor,
    reward_pool_factor: baselineModel.defaults.reward_pool_factor
  });
  const failureMessage = run.status === "FAILED" ? run.runNotes?.trim() || "Run failed without a recorded error." : null;
  const activeRefresh = run.status === "QUEUED" || run.status === "RUNNING" || (run.status === "COMPLETED" && !decisionPack);
  const inlineResumeEnabled = Boolean(process.env.VERCEL) && user.capabilities.includes("runs.write");
  const policyStatusLabel = failureMessage ? "failed" : decisionPack?.policy_status ?? (run.status === "COMPLETED" ? "completed" : "pending");
  const verdictStatus = getVerdictStatus(policyStatusLabel);

  const summaryMetricsByKey = new Map(run.summaryMetrics.map((m) => [m.metricKey, m] as const));
  const orderedSummaryMetrics = summaryMetricDefinitions.map((def) => {
    const metric = summaryMetricsByKey.get(def.key);
    return { ...def, id: metric?.id ?? def.key, value: metric?.metricValue ?? 0 };
  });

  const orderedSummaryMetricsByKey = new Map(orderedSummaryMetrics.map((metric) => [metric.key, metric] as const));
  const getMetricRows = (keys: readonly SummaryMetricKey[]) =>
    keys.map((key) => orderedSummaryMetricsByKey.get(key)).filter((metric): metric is (typeof orderedSummaryMetrics)[number] => Boolean(metric));
  const businessOutcomeMetrics = getMetricRows(businessOutcomeMetricKeys);
  const alphaOutcomeMetrics = getMetricRows(alphaOutcomeMetricKeys);
  const healthSignalMetrics = getMetricRows(healthSignalMetricKeys);

  return (
    <>
      <RunStatusRefresh active={activeRefresh} inlineResumeEnabled={inlineResumeEnabled} runId={run.id} />
      <PageHeader
        eyebrow="Simulation Result"
        title={`Run Summary · ${getRunReference(runId)}`}
        description="Executive result, business outcome, ALPHA outcome, treasury health, and audit metrics."
      />

      {/* Tab-like navigation */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item active">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item">Distribution</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {/* Executive Result */}
        <Card className="span-12" title="Executive Result">
          <div className="decision-summary">
            <div className="decision-summary__verdict">
              <span className="verdict-label" data-status={verdictStatus}>
                {getPolicyStatusLabel(policyStatusLabel)}
              </span>
              <p>
                {failureMessage ?? decisionPack?.recommendation ?? "Simulation result is available. Decision pack recommendation is pending."}
              </p>
            </div>
            <div className="decision-summary__meta">
              <div>
                <span>Scenario</span>
                <strong>{run.scenario.name}</strong>
              </div>
              <div>
                <span>Data</span>
                <strong>{run.snapshot.name}</strong>
              </div>
              <div>
                <span>Rule Set</span>
                <strong>{run.modelVersion.versionName}</strong>
              </div>
              <div>
                <span>Run Status</span>
                <strong>{getRunStatusLabel(run.status)}</strong>
              </div>
              <div>
                <span>Horizon</span>
                <strong>{formatPlanningHorizonLabel(scenarioParameters.projection_horizon_months)}</strong>
              </div>
              <div>
                <span>Scenario Growth</span>
                <strong>
                  {scenarioParameters.cohort_assumptions.new_members_per_month} new/mo · {scenarioParameters.cohort_assumptions.monthly_churn_rate_pct}% churn
                </strong>
              </div>
            </div>
          </div>
        </Card>

        {/* Business Outcome */}
        <Card className="span-12" title="Business Outcome">
          <p className="card-intro">
            Company cashflow outcome from the simulation. Fiat and cashflow values are shown in $.
          </p>
          <div className="decision-kpi-grid decision-kpi-grid--four">
            {businessOutcomeMetrics.map((metric) => (
              <div className="decision-kpi" data-status={getGaugeStatus(metric.key, metric.value)} key={metric.id}>
                <span>{metric.shortLabel}</span>
                <strong>{formatSummaryMetricValue(metric.key, metric.value)}</strong>
              </div>
            ))}
          </div>
        </Card>

        {/* ALPHA Outcome */}
        <Card className="span-12" title="ALPHA Outcome">
          <p className="card-intro">
            Policy-token layer kept separate from company cashflow.
          </p>
          <div className="alpha-outcome-layout">
            <AlphaDistributionChart metrics={orderedSummaryMetrics.map((m) => ({ key: m.key, value: m.value }))} />
            <div className="decision-kpi-grid decision-kpi-grid--two alpha-outcome-kpis">
              {alphaOutcomeMetrics.map((metric) => (
                <div className="decision-kpi" key={metric.id}>
                  <span>{metric.shortLabel}</span>
                  <strong>{formatSummaryMetricValue(metric.key, metric.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Health Signals */}
        <Card className="span-8" title="Health & Risk Signals">
          <div className="gauge-grid">
            {healthSignalMetrics.map((metric) => (
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
            <p className="muted" style={{ fontSize: "0.85rem" }}>No risk warnings.</p>
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

        {/* Strategic Goals Snapshot */}
        <Card className="span-12" title="Strategic Goals Snapshot">
          {strategicObjectives.length === 0 ? (
            <p className="muted">Goal scorecards will appear once the recommendation pack is ready.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Objective</th><th>Assessment</th><th>Evidence</th><th>Score</th></tr></thead>
                <tbody>
                  {strategicObjectives.map((obj) => (
                    <tr key={obj.objective_key}>
                      <td>{obj.label}</td>
                      <td><span className={`badge badge--${obj.status === "candidate" ? "candidate" : obj.status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(obj.status)}</span></td>
                      <td>{getEvidenceLevelLabel(obj.evidence_level)}</td>
                      <td style={{ fontWeight: 600 }}>{obj.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Milestone Snapshot */}
        <Card className="span-12" title="Milestone Snapshot">
          {milestoneEvaluations.length === 0 ? (
            <p className="muted">Milestone results will appear once the recommendation pack is ready.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Milestone</th><th>Assessment</th><th>Pressure</th><th>Net Treasury Delta</th><th>Runway</th></tr></thead>
                <tbody>
                  {milestoneEvaluations.map((ms) => (
                    <tr key={ms.milestone_key}>
                      <td><strong>{ms.label}</strong><div className="muted" style={{ fontSize: "0.75rem" }}>{ms.start_period_key} → {ms.end_period_key}</div></td>
                      <td><span className={`badge badge--${ms.policy_status === "candidate" ? "candidate" : ms.policy_status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(ms.policy_status)}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatSummaryMetricValue("payout_inflow_ratio", ms.summary_metrics.payout_inflow_ratio)}</td>
                      <td style={{ fontWeight: 600 }}>{formatSummaryMetricValue("company_net_treasury_delta_total", ms.summary_metrics.company_net_treasury_delta_total)}</td>
                      <td>{formatSummaryMetricValue("reserve_runway_months", ms.summary_metrics.reserve_runway_months)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Full Summary Metrics */}
        <Card className="span-12" title="Full Summary Metrics">
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

      </section>
    </>
  );
}
