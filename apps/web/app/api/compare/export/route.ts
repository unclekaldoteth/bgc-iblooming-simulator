import { NextResponse } from "next/server";

import { listCompletedRunsByIds } from "@bgc-alpha/db";
import {
  renderCompareReportPdf,
  type CompareReportExport,
  type CompareReportTone
} from "@bgc-alpha/exports";

import { authorizeApiRequest } from "@/lib/auth-session";
import {
  compareAlphaMetricKeys,
  compareCashflowMetricKeys,
  compareMetricOptimization,
  compareRadarDimensions,
  compareSeriesColors,
  compareTreasuryMetricKeys
} from "@/lib/compare-config";
import {
  formatCommonMetricValue,
  formatMonthCountLabel,
  getEvidenceLevelLabel,
  getCommonMetricLabel,
  getPolicyStatusLabel,
  getRunReference,
  getRunStatusLabel,
  getSegmentKeyLabel
} from "@/lib/common-language";
import {
  formatStrategicMetricValue,
  readMilestoneEvaluations,
  readStrategicObjectives,
  strategicObjectiveLabels,
  strategicObjectiveOrder
} from "@/lib/strategic-objectives";

type CompareRunRecord = Awaited<ReturnType<typeof listCompletedRunsByIds>>[number];

function buildFilename(source: string) {
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getTone(status: string): CompareReportTone {
  const normalized = status.toLowerCase();

  if (["candidate", "approved", "completed", "ready"].some((token) => normalized.includes(token))) {
    return "accent";
  }

  if (["risky", "caution", "warning", "review"].some((token) => normalized.includes(token))) {
    return "warning";
  }

  if (["rejected", "failed", "error"].some((token) => normalized.includes(token))) {
    return "danger";
  }

  if (["queued", "running", "pending"].some((token) => normalized.includes(token))) {
    return "info";
  }

  return "neutral";
}

function buildRunDisplayLabels(runs: CompareRunRecord[]) {
  const counts = new Map<string, number>();

  runs.forEach((run) => {
    counts.set(run.scenario.name, (counts.get(run.scenario.name) ?? 0) + 1);
  });

  return new Map(
    runs.map((run) => [
      run.id,
      (counts.get(run.scenario.name) ?? 0) > 1
        ? `${run.scenario.name} · ${getRunReference(run.id)}`
        : run.scenario.name
    ])
  );
}

function buildRadar(runs: CompareRunRecord[], labels: Map<string, string>) {
  if (runs.length === 0) {
    return {
      dimensions: [],
      series: []
    };
  }

  const maxIssued = Math.max(
    1,
    ...runs.map((run) => run.summaryMetrics.find((metric) => metric.metricKey === "alpha_issued_total")?.metricValue ?? 0)
  );

  return {
    dimensions: compareRadarDimensions.map((dimension) => ({
      name: dimension.name,
      max: dimension.max === 0 ? maxIssued * 1.2 : dimension.max
    })),
    series: runs.map((run, index) => {
      const metrics = Object.fromEntries(
        run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const)
      ) as Record<string, number>;

      return {
        name: labels.get(run.id) ?? run.scenario.name,
        color: compareSeriesColors[index % compareSeriesColors.length],
        values: compareRadarDimensions.map((dimension) => {
          const raw = metrics[dimension.key] ?? 0;

          if (dimension.invert) {
            const max = dimension.max === 0 ? maxIssued * 1.2 : dimension.max;
            return Math.max(0, max - raw);
          }

          return raw;
        })
      };
    })
  };
}

function getSummaryValue(run: CompareRunRecord, metricKey: string) {
  return run.summaryMetrics.find((metric) => metric.metricKey === metricKey)?.metricValue ?? 0;
}

function findSegmentValue(run: CompareRunRecord, segmentType: string, segmentKey: string, metricKey: string) {
  return run.segmentMetrics.find(
    (metric) =>
      metric.segmentType === segmentType &&
      metric.segmentKey.toLowerCase() === segmentKey.toLowerCase() &&
      metric.metricKey === metricKey
  )?.metricValue ?? 0;
}

function findLargestSegment(run: CompareRunRecord, segmentType: string, metricKey: string) {
  const largest = run.segmentMetrics
    .filter((metric) => metric.segmentType === segmentType && metric.metricKey === metricKey)
    .sort((left, right) => right.metricValue - left.metricValue)[0];

  if (!largest) return null;

  return {
    label: getSegmentKeyLabel(largest.segmentKey),
    value: largest.metricValue
  };
}

