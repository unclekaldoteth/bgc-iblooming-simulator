import Link from "next/link";
import { notFound } from "next/navigation";

import { getLatestDecisionPackForRun, getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { scenarioParametersSchema } from "@bgc-alpha/schemas";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { RunStatusRefresh } from "@/components/run-status-refresh";
import { requirePageUser } from "@/lib/auth-session";
import {
  formatPlanningHorizonLabel,
  getEvidenceLevelLabel,
  getPolicyStatusLabel,
  getRunReference,
  getRunStatusLabel
} from "@/lib/common-language";
import {
  formatStrategicMetricValue,
  readMilestoneEvaluations,
  readDecisionPack,
  readStrategicObjectives
} from "@/lib/strategic-objectives";

function getVerdictStatus(status: string) {
  if (status === "candidate" || status === "approved") return "candidate";
  if (status === "risky" || status === "caution") return "risky";
  return "rejected";
}

export default async function DecisionPackPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  await requirePageUser(["decision-pack.read"]);
  const databaseConfigured = hasDatabaseUrl();

  if (!databaseConfigured) {
    return (
      <>
        <PageHeader eyebrow="Decision pack" title={`Decision Pack for ${runId}`} description="Configure the database before viewing decision packs." />
        <section className="page-grid">
          <Card className="span-12" title="Database setup required"><p className="muted">DATABASE_URL is required.</p></Card>
        </section>
      </>
    );
  }

  const [run, decisionPackRecord] = await Promise.all([
    getRunById(runId),
    getLatestDecisionPackForRun(runId)
  ]);

  if (!run) notFound();

  const decisionPack = readDecisionPack(decisionPackRecord?.recommendationJson);
  const strategicObjectives = readStrategicObjectives(decisionPackRecord?.recommendationJson);
  const milestoneEvaluations = readMilestoneEvaluations(decisionPackRecord?.recommendationJson);
  const scenarioParameters = scenarioParametersSchema.parse(run.scenario.parameterJson);
  const refreshActive = run.status === "QUEUED" || run.status === "RUNNING" || !decisionPack;

  return (
    <>
      <RunStatusRefresh active={refreshActive} />
      <PageHeader eyebrow="Recommendation" title={`Recommendation Pack · ${getRunReference(runId)}`} description="Founder-facing recommendation output from this simulation run." />

      {/* Tab nav */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item">Distribution</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item active">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {!decisionPack ? (
          <Card className="span-12" title="Recommendation pending">
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <h3>Generating recommendation</h3>
              <p>This page will refresh automatically while the worker finishes.</p>
            </div>
          </Card>
        ) : null}

        {decisionPack ? (
          <>
            {/* Verdict */}
            <Card className="span-4" title="Policy Verdict">
              <span className="verdict-label" data-status={getVerdictStatus(decisionPack.policy_status)} style={{ fontSize: "1.5rem" }}>
                {getPolicyStatusLabel(decisionPack.policy_status)}
              </span>
              <p style={{ marginTop: "0.5rem", fontSize: "0.88rem" }}>{decisionPack.recommendation}</p>
            </Card>

            {/* Context */}
            <Card className="span-4" title="Context">
              <p style={{ fontSize: "0.88rem" }}>Scenario: <strong>{run.scenario.name}</strong></p>
              <p style={{ fontSize: "0.88rem" }}>Data: <strong>{run.snapshot.name}</strong></p>
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                Rule set: {run.modelVersion.versionName}<br />
                Horizon: {formatPlanningHorizonLabel(scenarioParameters.projection_horizon_months)}
              </p>
            </Card>

            {/* Exports */}
            <Card className="span-4" title="Export">
              <div className="stack-links">
                <a href={`/api/runs/${run.id}/decision-pack/export?format=markdown`}>
                  📄 Download Markdown
                </a>
                <a href={`/api/runs/${run.id}/decision-pack/export?format=csv`}>
                  📊 Download CSV
                </a>
                <a href={`/api/runs/${run.id}/decision-pack/export?format=pdf`}>
                  📋 Download PDF
                </a>
              </div>
            </Card>

            {/* Settings: Preferred vs Rejected */}
            <Card className="span-6" title="Preferred Settings" variant="status" statusColor="candidate">
              <ul className="issue-list">
                {decisionPack.preferred_settings.map((item) => (
                  <li key={item} style={{ color: "var(--status-candidate)" }}>{item}</li>
                ))}
              </ul>
            </Card>

            <Card className="span-6" title="Rejected Settings" variant="status" statusColor="rejected">
              {decisionPack.rejected_settings.length === 0 ? <p className="muted">None.</p> : (
                <ul className="issue-list">
                  {decisionPack.rejected_settings.map((item) => (
                    <li key={item} style={{ color: "var(--status-rejected)" }}>{item}</li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Unresolved */}
            <Card className="span-12" title="Unresolved Questions">
              <ul className="issue-list">
                {decisionPack.unresolved_questions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>

            {/* Strategic Goals */}
            <Card className="span-12" title="Strategic Goals">
              {strategicObjectives.length === 0 ? (
                <p className="muted">No goal scorecards saved yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Objective</th><th>Assessment</th><th>Evidence</th><th>Score</th><th>Primary Metrics</th></tr></thead>
                    <tbody>
                      {strategicObjectives.map((obj) => (
                        <tr key={obj.objective_key}>
                          <td>{obj.label}</td>
                          <td><span className={`badge badge--${obj.status === "candidate" ? "candidate" : obj.status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(obj.status)}</span></td>
                          <td>{getEvidenceLevelLabel(obj.evidence_level)}</td>
                          <td style={{ fontWeight: 600 }}>{obj.score.toFixed(2)}</td>
                          <td><ul className="issue-list">{obj.primary_metrics.map((m) => <li key={`${obj.objective_key}-${m.metric_key}`}>{m.label}: {formatStrategicMetricValue(m.value, m.unit)}</li>)}</ul></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Milestones */}
            <Card className="span-12" title="Milestone Checkpoints">
              {milestoneEvaluations.length === 0 ? (
                <p className="muted">No milestone results saved yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Milestone</th><th>Assessment</th><th>Pressure</th><th>Runway</th><th>Top 10%</th><th>Reasons</th></tr></thead>
                    <tbody>
                      {milestoneEvaluations.map((ms) => (
                        <tr key={ms.milestone_key}>
                          <td><strong>{ms.label}</strong><div className="muted" style={{ fontSize: "0.75rem" }}>{ms.start_period_key} → {ms.end_period_key}</div></td>
                          <td><span className={`badge badge--${ms.policy_status === "candidate" ? "candidate" : ms.policy_status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(ms.policy_status)}</span></td>
                          <td style={{ fontWeight: 600 }}>{ms.summary_metrics.payout_inflow_ratio.toFixed(2)}x</td>
                          <td>{formatPlanningHorizonLabel(ms.summary_metrics.reserve_runway_months)}</td>
                          <td>{ms.summary_metrics.reward_concentration_top10_pct.toFixed(2)}%</td>
                          <td><ul className="issue-list">{ms.reasons.map((r) => <li key={`${ms.milestone_key}-${r}`}>{r}</li>)}</ul></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : null}
      </section>
    </>
  );
}
