import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { getLatestDecisionPackForRun, getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import { Card, PageHeader } from "@bgc-alpha/ui";

import {
  DecisionLogGovernanceControl,
  RecommendedBaselineControls
} from "@/components/decision-pack-governance";
import { RunStatusRefresh } from "@/components/run-status-refresh";
import { requirePageUser } from "@/lib/auth-session";
import {
  getCanonicalGapStatusLabel,
  formatCommonMetricValue,
  getDecisionGovernanceStatusLabel,
  getDecisionLogStatusLabel,
  formatPlanningHorizonLabel,
  getEvidenceLevelLabel,
  getHistoricalTruthCoverageLabel,
  getPolicyStatusLabel,
  getRunReference,
  getSetupStatusLabel,
  getTruthClassificationLabel
} from "@/lib/common-language";
import {
  formatStrategicMetricValue,
  mergeDecisionLogWithResolutions,
  readCanonicalGapAudit,
  readDecisionLog,
  readDecisionLogResolutions,
  readMilestoneEvaluations,
  readDecisionPack,
  readHistoricalTruthCoverage,
  readRecommendedSetup,
  readStrategicObjectives,
  readTruthAssumptionMatrix
} from "@/lib/strategic-objectives";

function getVerdictStatus(status: string) {
  if (status === "candidate" || status === "approved") return "candidate";
  if (status === "risky" || status === "caution") return "risky";
  return "rejected";
}

function getCoverageBadge(status: string) {
  if (status === "strong" || status === "available") return "badge--candidate";
  if (status === "partial") return "badge--risky";
  return "badge--rejected";
}

function getDecisionLogBadge(status: string) {
  if (status === "fixed_truth") return "badge--info";
  if (status === "recommended") return "badge--candidate";
  if (status === "pending_founder") return "badge--risky";
  return "badge--rejected";
}

function getTruthClassificationBadge(classification: string) {
  if (classification === "historical_truth") return "badge--candidate";
  if (classification === "scenario_assumption") return "badge--risky";
  if (classification === "locked_boundary") return "badge--neutral";
  return "badge--info";
}

const cashflowBasisMetricKeys = [
  "company_gross_cash_in_total",
  "company_retained_revenue_total",
  "company_net_treasury_delta_total",
  "payout_inflow_ratio",
  "reserve_runway_months",
  "company_actual_payout_out_total"
] as const;

const cashflowBasisMetricLabels: Record<(typeof cashflowBasisMetricKeys)[number], string> = {
  company_actual_payout_out_total: "Actual Payout Out",
  company_gross_cash_in_total: "Gross Cash In",
  company_net_treasury_delta_total: "Net Treasury Delta",
  company_retained_revenue_total: "Retained Revenue",
  payout_inflow_ratio: "Treasury Pressure",
  reserve_runway_months: "Reserve Runway"
};

export default async function DecisionPackPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const user = await requirePageUser(["decision-pack.read"]);
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

  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const decisionPack = readDecisionPack(decisionPackRecord?.recommendationJson);
  const strategicObjectives = readStrategicObjectives(decisionPackRecord?.recommendationJson);
  const milestoneEvaluations = readMilestoneEvaluations(decisionPackRecord?.recommendationJson);
  const historicalTruthCoverage = readHistoricalTruthCoverage(decisionPackRecord?.recommendationJson);
  const canonicalGapAudit = readCanonicalGapAudit(decisionPackRecord?.recommendationJson);
  const recommendedSetup = readRecommendedSetup(decisionPackRecord?.recommendationJson);
  const decisionLog = mergeDecisionLogWithResolutions(
    readDecisionLog(decisionPackRecord?.recommendationJson),
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
  );
  const truthAssumptionMatrix = readTruthAssumptionMatrix(decisionPackRecord?.recommendationJson);
  const scenarioParameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
    reward_global_factor: baselineModel.defaults.reward_global_factor,
    reward_pool_factor: baselineModel.defaults.reward_pool_factor
  });
  const summaryByKey = new Map(
    run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const)
  );
  const cashflowBasisMetrics = cashflowBasisMetricKeys.map((key) => ({
    key,
    value: summaryByKey.get(key) ?? 0
  }));
  const canWriteScenarios = user.capabilities.includes("scenarios.write");
  const canWriteRuns = user.capabilities.includes("runs.write");
  const isAdoptedBaseline = run.scenario.adoptedBaselineRunId === run.id;
  const refreshActive = run.status === "QUEUED" || run.status === "RUNNING" || !decisionPack;
  const inlineResumeEnabled = Boolean(process.env.VERCEL) && user.capabilities.includes("runs.write");

  return (
    <>
      <RunStatusRefresh active={refreshActive} inlineResumeEnabled={inlineResumeEnabled} runId={run.id} />
      <PageHeader eyebrow="Decision Pack" title={`Decision Pack · ${getRunReference(runId)}`} description="Founder-facing evaluation output from this simulation run." />

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
            {/* Founder decision summary */}
            <Card className="span-12" title="Founder Decision Summary">
              <div className="decision-summary">
                <div className="decision-summary__verdict">
                  <span className="verdict-label" data-status={getVerdictStatus(decisionPack.policy_status)}>
                    {getPolicyStatusLabel(decisionPack.policy_status)}
                  </span>
                  <p>{decisionPack.recommendation}</p>
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
                    <span>Horizon</span>
                    <strong>{formatPlanningHorizonLabel(scenarioParameters.projection_horizon_months)}</strong>
                  </div>
                </div>
              </div>
            </Card>

            {/* Cashflow basis */}
            <Card className="span-12" title="Cashflow Basis">
              <p className="card-intro">
                Founder-facing cashflow evidence behind this recommendation. Fiat and cashflow values are shown in $.
              </p>
              <div className="decision-kpi-grid">
                {cashflowBasisMetrics.map((metric) => (
                  <div className="decision-kpi" key={metric.key}>
                    <span>{cashflowBasisMetricLabels[metric.key]}</span>
                    <strong>{formatCommonMetricValue(metric.key, metric.value)}</strong>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="span-12" title="Historical Truth Coverage">
              <p className="card-intro">
                Canonical and derived coverage behind this run. This keeps scenario recommendations tied to actual stored business evidence.
              </p>
              {historicalTruthCoverage ? (
                <>
                  <div className="decision-summary">
                    <div className="decision-summary__verdict">
                      <span className={`badge ${getCoverageBadge(historicalTruthCoverage.status)}`}>
                        {getHistoricalTruthCoverageLabel(historicalTruthCoverage.status)}
                      </span>
                      <p style={{ marginTop: "0.75rem" }}>{historicalTruthCoverage.summary}</p>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="table">
                      <thead><tr><th>Coverage Layer</th><th>Status</th><th>Detail</th></tr></thead>
                      <tbody>
                        {historicalTruthCoverage.rows.map((row) => (
                          <tr key={row.key}>
                            <td><strong>{row.label}</strong></td>
                            <td>
                              <span className={`badge ${getCoverageBadge(row.status)}`}>
                                {getHistoricalTruthCoverageLabel(row.status)}
                              </span>
                            </td>
                            <td>{row.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted">No historical truth coverage summary recorded yet.</p>
              )}
            </Card>

            <Card className="span-12" title="Recommended Pilot Envelope">
              <p className="card-intro">
                Structured recommended setup for this run. Historical truth stays fixed; only scenario levers and assumptions are proposed here.
              </p>
              {recommendedSetup ? (
                <>
                  <div className="decision-baseline-layout">
                    <div className="decision-summary">
                      <div className="decision-summary__verdict">
                        <span className="badge badge--candidate">{recommendedSetup.title}</span>
                        <p style={{ marginTop: "0.75rem" }}>{recommendedSetup.summary}</p>
                        <p className="muted" style={{ marginTop: "0.5rem" }}>
                          {isAdoptedBaseline
                            ? `This run is the current adopted pilot baseline for ${run.scenario.name}.`
                            : run.scenario.adoptedBaselineRunId
                              ? `Another run is currently adopted as the pilot baseline for ${run.scenario.name}.`
                              : `No adopted pilot baseline is locked yet for ${run.scenario.name}.`}
                        </p>
                        {run.scenario.adoptedBaselineAt ? (
                          <p className="muted" style={{ marginTop: "0.25rem" }}>
                            Adopted at {run.scenario.adoptedBaselineAt.toLocaleString("en-US")}
                            {run.scenario.adoptedBaselineNote ? ` · ${run.scenario.adoptedBaselineNote}` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <section className="decision-baseline-panel">
                      <div className="decision-baseline-panel__header">
                        <div>
                          <span className={`badge ${isAdoptedBaseline ? "badge--candidate" : "badge--neutral"}`}>
                            {isAdoptedBaseline ? "Current Pilot Baseline" : "Governance Action"}
                          </span>
                          <h4>Pilot Baseline Lock</h4>
                        </div>
                      </div>
                      <p className="card-intro">
                        Promote this recommendation from “best current run” into the current pilot baseline for the scenario.
                      </p>
                      <p className="muted">
                        {isAdoptedBaseline
                          ? "This run is already adopted as the current pilot baseline. Clear it only if you intentionally want to reopen baseline selection."
                          : "Adopt this run only when you want its setup to become the default pilot reference for founder-facing discussion."}
                      </p>
                      <RecommendedBaselineControls
                        canWrite={canWriteScenarios}
                        isAdoptedBaseline={isAdoptedBaseline}
                        runId={run.id}
                        scenarioId={run.scenario.id}
                      />
                    </section>
                  </div>
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="table">
                      <thead><tr><th>Setup Item</th><th>Value</th><th>Status</th><th>Rationale</th></tr></thead>
                      <tbody>
                        {recommendedSetup.items.map((item) => (
                          <tr key={item.parameter_key}>
                            <td><strong>{item.label}</strong></td>
                            <td>{item.value}</td>
                            <td>
                              <span className={`badge ${item.status === "recommended" ? "badge--candidate" : item.status === "caution" ? "badge--risky" : "badge--neutral"}`}>
                                {getSetupStatusLabel(item.status)}
                              </span>
                            </td>
                            <td>{item.rationale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {recommendedSetup.warnings.length > 0 ? (
                    <div style={{ marginTop: "1rem" }}>
                      <h4 style={{ marginBottom: "0.5rem" }}>Warnings</h4>
                      <ul className="issue-list">
                        {recommendedSetup.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="muted">No structured recommended setup recorded yet.</p>
              )}
            </Card>

            <Card className="span-12" title="Canonical Fidelity Audit">
              <p className="card-intro">
                Fidelity audit for rule families that still need stronger canonical/event-native closure before outputs are treated as final lock inputs.
              </p>
              {canonicalGapAudit ? (
                <>
                  <div className="decision-summary">
                    <div className="decision-summary__verdict">
                      <span className={`badge ${getCoverageBadge(canonicalGapAudit.readiness)}`}>
                        {getHistoricalTruthCoverageLabel(canonicalGapAudit.readiness)}
                      </span>
                      <p style={{ marginTop: "0.75rem" }}>{canonicalGapAudit.summary}</p>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="table">
                      <thead><tr><th>Rule Family</th><th>Status</th><th>Detail</th></tr></thead>
                      <tbody>
                        {canonicalGapAudit.rows.map((row) => (
                          <tr key={row.key}>
                            <td><strong>{row.label}</strong></td>
                            <td>
                              <span className={`badge ${getCoverageBadge(row.status)}`}>
                                {getCanonicalGapStatusLabel(row.status)}
                              </span>
                            </td>
                            <td>{row.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted">No canonical fidelity audit recorded yet.</p>
              )}
            </Card>

            <Card className="span-12" title="Decision Log">
              <p className="card-intro">
                Clear split between what is fixed by truth, what is recommended by current evidence, and what still needs founder or external follow-up.
              </p>
              {decisionLog.length === 0 ? (
                <p className="muted">No structured decision log recorded yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Decision Item</th><th>Generated Status</th><th>Governance State</th><th>Owner</th><th>Rationale / Resolution</th></tr></thead>
                    <tbody>
                      {decisionLog.map((entry) => (
                        <tr key={entry.key}>
                          <td><strong>{entry.title}</strong></td>
                          <td>
                            <span className={`badge ${getDecisionLogBadge(entry.status)}`}>
                              {getDecisionLogStatusLabel(entry.status)}
                            </span>
                          </td>
                          <td>
                            <div className="decision-log-governance">
                              <span className={`badge ${entry.governance_status === "accepted" ? "badge--candidate" : entry.governance_status === "rejected" ? "badge--rejected" : entry.governance_status === "deferred" ? "badge--risky" : "badge--neutral"}`}>
                                {getDecisionGovernanceStatusLabel(entry.governance_status ?? "draft")}
                              </span>
                              {entry.reviewed_at ? (
                                <span className="muted">
                                  Reviewed {new Date(entry.reviewed_at).toLocaleString("en-US")}
                                </span>
                              ) : (
                                <span className="muted">No governance review saved yet.</span>
                              )}
                              <DecisionLogGovernanceControl
                                canWrite={canWriteRuns}
                                decisionKey={entry.key}
                                initialOwner={entry.governance_owner}
                                initialResolutionNote={entry.resolution_note}
                                initialStatus={entry.governance_status}
                                runId={run.id}
                              />
                            </div>
                          </td>
                          <td>{entry.governance_owner || "Unassigned"}</td>
                          <td>
                            <div className="decision-log-rationale">
                              <span>{entry.rationale}</span>
                              {entry.resolution_note ? (
                                <span className="muted">
                                  Resolution note: {entry.resolution_note}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="span-12" title="Truth vs Assumption Matrix">
              <p className="card-intro">
                This matrix keeps historical truth, scenario levers, conditional assumptions, locked boundaries, and derived assessments visibly separate.
              </p>
              {truthAssumptionMatrix.length === 0 ? (
                <p className="muted">No truth vs assumption matrix recorded yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Item</th><th>Classification</th><th>Value</th><th>Note</th></tr></thead>
                    <tbody>
                      {truthAssumptionMatrix.map((item) => (
                        <tr key={item.key}>
                          <td><strong>{item.label}</strong></td>
                          <td>
                            <span className={`badge ${getTruthClassificationBadge(item.classification)}`}>
                              {getTruthClassificationLabel(item.classification)}
                            </span>
                          </td>
                          <td>{item.value}</td>
                          <td>{item.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Strategic Goals */}
            <Card className="span-12" title="Strategic Goals">
              {strategicObjectives.length === 0 ? (
                <p className="muted">No goal scorecards saved yet.</p>
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
                          <td><ul className="issue-list">{obj.reasons.map((reason) => <li key={`${obj.objective_key}-${reason}`}>{reason}</li>)}</ul></td>
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
                    <thead><tr><th>Milestone</th><th>Assessment</th><th>Pressure</th><th>Runway</th><th>Top 10%</th><th>Net Treasury Delta</th><th>Reasons</th></tr></thead>
                    <tbody>
                      {milestoneEvaluations.map((ms) => (
                        <tr key={ms.milestone_key}>
                          <td><strong>{ms.label}</strong><div className="muted" style={{ fontSize: "0.75rem" }}>{ms.start_period_key} → {ms.end_period_key}</div></td>
                          <td><span className={`badge badge--${ms.policy_status === "candidate" ? "candidate" : ms.policy_status === "risky" ? "risky" : "rejected"}`}>{getPolicyStatusLabel(ms.policy_status)}</span></td>
                          <td style={{ fontWeight: 600 }}>{formatCommonMetricValue("payout_inflow_ratio", ms.summary_metrics.payout_inflow_ratio)}</td>
                          <td>{formatCommonMetricValue("reserve_runway_months", ms.summary_metrics.reserve_runway_months)}</td>
                          <td>{formatCommonMetricValue("reward_concentration_top10_pct", ms.summary_metrics.reward_concentration_top10_pct)}</td>
                          <td style={{ fontWeight: 600 }}>{formatCommonMetricValue("company_net_treasury_delta_total", ms.summary_metrics.company_net_treasury_delta_total)}</td>
                          <td><ul className="issue-list">{ms.reasons.map((r) => <li key={`${ms.milestone_key}-${r}`}>{r}</li>)}</ul></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Scenario evidence vs blockers */}
            <Card className="span-8" title="Evaluated Scenario Basis" variant="status" statusColor="candidate">
              {decisionPack.preferred_settings.length === 0 ? <p className="muted">None.</p> : (
                <ul className="issue-list">
                  {decisionPack.preferred_settings.map((item) => (
                    <li key={item} style={{ color: "var(--status-candidate)" }}>{item}</li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="span-4" title="Blockers / Rejection Reasons" variant="status" statusColor="rejected">
              {decisionPack.rejected_settings.length === 0 ? <p className="muted">No blockers found for this scenario.</p> : (
                <ul className="issue-list">
                  {decisionPack.rejected_settings.map((item) => (
                    <li key={item} style={{ color: "var(--status-rejected)" }}>{item}</li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Unresolved */}
            <Card className="span-8" title="Unresolved Questions">
              {decisionPack.unresolved_questions.length === 0 ? <p className="muted">None.</p> : (
                <ul className="issue-list">
                  {decisionPack.unresolved_questions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Exports */}
            <Card className="span-4" title="Export Full Simulation Report">
              <p className="card-intro">
                Downloads the full run report: Summary, Treasury, Distribution, and Decision Pack.
              </p>
              <div className="stack-links" style={{ marginTop: "0.75rem" }}>
                <a href={`/api/runs/${run.id}/decision-pack/export?format=markdown`}>
                  Download Full Markdown
                </a>
                <a href={`/api/runs/${run.id}/decision-pack/export?format=csv`}>
                  Download Full CSV
                </a>
                <a href={`/api/runs/${run.id}/decision-pack/export?format=pdf`}>
                  Download Full PDF
                </a>
              </div>
            </Card>
          </>
        ) : null}
      </section>
    </>
  );
}