function buildMetricRows(runs: CompareRunRecord[], metricKeys: readonly string[]) {
  return metricKeys.map((metricKey) => {
    const values = runs.map((run) => getSummaryValue(run, metricKey));
    const optimization = compareMetricOptimization[metricKey] ?? "higher";
    const uniqueValues = new Set(values.map((value) => value.toFixed(8)));
    const bestValue = optimization === "higher" ? Math.max(...values) : Math.min(...values);
    const worstValue = optimization === "higher" ? Math.min(...values) : Math.max(...values);

    return {
      label: getCommonMetricLabel(metricKey),
      cells: runs.map((_, index) => {
        const value = values[index] ?? 0;
        const hasSpread = values.length > 1 && uniqueValues.size > 1;
        const isBest = hasSpread && value === bestValue;
        const isWorst = hasSpread && value === worstValue;

        return {
          primary: formatCommonMetricValue(metricKey, value),
          emphasis: isBest ? "best" : isWorst ? "worst" : "default"
        } as const;
      })
    };
  });
}

function buildCompareReport(runs: CompareRunRecord[]) {
  const runDisplayLabels = buildRunDisplayLabels(runs);
  const extrasByRunId = new Map(
    runs.map((run) => {
      const recommendationJson = run.decisionPacks[0]?.recommendationJson;
      const strategicObjectives = readStrategicObjectives(recommendationJson);
      const milestoneEvaluations = readMilestoneEvaluations(recommendationJson);
      const verdictStatus = recommendationJson
        ? ((recommendationJson as Record<string, unknown>).policy_status as string | undefined) ?? "pending"
        : "pending";

      return [
        run.id,
        {
          verdictStatus,
          verdictLabel: getPolicyStatusLabel(verdictStatus),
          strategicObjectives,
          milestoneEvaluations
        }
      ] as const;
    })
  );

  const milestoneKeys = [
    ...new Set(
      runs.flatMap((run) =>
        (extrasByRunId.get(run.id)?.milestoneEvaluations ?? []).map((milestone) => `${milestone.milestone_key}::${milestone.label}`)
      )
    )
  ];
  const decisionRows = [
    {
      label: "Verdict",
      cells: runs.map((run) => {
        const extra = extrasByRunId.get(run.id);
        return {
          primary: extra?.verdictLabel ?? "Pending",
          tone: getTone(extra?.verdictStatus ?? "pending")
        };
      })
    },
    ...buildMetricRows(runs, [
      "company_net_treasury_delta_total",
      "company_actual_payout_out_total",
      "payout_inflow_ratio",
      "reserve_runway_months",
      "reward_concentration_top10_pct"
    ])
  ];

  return {
    title: `Compare Report · ${runs.length} Selected Scenario${runs.length === 1 ? "" : "s"}`,
    subtitle: "Scenario comparison exported with the same structure as the Compare tab: decision snapshot, cashflow, ALPHA policy, treasury risk, distribution, goals, milestones, and run context.",
    generatedAt: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date()),
    runs: runs.map((run, index) => {
      const extra = extrasByRunId.get(run.id);
      return {
        id: run.id,
        ref: getRunReference(run.id),
        label: runDisplayLabels.get(run.id) ?? run.scenario.name,
        color: compareSeriesColors[index % compareSeriesColors.length],
        scenarioName: run.scenario.name,
        snapshotName: run.snapshot.name,
        status: getRunStatusLabel(run.status),
        statusTone: getTone(run.status),
        verdict: extra?.verdictLabel ?? "Pending",
        verdictTone: getTone(extra?.verdictStatus ?? "pending"),
        completedAt: run.completedAt?.toLocaleString("en-US") ?? "Pending"
      };
    }),
    radar: buildRadar(runs, runDisplayLabels),
    comparisonTables: [
      {
        title: "Compare Decision Snapshot",
        subtitle: "Verdict and core financial/risk metrics per selected run.",
        rowLabel: "Decision Item",
        rows: decisionRows
      },
      {
        title: "Business Cashflow Comparison",
        subtitle: "Company cashflow truth. Fiat/cashflow values are shown in $ and kept separate from ALPHA policy movement.",
        rowLabel: "Cashflow Metric",
        rows: buildMetricRows(runs, compareCashflowMetricKeys)
      },
      {
        title: "ALPHA Policy Comparison",
        subtitle: "Policy-token layer only: issued, used, held, and ALPHA routed into the cash-out path.",
        rowLabel: "ALPHA Metric",
        rows: buildMetricRows(runs, compareAlphaMetricKeys)
      },
      {
        title: "Treasury Risk Comparison",
        subtitle: "Health signals used to judge treasury pressure, runway, internal use, and concentration risk.",
        rowLabel: "Risk Metric",
        rows: buildMetricRows(runs, compareTreasuryMetricKeys)
      },
      {
        title: "Distribution Comparison",
        subtitle: "Concentration and source split from the Distribution view.",
        rowLabel: "Distribution Measure",
        rows: [
          {
            label: "Largest Member Tier",
            cells: runs.map((run) => {
              const largestTier = findLargestSegment(run, "member_tier", "reward_share_pct");
              return {
                primary: largestTier ? `${largestTier.label} · ${formatCommonMetricValue("reward_share_pct", largestTier.value)}` : "N/A",
                muted: !largestTier
              };
            })
          },
          {
            label: "Largest Source by ALPHA",
            cells: runs.map((run) => {
              const largestSource = findLargestSegment(run, "source_system", "alpha_issued_total");
              const totalIssued = getSummaryValue(run, "alpha_issued_total");
              const share = largestSource && totalIssued > 0 ? (largestSource.value / totalIssued) * 100 : 0;
              return {
                primary: largestSource ? `${largestSource.label} · ${formatCommonMetricValue("reward_share_pct", share)}` : "N/A",
                muted: !largestSource
              };
            })
          },
          {
            label: "BGC Net Treasury Delta",
            cells: runs.map((run) => ({
              primary: formatCommonMetricValue(
                "company_net_treasury_delta_total",
                findSegmentValue(run, "source_system", "bgc", "company_net_treasury_delta_total")
              )
            }))
          },
          {
            label: "iBLOOMING Net Treasury Delta",
            cells: runs.map((run) => ({
              primary: formatCommonMetricValue(
                "company_net_treasury_delta_total",
                findSegmentValue(run, "source_system", "iblooming", "company_net_treasury_delta_total")
              )
            }))
          }
        ]
      },
      {
        title: "Strategic Goals Comparison",
        subtitle: "Strategic objective status, score, evidence level, and first reason for each selected scenario.",
        rowLabel: "Objective",
        rows: strategicObjectiveOrder.map((objectiveKey) => ({
          label: strategicObjectiveLabels[objectiveKey],
          cells: runs.map((run) => {
            const scorecard = extrasByRunId
              .get(run.id)
              ?.strategicObjectives.find((item) => item.objective_key === objectiveKey);

            if (!scorecard) {
              return {
                primary: "Pending",
                muted: true
              };
            }

            return {
              primary: getPolicyStatusLabel(scorecard.status),
              secondary: `${scorecard.score.toFixed(2)} · ${getEvidenceLevelLabel(scorecard.evidence_level)} · ${
                scorecard.primary_metrics[0]
                  ? `${scorecard.primary_metrics[0].label}: ${formatStrategicMetricValue(scorecard.primary_metrics[0].value, scorecard.primary_metrics[0].unit)}`
                  : scorecard.reasons[0] ?? "No reason recorded"
              }`,
              tone: getTone(scorecard.status)
            };
          })
        }))
      },
      {
        title: "Milestone Comparison",
        subtitle: "Milestone verdict, payout pressure, reserve runway, payout, and net treasury delta.",
        rowLabel: "Milestone",
        rows: milestoneKeys.length === 0
          ? [
              {
                label: "Milestone results",
                cells: runs.map(() => ({
                  primary: "No milestone results yet.",
                  muted: true
                }))
              }
            ]
          : milestoneKeys.map((milestoneKey) => {
              const [key, label] = milestoneKey.split("::");
              return {
                label,
                cells: runs.map((run) => {
                  const milestone = extrasByRunId
                    .get(run.id)
                    ?.milestoneEvaluations.find((item) => item.milestone_key === key);

                  if (!milestone) {
                    return {
                      primary: "N/A",
                      muted: true
                    };
                  }

                  return {
                    primary: getPolicyStatusLabel(milestone.policy_status),
                    secondary: `${formatCommonMetricValue("payout_inflow_ratio", milestone.summary_metrics.payout_inflow_ratio)} | ${formatMonthCountLabel(milestone.summary_metrics.reserve_runway_months)} | Net ${formatCommonMetricValue("company_net_treasury_delta_total", milestone.summary_metrics.company_net_treasury_delta_total)}`,
                    tone: getTone(milestone.policy_status)
                  };
                })
              };
            })
      }
    ]
  } satisfies CompareReportExport;
}

