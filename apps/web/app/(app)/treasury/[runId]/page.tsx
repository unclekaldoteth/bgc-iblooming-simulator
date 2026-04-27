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
  getRunReference,
  simplifyResultText
} from "@/lib/common-language";
import { summaryMetricDefinitions } from "@/lib/summary-metrics";

function getGaugeStatus(key: string, value: number) {
  if (key === "payout_inflow_ratio") return value > 1.0 ? "danger" : value > 0.8 ? "warning" : "safe";
  if (key === "reserve_runway_months") return value < 6 ? "danger" : value < 12 ? "warning" : "safe";
  if (key === "sink_utilization_rate") return value < 20 ? "danger" : value < 30 ? "warning" : "safe";
  if (key === "reward_concentration_top10_pct") return value > 60 ? "danger" : value > 45 ? "warning" : "safe";
  if (key === "company_net_treasury_delta_total") return value < 0 ? "danger" : "safe";
  return "safe";
}

const treasuryPositionMetricKeys = [
  "company_gross_cash_in_total",
  "company_retained_revenue_total",
  "company_net_treasury_delta_total",
  "company_actual_payout_out_total"
] as const;

const obligationMetricKeys = [
  "company_partner_payout_out_total",
  "company_direct_reward_obligation_total",
  "company_pool_funding_obligation_total",
  "company_product_fulfillment_out_total",
  "company_actual_payout_out_total"
] as const;

const healthSignalMetricKeys = [
  "payout_inflow_ratio",
  "reserve_runway_months",
  "sink_utilization_rate",
  "reward_concentration_top10_pct"
] as const;

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

  const cashflowMetricKeys = summaryMetricDefinitions
    .filter((definition) => definition.group === "cashflow")
    .map((definition) => definition.key);

  const buildMetricRows = (keys: readonly string[]) => keys.map((key) => ({
    key,
    label: getCommonMetricLabel(key),
    description: summaryMetricDefinitions.find((d) => d.key === key)?.description ?? "",
    value: summary[key] ?? 0
  }));
  const treasuryPositionMetrics = buildMetricRows(treasuryPositionMetricKeys);
  const obligationMetrics = buildMetricRows(obligationMetricKeys);
  const healthSignalMetrics = buildMetricRows(healthSignalMetricKeys);
  const cashflowMetrics = buildMetricRows(cashflowMetricKeys);

  return (
    <>
      <PageHeader eyebrow="Treasury" title={`Treasury View · ${getRunReference(runId)}`} description="Treasury safety view: cash in, revenue kept, payouts, fulfillment cost, pressure, and runway." />

      {/* Tab nav */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item">Distribution</Link>
        <Link href={`/token-flow/${run.id}`} className="tab-item">Token Flow</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item active">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {/* Treasury Summary */}
        <Card className="span-12" title="Treasury Summary">
          <p className="card-intro">
            Money view for this result. Dollar values are shown in USD.
          </p>
          <div className="decision-kpi-grid">
            {treasuryPositionMetrics.map((metric) => (
              <div className="decision-kpi" data-status={getGaugeStatus(metric.key, metric.value)} key={metric.key}>
                <span>{metric.label}</span>
                <strong>{formatCommonMetricValue(metric.key, metric.value)}</strong>
              </div>
            ))}
          </div>
        </Card>

        {/* Cash Owed and Paid */}
        <Card className="span-8" title="Cash Owed and Paid">
          <table className="table">
            <thead><tr><th>Measure</th><th>Value</th></tr></thead>
            <tbody>
              {obligationMetrics.map((metric) => (
                <tr key={metric.key}>
                  <td>
                    <div className="summary-metric-label">
                      <strong>{metric.label}</strong>
                      <span className="muted">{metric.description}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCommonMetricValue(metric.key, metric.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Warnings */}
        <Card className="span-4" title="Warnings">
          {run.flags.length === 0 ? <p className="muted">No treasury warnings.</p> : null}
          {run.flags.length > 0 ? (
            <div className="flag-list">
              {run.flags.map((flag) => (
                <div className="flag-item" data-severity={flag.severity === "ERROR" ? "critical" : flag.severity === "WARNING" ? "warning" : "info"} key={flag.id}>
                  <span className="flag-label">{getRiskSeverityLabel(flag.severity)}</span>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{simplifyResultText(flag.message)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        {/* Treasury Health Signals */}
        <div className="span-12 gauge-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {healthSignalMetrics.map((metric) => (
            <div className="gauge-card" data-status={getGaugeStatus(metric.key, metric.value)} key={metric.key}>
              <p className="metric-label">{metric.label}</p>
              <p className="metric">{formatCommonMetricValue(metric.key, metric.value)}</p>
              <p className="muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>{metric.description}</p>
            </div>
          ))}
        </div>

        <Card className="span-12" title="Full Money Details">
          <p className="card-intro">
            Full money breakdown used by treasury and decision logic.
          </p>
          <table className="table">
            <thead><tr><th>Measure</th><th>Value</th></tr></thead>
            <tbody>
              {cashflowMetrics.map((metric) => (
                <tr key={metric.key}>
                  <td>
                    <div className="summary-metric-label">
                      <strong>{metric.label}</strong>
                      <span className="muted">{metric.description}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCommonMetricValue(metric.key, metric.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </>
  );
}
