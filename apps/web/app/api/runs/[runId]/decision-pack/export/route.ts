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
  getDecisionGovernanceStatusLabel,
  getDecisionLogStatusLabel,
  getEvidenceLevelLabel,
  getHistoricalTruthCoverageLabel,
  getPolicyStatusLabel,
  getRiskSeverityLabel,
  getRunReference,
  getRunStatusLabel,
  getSetupStatusLabel,
  getSegmentKeyLabel,
  getSegmentTypeLabel,
  getTruthClassificationLabel,
  simplifyResultText
} from "@/lib/common-language";
import { summaryMetricDefinitions } from "@/lib/summary-metrics";
import {
  formatStrategicMetricValue,
  mergeDecisionLogWithResolutions,
  readCanonicalGapAudit,
  readDecisionLog,
  readDecisionLogResolutions,
  readDecisionPack,
  readHistoricalTruthCoverage,
  readMilestoneEvaluations,
  readRecommendedSetup,
  readStrategicObjectives,
  readTokenFlowEvidence,
  readTruthAssumptionMatrix
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
    "actual_sink_utilization_rate",
    "modeled_sink_utilization_rate",
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
  const historicalTruthCoverage = readHistoricalTruthCoverage(packValue);
  const canonicalGapAudit = readCanonicalGapAudit(packValue);
  const recommendedSetup = readRecommendedSetup(packValue);
  const tokenFlowEvidence = readTokenFlowEvidence(packValue);
  const decisionLog = mergeDecisionLogWithResolutions(
    readDecisionLog(packValue),
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
  const truthAssumptionMatrix = readTruthAssumptionMatrix(packValue);

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
      message: simplifyResultText(flag.message)
    })),
    distribution: buildDistributionGroups(run),
    decisionPack: {
      title: simplifyResultText(decisionPack.title),
      verdict: getPolicyStatusLabel(decisionPack.policy_status),
      recommendation: simplifyResultText(decisionPack.recommendation),
      preferredSettings: decisionPack.preferred_settings.map(simplifyResultText),
      rejectedSettings: decisionPack.rejected_settings.map(simplifyResultText),
      unresolvedQuestions: decisionPack.unresolved_questions.map(simplifyResultText),
      historicalTruthCoverage: historicalTruthCoverage
        ? {
            status: getHistoricalTruthCoverageLabel(historicalTruthCoverage.status),
            summary: simplifyResultText(historicalTruthCoverage.summary),
            rows: historicalTruthCoverage.rows.map((row) => ({
              label: simplifyResultText(row.label),
              status: getHistoricalTruthCoverageLabel(row.status),
              detail: simplifyResultText(row.detail)
            }))
          }
        : null,
      canonicalGapAudit: canonicalGapAudit
        ? {
            readiness: getHistoricalTruthCoverageLabel(canonicalGapAudit.readiness),
            summary: simplifyResultText(canonicalGapAudit.summary),
            rows: canonicalGapAudit.rows.map((row) => ({
              label: simplifyResultText(row.label),
              status: getHistoricalTruthCoverageLabel(row.status),
              detail: simplifyResultText(row.detail)
            }))
          }
        : null,
      tokenFlowEvidence: tokenFlowEvidence
        ? {
            readiness: tokenFlowEvidence.readiness,
            summary: simplifyResultText(tokenFlowEvidence.summary),
            rows: tokenFlowEvidence.rows.map((row) => ({
              label: simplifyResultText(row.label),
              status: row.status,
              value: simplifyResultText(row.value),
              detail: simplifyResultText(row.detail)
            })),
            caveats: tokenFlowEvidence.caveats.map(simplifyResultText)
          }
        : null,
      recommendedSetup: recommendedSetup
        ? {
            title: simplifyResultText(recommendedSetup.title),
            summary: simplifyResultText(recommendedSetup.summary),
            items: recommendedSetup.items.map((item) => ({
              label: simplifyResultText(item.label),
              value: simplifyResultText(item.value),
              status: getSetupStatusLabel(item.status),
              rationale: simplifyResultText(item.rationale)
            })),
            warnings: recommendedSetup.warnings.map(simplifyResultText)
          }
        : null,
      adoptedBaselineSummary:
        run.scenario.adoptedBaselineRunId === run.id
          ? `Selected as current pilot baseline${run.scenario.adoptedBaselineAt ? ` at ${run.scenario.adoptedBaselineAt.toLocaleString("en-US")}` : ""}${run.scenario.adoptedBaselineNote ? ` · ${simplifyResultText(run.scenario.adoptedBaselineNote)}` : ""}`
          : run.scenario.adoptedBaselineRunId
            ? `Another result is currently the pilot baseline for ${run.scenario.name}.`
            : null,
      decisionLog: decisionLog.map((entry) => ({
        title: simplifyResultText(entry.title),
        status: getDecisionLogStatusLabel(entry.status),
        owner: simplifyResultText(entry.owner),
        rationale: simplifyResultText(entry.rationale),
        governanceStatus: getDecisionGovernanceStatusLabel(entry.governance_status ?? "draft"),
        resolutionNote: entry.resolution_note ? simplifyResultText(entry.resolution_note) : null,
        reviewedAt: entry.reviewed_at ?? null
      })),
      truthAssumptionMatrix: truthAssumptionMatrix.map((item) => ({
        label: simplifyResultText(item.label),
        classification: getTruthClassificationLabel(item.classification),
        value: simplifyResultText(item.value),
        note: simplifyResultText(item.note)
      })),
      strategicObjectives: strategicObjectives.map((objective) => ({
        title: simplifyResultText(objective.label),
        status: getPolicyStatusLabel(objective.status),
        evidence: getEvidenceLevelLabel(objective.evidence_level),
        score: objective.score.toFixed(2),
        primaryMetrics: objective.primary_metrics.map(
          (metric) => `${simplifyResultText(metric.label)}: ${formatStrategicMetricValue(metric.value, metric.unit)}`
        ),
        reasons: objective.reasons.map(simplifyResultText)
      })),
      milestoneCheckpoints: milestoneEvaluations.map((milestone) => ({
        title: simplifyResultText(milestone.label),
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
        reasons: milestone.reasons.map(simplifyResultText)
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