export async function GET(request: Request) {
  const authResult = await authorizeApiRequest(["compare.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const searchParams = new URL(request.url).searchParams;
  const runIds = [...new Set(searchParams.getAll("runId").filter(Boolean))];

  if (runIds.length === 0) {
    return NextResponse.json(
      {
        error: "missing_run_ids"
      },
      {
        status: 400
      }
    );
  }

  const fetchedRuns = await listCompletedRunsByIds(runIds);
  const runsById = new Map(fetchedRuns.map((run) => [run.id, run] as const));
  const orderedRuns = runIds
    .map((runId) => runsById.get(runId))
    .filter((run): run is CompareRunRecord => Boolean(run));

  if (orderedRuns.length === 0) {
    return NextResponse.json(
      {
        error: "runs_not_found"
      },
      {
        status: 404
      }
    );
  }

  const report = buildCompareReport(orderedRuns);
  const filenameSeed = orderedRuns.length === 1
    ? `${orderedRuns[0].scenario.name}-${getRunReference(orderedRuns[0].id)}-compare-report`
    : `compare-${getRunReference(orderedRuns[0].id)}-plus-${orderedRuns.length - 1}`;

  return new NextResponse(renderCompareReportPdf(report), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildFilename(filenameSeed)}.pdf"`
    }
  });
}
