import Link from "next/link";
import { notFound } from "next/navigation";

import { getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { AlphaDistributionChart } from "@/components/summary-metrics-chart";
import { requirePageUser } from "@/lib/auth-session";
import {
  formatCommonMetricValue,
  getCommonMetricLabel,
  getRunReference,
  getSegmentKeyLabel,
  getSegmentTypeLabel
} from "@/lib/common-language";
import {
  formatSummaryMetricValue,
  type SummaryMetricKey
} from "@/lib/summary-metrics";

const alphaDistributionMetricKeys = [
  "alpha_issued_total",
  "alpha_spent_total",
  "alpha_held_total",
  "alpha_cashout_equivalent_total"
] as const satisfies readonly SummaryMetricKey[];

const tierConcentrationWarningPct = 60;

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

function formatPercent(value: number) {
  return `${percentFormatter.format(value)}%`;
}

function getConcentrationStatus(value: number) {
  if (value >= tierConcentrationWarningPct) return "danger";
  if (value >= 45) return "warning";
  return "safe";
}

function getBarWidth(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max(4, Math.min(100, (value / maxValue) * 100));
}

export default async function DistributionPage({
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
        <PageHeader eyebrow="Distribution" title={`Distribution for ${runId}`} description="Configure the database before viewing segment metrics." />
        <section className="page-grid">
          <Card className="span-12" title="Database setup required"><p className="muted">DATABASE_URL is required.</p></Card>
        </section>
      </>
    );
  }

  const run = await getRunById(runId);
  if (!run) notFound();

  const groupedSegments = run.segmentMetrics.reduce<Record<string, typeof run.segmentMetrics>>(
    (acc, metric) => {
      const key = metric.segmentType;
      acc[key] ??= [];
      acc[key].push(metric);
      return acc;
    },
    {}
  );
  const summaryMetricsByKey = new Map(
    run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue])
  );
  const getSummaryValue = (key: SummaryMetricKey) => summaryMetricsByKey.get(key) ?? 0;
  const alphaChartMetrics = alphaDistributionMetricKeys.map((key) => ({
    key,
    value: getSummaryValue(key)
  }));
  const totalAlphaIssued = getSummaryValue("alpha_issued_total");
  const getSegmentMetrics = (segmentType: string) => groupedSegments[segmentType] ?? [];

  const memberTierRows = getSegmentMetrics("member_tier")
    .filter((metric) => metric.metricKey === "reward_share_pct")
    .map((metric) => ({
      id: metric.id,
      key: metric.segmentKey,
      label: getSegmentKeyLabel(metric.segmentKey),
      share: metric.metricValue
    }))
    .sort((left, right) => right.share - left.share);
  const largestTier = memberTierRows[0] ?? null;
  const largestTierStatus = getConcentrationStatus(largestTier?.share ?? 0);
  const unclassifiedTier = memberTierRows.find((row) => row.key === "unknown") ?? null;

  const sourceBuckets = new Map<
    string,
    {
      label: string;
      alphaIssued: number;
      grossCashIn: number;
      retainedRevenue: number;
      partnerPayoutOut: number;
      actualPayoutOut: number;
      productFulfillmentOut: number;
      netTreasuryDelta: number;
    }
  >();

  for (const metric of getSegmentMetrics("source_system")) {
    const bucket =
      sourceBuckets.get(metric.segmentKey) ??
      {
        label: getSegmentKeyLabel(metric.segmentKey),
        alphaIssued: 0,
        grossCashIn: 0,
        retainedRevenue: 0,
        partnerPayoutOut: 0,
        actualPayoutOut: 0,
        productFulfillmentOut: 0,
        netTreasuryDelta: 0
      };

    if (metric.metricKey === "alpha_issued_total") bucket.alphaIssued = metric.metricValue;
    if (metric.metricKey === "company_gross_cash_in_total") bucket.grossCashIn = metric.metricValue;
    if (metric.metricKey === "company_retained_revenue_total") bucket.retainedRevenue = metric.metricValue;
    if (metric.metricKey === "company_partner_payout_out_total") bucket.partnerPayoutOut = metric.metricValue;
    if (metric.metricKey === "company_actual_payout_out_total") bucket.actualPayoutOut = metric.metricValue;
    if (metric.metricKey === "company_product_fulfillment_out_total") {
      bucket.productFulfillmentOut = metric.metricValue;
    }
    if (metric.metricKey === "company_net_treasury_delta_total") bucket.netTreasuryDelta = metric.metricValue;

    sourceBuckets.set(metric.segmentKey, bucket);
  }

  const sourceRows = [...sourceBuckets.entries()]
    .map(([key, source]) => ({
      key,
      ...source,
      issuedShare: totalAlphaIssued > 0 ? (source.alphaIssued / totalAlphaIssued) * 100 : 0
    }))
    .sort((left, right) => right.alphaIssued - left.alphaIssued);
  const largestSource = sourceRows[0] ?? null;

  const phaseBuckets = new Map<
    string,
    {
      issued: number;
      spent: number;
      cashout: number;
      pressure: number;
    }
  >();

  for (const metric of getSegmentMetrics("milestone")) {
    const bucket =
      phaseBuckets.get(metric.segmentKey) ??
      {
        issued: 0,
        spent: 0,
        cashout: 0,
        pressure: 0
      };

    if (metric.metricKey === "alpha_issued_total") bucket.issued = metric.metricValue;
    if (metric.metricKey === "alpha_spent_total") bucket.spent = metric.metricValue;
    if (metric.metricKey === "alpha_cashout_equivalent_total" || metric.metricKey === "usd_equivalent_total") {
      bucket.cashout = metric.metricValue;
    }
    if (metric.metricKey === "payout_inflow_ratio") bucket.pressure = metric.metricValue;

    phaseBuckets.set(metric.segmentKey, bucket);
  }

  const phaseRows = [...phaseBuckets.entries()].map(([phase, values]) => ({ phase, ...values }));
  const rawSegmentEntries = Object.entries(groupedSegments);

  return (
    <>
      <PageHeader
        eyebrow="Distribution"
        title={`Distribution View · ${getRunReference(runId)}`}
        description="Shows where ALPHA is issued, used, held, cashed out, and which source carries the largest cash impact."
      />

      {/* Tab nav */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item active">Distribution</Link>
        <Link href={`/token-flow/${run.id}`} className="tab-item">Token Flow</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {rawSegmentEntries.length === 0 ? (
          <Card className="span-12" title="No breakdown data">
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>No breakdown rows</h3>
              <p>Breakdowns will appear once the result completes.</p>
            </div>
          </Card>
        ) : null}

        {rawSegmentEntries.length > 0 ? (
          <>
            <Card className="span-12" title="Distribution Snapshot">
              <p className="card-intro">
                Quick view of ALPHA concentration before the detailed breakdown.
              </p>
              <div className="decision-kpi-grid">
                <div className="decision-kpi">
                  <span>Issued</span>
                  <strong>{formatSummaryMetricValue("alpha_issued_total", totalAlphaIssued)}</strong>
                </div>
                <div className="decision-kpi">
                  <span>Held</span>
                  <strong>{formatSummaryMetricValue("alpha_held_total", getSummaryValue("alpha_held_total"))}</strong>
                </div>
                <div className="decision-kpi">
                  <span>Used</span>
                  <strong>{formatSummaryMetricValue("alpha_spent_total", getSummaryValue("alpha_spent_total"))}</strong>
                </div>
                <div className="decision-kpi">
                  <span>ALPHA Cash-Out</span>
                  <strong>
                    {formatSummaryMetricValue("alpha_cashout_equivalent_total", getSummaryValue("alpha_cashout_equivalent_total"))}
                  </strong>
                </div>
                <div className="decision-kpi" data-status={largestTierStatus}>
                  <span>Largest Member Group</span>
                  <strong>{largestTier ? `${largestTier.label} · ${formatPercent(largestTier.share)}` : "Not available"}</strong>
                </div>
                <div className="decision-kpi">
                  <span>Largest Source</span>
                  <strong>
                    {largestSource ? `${largestSource.label} · ${formatPercent(largestSource.issuedShare)}` : "Not available"}
                  </strong>
                </div>
              </div>
            </Card>

            <Card className="span-6" title="ALPHA Flow">
              <p className="card-intro">
                ALPHA only: held, used, and sent to cash-out.
              </p>
              <AlphaDistributionChart metrics={alphaChartMetrics} />
            </Card>

            <Card className="span-6" title="Member Group Concentration">
              <div className="distribution-section-header">
                <p className="card-intro">
                  Share of issued ALPHA by member group, sorted from largest to smallest.
                </p>
                {largestTier && largestTier.share >= tierConcentrationWarningPct ? (
                  <span className="badge badge--risky">High concentration</span>
                ) : (
                  <span className="badge badge--candidate">Balanced</span>
                )}
              </div>

              {memberTierRows.length > 0 ? (
                <>
                  <div className="distribution-bar-list">
                    {memberTierRows.map((row) => (
                      <div className="distribution-bar-row" key={row.id}>
                        <div className="distribution-bar-copy">
                          <strong>{row.label}</strong>
                          <span>{formatPercent(row.share)}</span>
                        </div>
                        <div className="distribution-bar-track" aria-hidden="true">
                          <div
                            className="distribution-bar-fill"
                            data-status={getConcentrationStatus(row.share)}
                            style={{ width: `${getBarWidth(row.share, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {unclassifiedTier ? (
                    <p className="muted">
                      Unclassified means the uploaded row has no <code>member_tier</code>, so its ALPHA is grouped
                      separately until member group mapping is completed.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted">No member group breakdown available.</p>
              )}
            </Card>

            <Card className="span-12" title="Source Split">
              <p className="card-intro">
                ALPHA movement and company money are separated so points and dollars do not get mixed.
              </p>
              <div className="distribution-source-grid">
                <section className="distribution-subpanel" aria-label="ALPHA by source">
                  <h4>ALPHA by Source</h4>
                  {sourceRows.length > 0 ? (
                    <div className="distribution-bar-list">
                      {sourceRows.map((row) => (
                        <div className="distribution-bar-row" key={row.key}>
                          <div className="distribution-bar-copy">
                            <strong>{row.label}</strong>
                            <span>{formatSummaryMetricValue("alpha_issued_total", row.alphaIssued)} · {formatPercent(row.issuedShare)}</span>
                          </div>
                          <div className="distribution-bar-track" aria-hidden="true">
                            <div
                              className="distribution-bar-fill"
                              data-status="safe"
                              style={{ width: `${getBarWidth(row.issuedShare, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No source-level ALPHA rows available.</p>
                  )}
                </section>

                <section className="distribution-subpanel" aria-label="Money by source">
                  <h4>Money by Source</h4>
                  <p className="muted">
                    Net Cash Change = Revenue Kept - Cash Paid Out - Fulfillment Cost. Partner Payout is shown
                    separately and is already excluded from Revenue Kept.
                  </p>
                  {sourceRows.length > 0 ? (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Source</th>
                            <th>Cash In</th>
                            <th>Revenue Kept</th>
                            <th>Partner Payout</th>
                            <th>Paid Out</th>
                            <th>Fulfillment Cost</th>
                            <th>Net Cash Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourceRows.map((row) => (
                            <tr key={row.key}>
                              <td>{row.label}</td>
                              <td>{formatSummaryMetricValue("company_gross_cash_in_total", row.grossCashIn)}</td>
                              <td>{formatSummaryMetricValue("company_retained_revenue_total", row.retainedRevenue)}</td>
                              <td>{formatSummaryMetricValue("company_partner_payout_out_total", row.partnerPayoutOut)}</td>
                              <td>{formatSummaryMetricValue("company_actual_payout_out_total", row.actualPayoutOut)}</td>
                              <td>
                                {formatSummaryMetricValue(
                                  "company_product_fulfillment_out_total",
                                  row.productFulfillmentOut
                                )}
                              </td>
                              <td style={{ fontWeight: 700 }}>
                                {formatSummaryMetricValue("company_net_treasury_delta_total", row.netTreasuryDelta)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No source-level money rows available.</p>
                  )}
                </section>
              </div>
            </Card>

            <Card className="span-12" title="Phase Totals">
              <p className="card-intro">
                Breakdown by phase. If no custom phase is defined, the whole result appears as Base Phase.
              </p>
              {phaseRows.length > 0 ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>ALPHA Issued</th>
                        <th>Used</th>
                        <th>ALPHA Cash-Out</th>
                        <th>Treasury Pressure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseRows.map((row) => (
                        <tr key={row.phase}>
                          <td>{row.phase}</td>
                          <td>{formatSummaryMetricValue("alpha_issued_total", row.issued)}</td>
                          <td>{formatSummaryMetricValue("alpha_spent_total", row.spent)}</td>
                          <td>{formatSummaryMetricValue("alpha_cashout_equivalent_total", row.cashout)}</td>
                          <td style={{ fontWeight: 700 }}>{formatCommonMetricValue("payout_inflow_ratio", row.pressure)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No phase totals available.</p>
              )}
            </Card>

            <Card className="span-12" title="Raw Breakdown Rows">
              <details className="distribution-raw-details">
                <summary>Show raw rows ({run.segmentMetrics.length})</summary>
                <div className="distribution-raw-grid">
                  {rawSegmentEntries.map(([segmentType, metrics]) => (
                    <section className="distribution-subpanel" key={segmentType}>
                      <h4>{getSegmentTypeLabel(segmentType)}</h4>
                      <div className="table-wrap">
                        <table className="table">
                          <thead><tr><th>Segment</th><th>Measure</th><th>Value</th></tr></thead>
                          <tbody>
                            {metrics.map((metric) => (
                              <tr key={metric.id}>
                                <td>{getSegmentKeyLabel(metric.segmentKey)}</td>
                                <td>{getCommonMetricLabel(metric.metricKey)}</td>
                                <td style={{ fontWeight: 600 }}>
                                  {formatCommonMetricValue(metric.metricKey, metric.metricValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              </details>
            </Card>
          </>
        ) : null}
      </section>
    </>
  );
}
