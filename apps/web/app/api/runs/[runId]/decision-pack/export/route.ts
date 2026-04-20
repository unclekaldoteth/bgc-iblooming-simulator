import { NextResponse } from "next/server";

import {
  renderSimulationResultCsv,
  renderSimulationResultMarkdown,
  renderSimulationResultPdf,
  type SimulationResultExport
} from "@bgc-alpha/exports";
import { getLatestDecisionPackForRun, getRunById } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";
import {
  formatCommonMetricValue,
  getCommonMetricLabel,
  getEvidenceLevelLabel,
  getPolicyStatusLabel,
  getRiskSeverityLabel,
  getRunReference,
  getRunStatusLabel,
  getSegmentKeyLabel,
  getSegmentTypeLabel
} from "@/lib/common-language";
import { summaryMetricDefinitions } from "@/lib/summary-metrics";
import {
  formatStrategicMetricValue,
  readDecisionPack,
  readMilestoneEvaluations,
  readStrategicObjectives
} from "@/lib/strategic-objectives";

function buildFilename(source: string) {
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildSummaryRows(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>) {
  const summaryByKey = new Map(run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const));
  const orderedKeys = [
    ...summaryMetricDefinitions.map((definition) => definition.key),
    ...Array.from(summaryByKey.keys()).filter(
      (key) => !summaryMetricDefinitions.some((definition) => definition.key === key)
    )
  ];

  return orderedKeys
    .filter((key) => summaryByKey.has(key))
    .map((key) => {
      const definition = summaryMetricDefinitions.find((item) => item.key === key);
      const value = summaryByKey.get(key) ?? 0;

      return {
        key,
        label: getCommonMetricLabel(key),
        value: formatCommonMetricValue(key, value),
        description: definition?.description ?? ""
      };
    });
}

function buildTreasuryRows(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>) {
  const summaryByKey = new Map(run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const));
  const treasuryMetricKeys = [
    "alpha_cashout_equivalent_total",
    "company_gross_cash_in_total",
    "company_retained_revenue_total",
    "company_partner_payout_out_total",
    "company_direct_reward_obligation_total",
    "company_pool_funding_obligation_total",
    "company_actual_payout_out_total",
    "company_product_fulfillment_out_total",
    "company_net_treasury_delta_total",
    "sink_utilization_rate",
    "payout_inflow_ratio",
    "reserve_runway_months",
    "reward_concentration_top10_pct"
  ] as const;

  return treasuryMetricKeys.map((key) => {
    const value = summaryByKey.get(key) ?? 0;
    const definition = summaryMetricDefinitions.find((item) => item.key === key);

    return {
      key,
      label: getCommonMetricLabel(key),
      value: formatCommonMetricValue(key, value),
      description: definition?.description ?? ""
    };
  });
}

function buildDistributionGroups(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>) {
  const byType = new Map<string, typeof run.segmentMetrics>();

  for (const metric of run.segmentMetrics) {
    const existing = byType.get(metric.segmentType) ?? [];
    existing.push(metric);
    byType.set(metric.segmentType, existing);
  }

  return Array.from(byType.entries()).map(([segmentType, metrics]) => ({
    title: getSegmentTypeLabel(segmentType),
    rows: metrics.map((metric) => ({
      segment: getSegmentKeyLabel(metric.segmentKey),
      measure: getCommonMetricLabel(metric.metricKey),
      value: formatCommonMetricValue(metric.metricKey, metric.metricValue)
    }))
  }));
}

function buildExportReport(run: NonNullable<Awaited<ReturnType<typeof getRunById>>>) {
  const packValue = run.decisionPacks[0]?.recommendationJson;
  const decisionPack = readDecisionPack(packValue);

  if (!decisionPack) {
    return null;
  }

  const strategicObjectives = readStrategicObjectives(packValue);
  const milestoneEvaluations = readMilestoneEvaluations(packValue);

  return {
    title: `Simulation Result Export · ${getRunReference(run.id)}`,
    ref: getRunReference(run.id),
    scenarioName: run.scenario.name,
    snapshotName: run.snapshot.name,
    modelVersionName: run.modelVersion.versionName,
    status: getRunStatusLabel(run.status),
    createdAt: run.createdAt.toLocaleString("en-US"),
    completedAt: run.completedAt?.toLocaleString("en-US") ?? "Pending",
    summary: buildSummaryRows(run),
    treasury: buildTreasuryRows(run),
    flags: run.flags.map((flag) => ({
      severity: getRiskSeverityLabel(flag.severity),
      type: flag.flagType,
      period: flag.periodKey ?? "",
      message: flag.message
    })),
    distribution: buildDistributionGroups(run),
    decisionPack: {
      title: decisionPack.title,
      verdict: getPolicyStatusLabel(decisionPack.policy_status),
      recommendation: decisionPack.recommendation,
      preferredSettings: decisionPack.preferred_settings,
      rejectedSettings: decisionPack.rejected_settings,
      unresolvedQuestions: decisionPack.unresolved_questions,
      strategicObjectives: strategicObjectives.map((objective) => ({
        title: objective.label,
        status: getPolicyStatusLabel(objective.status),
        evidence: getEvidenceLevelLabel(objective.evidence_level),
        score: objective.score.toFixed(2),
        primaryMetrics: objective.primary_metrics.map(
          (metric) => `${metric.label}: ${formatStrategicMetricValue(metric.value, metric.unit)}`
        ),
        reasons: objective.reasons
      })),
      milestoneCheckpoints: milestoneEvaluations.map((milestone) => ({
        title: milestone.label,
        period: `${milestone.start_period_key} to ${milestone.end_period_key}`,
        status: getPolicyStatusLabel(milestone.policy_status),
        pressure: `${milestone.summary_metrics.payout_inflow_ratio.toFixed(2)}x`,
        runway: formatCommonMetricValue(
          "reserve_runway_months",
          milestone.summary_metrics.reserve_runway_months
        ),
        topShare: `${milestone.summary_metrics.reward_concentration_top10_pct.toFixed(2)}%`,
        netDelta: formatCommonMetricValue(
          "company_net_treasury_delta_total",
          milestone.summary_metrics.company_net_treasury_delta_total
        ),
        reasons: milestone.reasons
      }))
    }
  } satisfies SimulationResultExport;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["decision-pack.export"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { runId } = await params;
  const [run, packRecord] = await Promise.all([getRunById(runId), getLatestDecisionPackForRun(runId)]);

  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found"
      },
      {
        status: 404
      }
    );
  }

  if (!packRecord) {
    return NextResponse.json(
      {
        error: "decision_pack_not_ready"
      },
      {
        status: 409
      }
    );
  }

  const report = buildExportReport(run);

  if (!report) {
    return NextResponse.json(
      {
        error: "decision_pack_not_ready"
      },
      {
        status: 409
      }
    );
  }

  const format = new URL(request.url).searchParams.get("format") ?? "markdown";
  const safeBase = buildFilename(`${run.scenario.name}-${getRunReference(run.id)}-simulation-result`);

  if (format === "csv") {
    return new NextResponse(renderSimulationResultCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeBase}.csv"`
      }
    });
  }

  if (format === "pdf") {
    return new NextResponse(renderSimulationResultPdf(report), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeBase}.pdf"`
      }
    });
  }

  return new NextResponse(renderSimulationResultMarkdown(report), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeBase}.md"`
    }
  });
}
