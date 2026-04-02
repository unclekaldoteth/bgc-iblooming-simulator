import Link from "next/link";
import { notFound } from "next/navigation";

import { getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { requirePageUser } from "@/lib/auth-session";
import {
  formatCommonMetricValue,
  getCommonMetricLabel,
  getRiskSeverityLabel,
  getRunReference
} from "@/lib/common-language";
import { summaryMetricDefinitions } from "@/lib/summary-metrics";

function getGaugeStatus(key: string, value: number) {
  if (key === "payout_inflow_ratio") return value > 1.0 ? "danger" : value > 0.8 ? "warning" : "safe";
  if (key === "reserve_runway_months") return value < 6 ? "danger" : value < 12 ? "warning" : "safe";
  if (key === "sink_utilization_rate") return value < 20 ? "danger" : value < 30 ? "warning" : "safe";
  if (key === "reward_concentration_top10_pct") return value > 60 ? "danger" : value > 45 ? "warning" : "safe";
  return "safe";
}

export default async function TreasuryPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  await requirePageUser(["runs.read"]);
  const databaseConfigured = hasDatabaseUrl();

  if (!databaseConfigured) {
    return (
      <>
        <PageHeader eyebrow="Treasury" title={`Treasury for ${runId}`} description="Configure the database before viewing treasury metrics." />
        <section className="page-grid">
          <Card className="span-12" title="Database setup required"><p className="muted">DATABASE_URL is required.</p></Card>
        </section>
      </>
    );
  }

  const run = await getRunById(runId);
  if (!run) notFound();

  const summary = Object.fromEntries(
    run.summaryMetrics.map((m) => [m.metricKey, m.metricValue])
  ) as Record<string, number>;

  const treasuryMetricKeys = [
    "alpha_cashout_equivalent_total",
    "sink_utilization_rate",
    "payout_inflow_ratio",
    "reserve_runway_months",
    "reward_concentration_top10_pct"
  ] as const;

  const treasuryMetrics = treasuryMetricKeys.map((key) => ({
    key,
    label: getCommonMetricLabel(key),
    description: summaryMetricDefinitions.find((d) => d.key === key)?.description ?? "",
    value: summary[key] ?? 0
  }));

  return (
    <>
      <PageHeader eyebrow="Treasury" title={`Treasury View · ${getRunReference(runId)}`} description="Payout pressure, reserve runway, and treasury risk for this simulation run." />

      {/* Tab nav */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item">Distribution</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item active">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {/* Gauge Cards */}
        <div className="span-12 gauge-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="gauge-card" data-status={getGaugeStatus("reserve_runway_months", summary.reserve_runway_months ?? 0)}>
            <p className="metric-label">Reserve Runway</p>
            <p className="metric">{formatCommonMetricValue("reserve_runway_months", summary.reserve_runway_months ?? 0)}</p>
            <p className="muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>Months remaining under this plan</p>
          </div>
          <div className="gauge-card" data-status={getGaugeStatus("payout_inflow_ratio", summary.payout_inflow_ratio ?? 0)}>
            <p className="metric-label">Treasury Pressure</p>
            <p className="metric">{formatCommonMetricValue("payout_inflow_ratio", summary.payout_inflow_ratio ?? 0)}</p>
            <p className="muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>Above 1.0 = outflow overtaking inflow</p>
          </div>
          <div className="gauge-card" data-status={getGaugeStatus("sink_utilization_rate", summary.sink_utilization_rate ?? 0)}>
            <p className="metric-label">Internal Use Rate</p>
            <p className="metric">{formatCommonMetricValue("sink_utilization_rate", summary.sink_utilization_rate ?? 0)}</p>
            <p className="muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>ALPHA used inside the ecosystem</p>
          </div>
        </div>

        {/* Metrics Table */}
        <Card className="span-8" title="Treasury Metrics">
          <table className="table">
            <thead><tr><th>Measure</th><th>Value</th></tr></thead>
            <tbody>
              {treasuryMetrics.map((m) => (
                <tr key={m.key}>
                  <td><div className="summary-metric-label"><strong>{m.label}</strong><span className="muted">{m.description}</span></div></td>
                  <td style={{ fontWeight: 600 }}>{formatCommonMetricValue(m.key, m.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Risk Flags */}
        <Card className="span-4" title="Risk Flags">
          {run.flags.length === 0 ? <p className="muted">✓ No treasury warnings.</p> : null}
          {run.flags.length > 0 ? (
            <div className="flag-list">
              {run.flags.map((flag) => (
                <div className="flag-item" data-severity={flag.severity === "ERROR" ? "critical" : flag.severity === "WARNING" ? "warning" : "info"} key={flag.id}>
                  <span className="flag-label">{getRiskSeverityLabel(flag.severity)}</span>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{flag.message}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>
    </>
  );
}
