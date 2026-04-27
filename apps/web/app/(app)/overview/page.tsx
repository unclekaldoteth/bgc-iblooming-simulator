import Link from "next/link";

import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { listScenarios, listSnapshots, prisma } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { SummaryMetricsChart } from "@/components/summary-metrics-chart";
import { getScenarioModeCaveat, getScenarioModeLabel } from "@/lib/common-language";
import {
  formatSummaryMetricValue,
  summaryMetricDefinitions,
} from "@/lib/summary-metrics";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function OverviewPage() {
  const databaseConfigured = hasDatabaseUrl();
  const [
    snapshots,
    scenarios,
    runStatusGroups,
    archivedRunCount,
    latestCompletedRun,
  ] = databaseConfigured
    ? await Promise.all([
        listSnapshots({ includeArchived: true }),
        listScenarios({ includeArchived: true }),
        prisma.simulationRun.groupBy({
          by: ["status"],
          where: {
            archivedAt: null
          },
          _count: { _all: true },
        }),
        prisma.simulationRun.count({
          where: {
            archivedAt: {
              not: null
            }
          }
        }),
        prisma.simulationRun.findFirst({
          where: { status: "COMPLETED", archivedAt: null },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            completedAt: true,
            scenario: { select: { name: true, parameterJson: true } },
            snapshot: { select: { name: true } },
            modelVersion: { select: { versionName: true, rulesetJson: true } },
            summaryMetrics: {
              select: { id: true, metricKey: true, metricValue: true },
              orderBy: { metricKey: "asc" },
            },
            _count: {
              select: {
                summaryMetrics: true,
                timeSeries: true,
                segmentMetrics: true,
                flags: true,
                decisionPacks: true,
              },
            },
          },
        }),
      ])
    : [[], [], [], 0, null];

  const approvedSnapshots = snapshots.filter(
    (s) => !s.archivedAt && s.validationStatus === "APPROVED"
  ).length;
  const importedSnapshots = snapshots.filter(
    (s) => !s.archivedAt && s._count.memberMonthFacts > 0
  ).length;
  const readyScenarios = scenarios.filter((s) =>
    !s.archivedAt && Boolean(s.snapshotIdDefault)
  ).length;
  const archivedSnapshots = snapshots.filter((snapshot) => Boolean(snapshot.archivedAt)).length;
  const archivedScenarios = scenarios.filter((scenario) => Boolean(scenario.archivedAt)).length;

  const runCounts = { QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 };
  for (const group of runStatusGroups) {
    runCounts[group.status] = group._count._all;
  }
  const totalRuns = runCounts.QUEUED + runCounts.RUNNING + runCounts.COMPLETED + runCounts.FAILED;

  const latestRunSummaryMetrics = latestCompletedRun
    ? summaryMetricDefinitions.map((definition) => {
        const metric = latestCompletedRun.summaryMetrics.find(
          (item) => item.metricKey === definition.key
        );
        return { ...definition, id: metric?.id ?? definition.key, value: metric?.metricValue ?? 0 };
      })
    : [];
  const latestRunScenarioParameters = latestCompletedRun
    ? parseFounderSafeScenarioParameters(
        latestCompletedRun.scenario.parameterJson,
        {
          reward_global_factor: resolveBaselineModelRuleset(
            latestCompletedRun.modelVersion.rulesetJson,
            latestCompletedRun.modelVersion.versionName
          ).defaults.reward_global_factor,
          reward_pool_factor: resolveBaselineModelRuleset(
            latestCompletedRun.modelVersion.rulesetJson,
            latestCompletedRun.modelVersion.versionName
          ).defaults.reward_pool_factor
        }
      )
    : null;
  const latestRunModeCaveat = getScenarioModeCaveat(latestRunScenarioParameters?.scenario_mode);

  const systemBadge = !databaseConfigured
    ? "Setup required"
    : runCounts.COMPLETED > 0
      ? "Run outputs live"
      : readyScenarios > 0 && approvedSnapshots > 0
        ? "Ready to launch"
        : snapshots.length > 0 || scenarios.length > 0
          ? "Setup in progress"
          : "Awaiting first records";

  const statusColor = !databaseConfigured
    ? "neutral"
    : runCounts.COMPLETED > 0
      ? "candidate"
      : readyScenarios > 0 && approvedSnapshots > 0
        ? "info"
        : "neutral";

  return (
    <>
      <PageHeader
        eyebrow="Decision Console"
        title="Overview"
        description="System status, key metrics, and quick access to the simulation workflow."
      />

      <section className="page-grid">
        {/* KPI Cards */}
        <Card className="span-4" title="Snapshots" variant="metric">
          <p className="metric">{formatCount(snapshots.length)}</p>
          <p className="metric-sub">
            {approvedSnapshots} approved · {importedSnapshots} imported · {archivedSnapshots} archived
          </p>
        </Card>

        <Card className="span-4" title="Scenarios" variant="metric">
          <p className="metric">{formatCount(scenarios.length)}</p>
          <p className="metric-sub">
            {readyScenarios} ready to run · {archivedScenarios} archived
          </p>
        </Card>

        <Card className="span-4" title="Simulation Runs" variant="metric">
          <p className="metric">{formatCount(totalRuns)}</p>
          <p className="metric-sub">
            {runCounts.COMPLETED} completed · {runCounts.RUNNING} running · {runCounts.QUEUED} queued · {archivedRunCount} archived
          </p>
        </Card>

        {/* Quick Actions */}
        <Card className="span-4" title="Quick Actions">
          <div className="quick-actions">
            <Link href="/snapshots" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Upload Data
            </Link>
            <Link href="/scenarios" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /></svg>
              New Scenario
            </Link>
            <Link href="/compare" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
              Compare
            </Link>
          </div>
        </Card>

        {/* System Status */}
        <Card className="span-4" title="System Status">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span className={`status-dot${statusColor === "candidate" ? "" : statusColor === "info" ? " status-dot--info" : " status-dot--neutral"}`} />
            <span className={`badge badge--${statusColor === "candidate" ? "candidate" : statusColor === "info" ? "info" : "neutral"}`}>
              {systemBadge}
            </span>
          </div>
          {latestCompletedRun?.completedAt ? (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              Latest run completed {formatDate(latestCompletedRun.completedAt)}
            </p>
          ) : null}
          {!databaseConfigured ? (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              Connect DATABASE_URL to load data.
            </p>
          ) : null}
        </Card>

        {/* Workflow Guide */}
        <Card className="span-4" title="Workflow">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              { n: "1", label: "Upload & approve historical data", link: "/snapshots" },
              { n: "2", label: "Configure policy scenarios", link: "/scenarios" },
              { n: "3", label: "Compare results & decide", link: "/compare" },
            ].map((step) => (
              <Link key={step.n} href={step.link} style={{ display: "flex", alignItems: "center", gap: "0.55rem", padding: "0.4rem 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                <span className="nav-step-number">{step.n}</span>
                {step.label}
              </Link>
            ))}
          </div>
        </Card>

        {/* Latest Run Result */}
        <Card className="span-12" title="Latest Result">
          {!latestCompletedRun ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>No completed runs yet</h3>
              <p>Launch a simulation to see results here.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <strong style={{ fontSize: "0.95rem" }}>{latestCompletedRun.scenario.name}</strong>
                <span className="badge badge--accent">
                  {latestCompletedRun.snapshot.name}
                </span>
                {latestRunScenarioParameters ? (
                  <span className={`badge ${latestRunScenarioParameters.scenario_mode === "advanced_forecast" ? "badge--risky" : "badge--info"}`}>
                    {getScenarioModeLabel(latestRunScenarioParameters.scenario_mode)}
                  </span>
                ) : null}
              </div>
              {latestRunModeCaveat ? (
                <p className="muted" style={{ fontSize: "0.82rem", marginTop: "-0.25rem" }}>
                  {latestRunModeCaveat}
                </p>
              ) : null}
              <SummaryMetricsChart
                metrics={latestRunSummaryMetrics.map((m) => ({
                  key: m.key,
                  value: m.value,
                }))}
              />
              <table className="table">
                <thead>
                  <tr>
                    <th>Key Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRunSummaryMetrics.map((metric) => (
                    <tr key={metric.id}>
                      <td>{metric.label}</td>
                      <td style={{ fontWeight: 600 }}>
                        {formatSummaryMetricValue(metric.key, metric.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: "0.75rem" }}>
                <Link href={`/runs/${latestCompletedRun.id}`} className="ghost-button">
                  Open full run summary →
                </Link>
              </div>
            </>
          )}
        </Card>
      </section>
    </>
  );
}
