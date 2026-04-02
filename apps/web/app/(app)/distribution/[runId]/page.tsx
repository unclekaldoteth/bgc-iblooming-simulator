import Link from "next/link";
import { notFound } from "next/navigation";

import { getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { requirePageUser } from "@/lib/auth-session";
import {
  formatCommonMetricValue,
  getCommonMetricLabel,
  getRunReference,
  getSegmentKeyLabel,
  getSegmentTypeLabel
} from "@/lib/common-language";

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

  return (
    <>
      <PageHeader eyebrow="Distribution" title={`Distribution View · ${getRunReference(runId)}`} description="How rewards and behavior are distributed across segments." />

      {/* Tab nav */}
      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item active">Distribution</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        {Object.keys(groupedSegments).length === 0 ? (
          <Card className="span-12" title="No segment data">
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>No segment metrics</h3>
              <p>Segment breakdowns will appear once the run completes.</p>
            </div>
          </Card>
        ) : null}

        {Object.entries(groupedSegments).map(([segmentType, metrics]) => (
          <Card className="span-6" key={segmentType} title={getSegmentTypeLabel(segmentType)}>
            <table className="table">
              <thead><tr><th>Segment</th><th>Measure</th><th>Value</th></tr></thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id}>
                    <td>{getSegmentKeyLabel(metric.segmentKey)}</td>
                    <td>{getCommonMetricLabel(metric.metricKey)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCommonMetricValue(metric.metricKey, metric.metricValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </section>
    </>
  );
}
