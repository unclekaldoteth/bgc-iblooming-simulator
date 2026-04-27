import { NextResponse } from "next/server";

import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { listCompletedRunsByIds } from "@bgc-alpha/db";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import {
  renderCompareReportPdf,
  renderCompareReportMarkdown,
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
  getCanonicalGapStatusLabel,
  getDecisionGovernanceStatusLabel,
  getDecisionLogStatusLabel,
  formatMonthCountLabel,
  getEvidenceLevelLabel,
  getCommonMetricLabel,
  getHistoricalTruthCoverageLabel,
  getPolicyStatusLabel,
  getRunReference,
  getRunStatusLabel,
  getScenarioModeCaveat,
  getScenarioModeLabel,
  getSegmentKeyLabel,
  getTruthClassificationLabel
} from "@/lib/common-language";
import { buildCompareDecisionSupportArtifacts } from "@/lib/decision-support";
import {
  formatStrategicMetricValue,
  mergeDecisionLogWithResolutions,
  readCanonicalGapAudit,
  readDecisionLog,
  readDecisionLogResolutions,
  readHistoricalTruthCoverage,
  readMilestoneEvaluations,
  readRecommendedSetup,
  readStrategicObjectives,
  readTruthAssumptionMatrix,
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

function formatCompareParameterValue(parameterKey: string, value: string | number | null) {
  if (value === null) {
    return "snapshot window";
  }

  if (typeof value === "string") {
    return value;
  }

  if (parameterKey === "cashout_fee_bps" || parameterKey === "cashout_windows_per_year" || parameterKey === "cashout_window_days" || parameterKey === "milestone_count") {
    return `${Math.round(value)}`;
  }

  if (parameterKey === "projection_horizon_months") {
    return formatMonthCountLabel(value);
  }

  if (parameterKey === "cashout_min_usd") {
    return formatCommonMetricValue("company_actual_payout_out_total", value);
  }

  return `${value}`;
}

const parameterLabelToKey: Record<string, string> = {
  "Result mode": "scenario_mode_label",
  k_pc: "k_pc",
  k_sp: "k_sp",
  "User monthly cap": "cap_user_monthly",
  "Group monthly cap": "cap_group_monthly",
  "Internal use target": "sink_target",
  "Cash-out mode": "cashout_mode",
  "Cash-out minimum": "cashout_min_usd",
  "Cash-out fee": "cashout_fee_bps",
  "Cash-out windows / year": "cashout_windows_per_year",
  "Cash-out window days": "cashout_window_days",
  "Forecast length": "projection_horizon_months",
  "Phase count": "milestone_count"
};

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
      const baselineModel = resolveBaselineModelRuleset(
        run.modelVersion.rulesetJson,
        run.modelVersion.versionName
      );
      const parameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
        reward_global_factor: baselineModel.defaults.reward_global_factor,
        reward_pool_factor: baselineModel.defaults.reward_pool_factor
      });
      const strategicObjectives = readStrategicObjectives(recommendationJson).map((objective) => ({
        objective_key: objective.objective_key,
        label: objective.label,
        status: objective.status,
        score: objective.score,
        evidence_level: objective.evidence_level,
        primary_metrics: objective.primary_metrics.map(
          (metric) => `${metric.label}: ${formatStrategicMetricValue(metric.value, metric.unit)}`
        ),
        reasons: objective.reasons
      }));
      const milestoneEvaluations = readMilestoneEvaluations(recommendationJson);
      const historicalTruthCoverage = readHistoricalTruthCoverage(recommendationJson);
      const recommendedSetup = readRecommendedSetup(recommendationJson);
      const decisionLog = mergeDecisionLogWithResolutions(
        readDecisionLog(recommendationJson),
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
      const truthAssumptionMatrix = readTruthAssumptionMatrix(recommendationJson);
      const canonicalGapAudit = readCanonicalGapAudit(recommendationJson);
      const verdictStatus = recommendationJson
        ? ((recommendationJson as Record<string, unknown>).policy_status as string | undefined) ?? "pending"
        : "pending";

      return [
        run.id,
        {
          verdictStatus,
          verdictLabel: getPolicyStatusLabel(verdictStatus),
          strategicObjectives,
          milestoneEvaluations,
          historicalTruthCoverage,
          recommendedSetup,
          decisionLog,
          truthAssumptionMatrix,
          canonicalGapAudit,
          adoptedBaselineRunId: run.scenario.adoptedBaselineRunId ?? null,
          adoptedBaselineAt: run.scenario.adoptedBaselineAt?.toISOString() ?? null,
          adoptedBaselineNote: run.scenario.adoptedBaselineNote ?? null,
          parameters: {
            ...parameters,
            scenario_mode_label: getScenarioModeLabel(parameters.scenario_mode),
            forecast_mode_caveat: getScenarioModeCaveat(parameters.scenario_mode),
            milestone_count: parameters.milestone_schedule.length,
            cohort_projection_label:
              parameters.cohort_assumptions.new_members_per_month === 0 &&
              parameters.cohort_assumptions.monthly_churn_rate_pct === 0 &&
              parameters.cohort_assumptions.monthly_reactivation_rate_pct === 0
                ? parameters.scenario_mode === "advanced_forecast"
                  ? "on, but growth assumptions are still 0"
                  : "off in Imported Data Only"
                : `${parameters.cohort_assumptions.new_members_per_month} new/mo · ${parameters.cohort_assumptions.monthly_churn_rate_pct}% churn · ${parameters.cohort_assumptions.monthly_reactivation_rate_pct}% reactivation`
          }
        }
      ] as const;
    })
  );

  const decisionSupport = buildCompareDecisionSupportArtifacts(
    runs.map((run) => {
      const extra = extrasByRunId.get(run.id);
      return {
        id: run.id,
        label: runDisplayLabels.get(run.id) ?? run.scenario.name,
        scenarioName: run.scenario.name,
        snapshotName: run.snapshot.name,
        verdict: extra?.verdictStatus ?? "pending",
        summaryMetrics: Object.fromEntries(
          run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const)
        ) as Record<string, number>,
        parameters: extra?.parameters ?? {
          scenario_mode_label: "Imported Data Only",
          forecast_mode_caveat: null,
          k_pc: 1,
          k_sp: 1,
          reward_global_factor: 1,
          reward_pool_factor: 1,
          cap_user_monthly: "none",
          cap_group_monthly: "none",
          sink_target: 0,
          cashout_mode: "WINDOWS",
          cashout_min_usd: 0,
          cashout_fee_bps: 0,
          cashout_windows_per_year: 0,
          cashout_window_days: 0,
          projection_horizon_months: null,
          milestone_count: 0,
          cohort_projection_label: "disabled"
        },
        historicalTruthCoverage: extra?.historicalTruthCoverage ?? null,
        strategicObjectives: extra?.strategicObjectives ?? [],
        milestoneEvaluations: extra?.milestoneEvaluations ?? [],
        decisionLog: extra?.decisionLog ?? [],
        truthAssumptionMatrix: extra?.truthAssumptionMatrix ?? [],
        recommendedSetup: extra?.recommendedSetup ?? null
      };
    })
  );

  const milestoneKeys = [
    ...new Set(
      runs.flatMap((run) =>
        (extrasByRunId.get(run.id)?.milestoneEvaluations ?? []).map((milestone) => `${milestone.milestone_key}::${milestone.label}`)
      )
    )
  ];
  const truthCoverageRows = [
    ...new Set(
      runs.flatMap((run) =>
        (extrasByRunId.get(run.id)?.historicalTruthCoverage?.rows ?? []).map((row) => `${row.key}::${row.label}`)
      )
    )
  ];
  const canonicalGapRows = [
    ...new Set(
      runs.flatMap((run) =>
        (extrasByRunId.get(run.id)?.canonicalGapAudit?.rows ?? []).map((row) => `${row.key}::${row.label}`)
      )
    )
  ];
  const decisionGovernanceRows = [
    ...new Set(
      runs.flatMap((run) =>
        (extrasByRunId.get(run.id)?.decisionLog ?? []).map((entry) => `${entry.key}::${entry.title}`)
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
  const getParameterDisplayValue = (runId: string, parameterKey: string) => {
    const parameters = extrasByRunId.get(runId)?.parameters;

    if (!parameters) {
      return "Not set";
    }

    const value = parameters[parameterKey as keyof typeof parameters] as string | number | null | undefined;
    return formatCompareParameterValue(parameterKey, value ?? null);
  };

  const getSimulationSummaryStatusLabel = (status: string) => {
    if (status === "ready") return "Ready";
    if (status === "review") return "Needs Review";
    if (status === "blocked") return "Blocked";
    return "Info";
  };

  const getParameterClassificationLabel = (classification: string) => {
    if (classification === "scenario_lever") return "Editable";
    if (classification === "scenario_assumption") return "Assumption";
    return "Locked";
  };

  const getFounderQuestionStatusLabel = (status: string) => {
    if (status === "recommended") return "Recommended";
    if (status === "pending_founder") return "Decision Needed";
    return "Blocked";
  };

  const getImplementationPlanStatusLabel = (status: string) => {
    if (status === "ready") return "Ready";
    if (status === "in_progress") return "In Progress";
    if (status === "blocked") return "Blocked";
    return "Deferred";
  };

  return {
    title: `Compare Report · ${runs.length} Selected Result${runs.length === 1 ? "" : "s"}`,
    subtitle: "Compare export includes summary, status memo, quick score chart, decisions, money view, data quality, recommended setup, parameters, open decisions, next build steps, treasury safety, distribution, goals, phases, and result details.",
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
        completedAt: run.completedAt?.toLocaleString("en-US") ?? "Not completed"
      };
    }),
    radar: buildRadar(runs, runDisplayLabels),
    comparisonTables: [
      {
        title: "Summary",
        subtitle: "Plain summary before the detailed result and treasury tables.",
        rowLabel: "Topic",
        columns: [
          { label: "Status" },
          { label: "What It Shows" },
          { label: "Why It Matters" }
        ],
        rows: decisionSupport.simulationSummary.rows.map((row) => ({
          label: row.label,
          cells: [
            {
              primary: getSimulationSummaryStatusLabel(row.status),
              tone: getTone(row.status === "ready" ? "candidate" : row.status === "review" ? "risky" : row.status === "blocked" ? "rejected" : "info")
            },
            {
              primary: row.currentReadout
            },
            {
              primary: row.implication
            }
          ]
        }))
      },
      {
        title: "Status Memo",
        subtitle: "Short memo generated from the current comparison.",
        rowLabel: "Memo Item",
        columns: [
          { label: "Status" },
          { label: "What It Shows" },
          { label: "Why It Matters" }
        ],
        rows: decisionSupport.executiveStatusMemo.rows.map((row) => ({
          label: row.label,
          cells: [
            {
              primary: getSimulationSummaryStatusLabel(row.status),
              tone: getTone(row.status === "ready" ? "candidate" : row.status === "review" ? "risky" : row.status === "blocked" ? "rejected" : "info")
            },
            {
              primary: row.currentReadout
            },
            {
              primary: row.implication
            }
          ]
        }))
      },
      {
        title: "Result Cards",
        subtitle: "Status and core money/risk metrics per selected result.",
        rowLabel: "Decision Item",
        rows: decisionRows
      },
      {
        title: "Money View by Result",
        subtitle: "Business cash posture per selected result.",
        rowLabel: "Result",
        columns: [
          { label: "Posture" },
          { label: "Money View" },
          { label: "Cash Out" },
          { label: "Tradeoff" }
        ],
        rows: decisionSupport.financialScenarioView.rows.map((row) => ({
          label: row.label,
          cells: [
            {
              primary: row.posture,
              secondary: getPolicyStatusLabel(row.verdict),
              tone: getTone(row.verdict)
            },
            {
              primary: `Cash In ${formatCommonMetricValue("company_gross_cash_in_total", row.grossCashIn)} · Revenue Kept ${formatCommonMetricValue("company_retained_revenue_total", row.retainedRevenue)}`,
              secondary: `Partner ${formatCommonMetricValue("company_partner_payout_out_total", row.partnerPayoutOut)} · Direct Rewards ${formatCommonMetricValue("company_direct_reward_obligation_total", row.directObligations)} · Net Cash ${formatCommonMetricValue("company_net_treasury_delta_total", row.netTreasuryDelta)}`
            },
            {
              primary: `${formatCommonMetricValue("company_actual_payout_out_total", row.actualPayoutOut)} paid out · ${formatCommonMetricValue("company_product_fulfillment_out_total", row.fulfillmentOut)} fulfillment`,
              secondary: `${row.leakageRatePct.toFixed(2)}% of cash in`
            },
            {
              primary: row.tradeoff,
              secondary: `Pressure ${formatCommonMetricValue("payout_inflow_ratio", row.treasuryPressure)} · Runway ${formatMonthCountLabel(row.reserveRunwayMonths)}`
            }
          ]
        }))
      },
      {
        title: "Money Comparison",
        subtitle: "Cash in and cash out are shown in dollars. ALPHA movement is kept separate.",
        rowLabel: "Money Metric",
        rows: buildMetricRows(runs, compareCashflowMetricKeys)
      },
      {
        title: "Data Completeness",
        subtitle: "Shows how complete the uploaded data is behind each result.",
        rowLabel: "Data Area",
        rows: [
          {
            label: "Overall Data Quality",
            cells: runs.map((run) => {
              const coverage = extrasByRunId.get(run.id)?.historicalTruthCoverage;
              return {
                primary: getHistoricalTruthCoverageLabel(coverage?.status ?? "weak"),
                secondary: coverage?.summary ?? "No imported data coverage summary yet.",
                tone: getTone(coverage?.status === "strong" ? "candidate" : coverage?.status === "partial" ? "risky" : "rejected")
              };
            })
          },
          ...truthCoverageRows.map((coverageRow) => {
            const [coverageKey, coverageLabel] = coverageRow.split("::");
            return {
              label: coverageLabel,
              cells: runs.map((run) => {
                const coverage = extrasByRunId
                  .get(run.id)
                  ?.historicalTruthCoverage?.rows.find((row) => row.key === coverageKey);

                if (!coverage) {
                  return {
                    primary: "Not available",
                    muted: true
                  };
                }

                return {
                  primary: getHistoricalTruthCoverageLabel(coverage.status),
                  secondary: coverage.detail,
                  tone: getTone(coverage.status === "available" ? "candidate" : coverage.status === "partial" ? "risky" : "rejected")
                };
              })
            };
          })
        ]
      },
      {
        title: "Source Detail Check",
        subtitle: "Shows which source details are already available and which details are still missing.",
        rowLabel: "Source Area",
        rows: [
          {
            label: "Overall Source Detail",
            cells: runs.map((run) => {
              const audit = extrasByRunId.get(run.id)?.canonicalGapAudit;
              return {
                primary: getHistoricalTruthCoverageLabel(audit?.readiness ?? "weak"),
                secondary: audit?.summary ?? "No source detail check recorded yet.",
                tone: getTone(
                  audit?.readiness === "strong"
                    ? "candidate"
                    : audit?.readiness === "partial"
                      ? "risky"
                      : "rejected"
                )
              };
            })
          },
          ...canonicalGapRows.map((gapRow) => {
            const [gapKey, gapLabel] = gapRow.split("::");
            return {
              label: gapLabel,
              cells: runs.map((run) => {
                const auditRow = extrasByRunId
                  .get(run.id)
                  ?.canonicalGapAudit?.rows.find((row) => row.key === gapKey);

                if (!auditRow) {
                  return {
                    primary: "Not available",
                    muted: true
                  };
                }

                return {
                  primary: getCanonicalGapStatusLabel(auditRow.status),
                  secondary: auditRow.detail,
                  tone: getTone(
                    auditRow.status === "covered"
                      ? "candidate"
                      : auditRow.status === "partial"
                        ? "risky"
                        : "rejected"
                  )
                };
              })
            };
          })
        ]
      },
      {
        title: "Recommended Setup",
        subtitle: `Recommendation from this comparison. Current strongest result: ${decisionSupport.recommendedEnvelope.recommendedRunLabel ?? "not available"}. ${decisionSupport.recommendedEnvelope.summary}`,
        rowLabel: "Setup Item",
        rows: [
          {
            label: "Current Baseline",
            cells: runs.map((run) => {
              const extra = extrasByRunId.get(run.id);

              if (extra?.adoptedBaselineRunId === run.id) {
                return {
                  primary: "Current Baseline",
                  secondary: `Adopted${extra.adoptedBaselineAt ? ` at ${new Date(extra.adoptedBaselineAt).toLocaleString("en-US")}` : ""}${extra.adoptedBaselineNote ? ` · ${extra.adoptedBaselineNote}` : ""}`,
                  tone: "accent"
                };
              }

              if (extra?.adoptedBaselineRunId) {
                return {
                  primary: "Another Result Adopted",
                  secondary: "This scenario currently has a different adopted pilot baseline.",
                  tone: "info"
                };
              }

              return {
                primary: "No Baseline Locked",
                secondary: "This scenario does not have an adopted pilot baseline yet.",
                tone: "neutral"
              };
            })
          },
          {
            label: "Setup Status",
            cells: runs.map((run) => ({
              primary:
                run.id === decisionSupport.recommendedEnvelope.recommendedRunId
                  ? decisionSupport.recommendedEnvelope.status === "recommended"
                    ? "Recommended"
                    : decisionSupport.recommendedEnvelope.status === "review"
                      ? "Needs Review"
                      : "Blocked"
                  : "Alternative",
              secondary: run.id === decisionSupport.recommendedEnvelope.recommendedRunId ? "Current strongest result" : "Compared option",
              tone:
                run.id === decisionSupport.recommendedEnvelope.recommendedRunId
                  ? getTone(
                      decisionSupport.recommendedEnvelope.status === "recommended"
                        ? "candidate"
                        : decisionSupport.recommendedEnvelope.status === "review"
                          ? "risky"
                          : "rejected"
                    )
                  : "neutral"
            }))
          },
          ...decisionSupport.recommendedEnvelope.items.map((item) => ({
            label: `${item.label} · Recommended ${item.value}`,
            cells: runs.map((run) => {
              const parameterKey = parameterLabelToKey[item.label] ?? "";
              const parameterValue = parameterKey ? getParameterDisplayValue(run.id, parameterKey) : item.value;

              return {
                primary: parameterValue,
                secondary: run.id === decisionSupport.recommendedEnvelope.recommendedRunId ? item.rationale : "Compared result value",
                tone: run.id === decisionSupport.recommendedEnvelope.recommendedRunId ? "accent" : undefined
              };
            })
          }))
        ]
      },
      {
        title: "Parameter Guide",
        subtitle: "Guide for each setting: meaning, tested values, current default, suggested choice, and decision owner.",
        rowLabel: "Setting",
        columns: [
          { label: "Symbol" },
          { label: "Meaning" },
          { label: "Tested Values" },
          { label: "Current Default" },
          { label: "Suggested Choice" },
          { label: "Decision Owner" },
          { label: "Type" }
        ],
        rows: decisionSupport.parameterRegistry.map((row) => ({
          label: row.label,
          cells: [
            {
              primary: row.symbol
            },
            {
              primary: row.description
            },
            {
              primary: row.testedRange
            },
            {
              primary: row.workingDefault
            },
            {
              primary: row.currentRecommended
            },
            {
              primary: row.decisionOwner
            },
            {
              primary: getParameterClassificationLabel(row.classification),
              secondary: `Rule: ${
                row.guardrailStatus === "allowed"
                  ? "Editable"
                  : row.guardrailStatus === "conditional"
                    ? "Assumption"
                    : "Locked"
              }`,
              tone: getTone(
                row.classification === "scenario_lever"
                  ? "candidate"
                  : row.classification === "scenario_assumption"
                    ? "risky"
                    : "pending"
              )
            }
          ]
        }))
      },
      {
        title: "Parameter Ranges",
        subtitle: "Values tested across the selected results, grouped into recommended, use-with-care, and do-not-use ranges.",
        rowLabel: "Setting",
        rows: decisionSupport.parameterRanges.map((row) => ({
          label: `${row.label} · Recommended ${row.recommendedValues}`,
          cells: runs.map((run) => {
            const parameterValue = getParameterDisplayValue(run.id, row.parameterKey);
            const extraNotes = [`Tested ${row.testedValues}`];
            if (row.cautionValues) extraNotes.push(`Use with care ${row.cautionValues}`);
            if (row.rejectedValues) extraNotes.push(`Do not use ${row.rejectedValues}`);
            return {
              primary: parameterValue,
              secondary: extraNotes.join(" · "),
              tone: getTone(extrasByRunId.get(run.id)?.verdictStatus ?? "pending")
            };
          })
        }))
      },
      {
        title: "Open Decisions",
        subtitle: "Decisions that still need a clear answer before Whitepaper v1 and Token Flow v1 can be treated as final.",
        rowLabel: "Question",
        columns: [
          { label: "Status" },
          { label: "Why It Matters" },
          { label: "Suggested Answer" },
          { label: "Decision Owner" },
          { label: "Options" }
        ],
        rows: decisionSupport.founderQuestionQueue.map((row) => ({
          label: row.question,
          cells: [
            {
              primary: getFounderQuestionStatusLabel(row.status),
              tone: getTone(row.status === "recommended" ? "candidate" : row.status === "pending_founder" ? "risky" : "rejected")
            },
            {
              primary: row.whyNow
            },
            {
              primary: row.recommendedDirection
            },
            {
              primary: row.decisionOwner
            },
            {
              primary: row.decisionOptions
            }
          ]
        }))
      },
      {
        title: "Next Build Steps",
        subtitle: "Practical build steps needed to close the brief package without adding unnecessary engine work.",
        rowLabel: "Work Area",
        columns: [
          { label: "Owner" },
          { label: "Status" },
          { label: "Next Action" },
          { label: "Why It Matters" }
        ],
        rows: decisionSupport.technicalImplementationPlan.rows.map((row) => ({
          label: row.label,
          cells: [
            {
              primary: row.owner
            },
            {
              primary: getImplementationPlanStatusLabel(row.status),
              tone: getTone(row.status === "ready" ? "candidate" : row.status === "in_progress" ? "risky" : row.status === "blocked" ? "rejected" : "pending")
            },
            {
              primary: row.nextAction
            },
            {
              primary: row.whyItMatters
            }
          ]
        }))
      },
      {
        title: "Decision Notes",
        subtitle: "Saved notes for each decision: current status, owner, and latest reason or resolution.",
        rowLabel: "Decision Item",
        rows: decisionGovernanceRows.map((decisionRow) => {
          const [decisionKey, decisionLabel] = decisionRow.split("::");
          return {
            label: decisionLabel,
            cells: runs.map((run) => {
              const entry = extrasByRunId
                .get(run.id)
                ?.decisionLog.find((item) => item.key === decisionKey);

              if (!entry) {
                return {
                  primary: "Not available",
                  muted: true
                };
              }

              return {
                primary: `${getDecisionLogStatusLabel(entry.status)} · ${getDecisionGovernanceStatusLabel(entry.governance_status ?? "draft")}`,
                secondary: `${entry.governance_owner || entry.owner || "Unassigned"} · ${entry.resolution_note ?? entry.rationale}`,
                tone: getTone(
                  entry.governance_status === "accepted"
                    ? "candidate"
                    : entry.governance_status === "rejected"
                      ? "rejected"
                      : entry.governance_status === "deferred"
                        ? "risky"
                        : entry.status === "recommended"
                          ? "candidate"
                          : entry.status === "pending_founder"
                            ? "risky"
                            : entry.status === "blocked"
                              ? "rejected"
                              : "info"
                )
              };
            })
          };
        })
      },
      {
        title: "Data vs Assumptions",
        subtitle: "Shows which values come from uploaded data, which are editable, and which are assumptions or calculated outputs.",
        rowLabel: "Item",
        rows: decisionSupport.truthAssumptionMatrix.map((item) => ({
          label: item.label,
          cells: runs.map((_, index) => ({
            primary: getTruthClassificationLabel(item.classification),
            secondary: index === 0 ? `${item.value} · ${item.note}` : "Same comparison-level classification",
            tone: getTone(item.classification === "historical_truth" ? "candidate" : item.classification === "scenario_assumption" ? "risky" : item.classification === "locked_boundary" ? "pending" : "info"),
            muted: index > 0
          }))
        }))
      },
      {
        title: "ALPHA Flow Comparison",
        subtitle: "Shows ALPHA issued, used, held, and sent to the cash-out path.",
        rowLabel: "ALPHA Metric",
        rows: buildMetricRows(runs, compareAlphaMetricKeys)
      },
      {
        title: "Treasury Safety Comparison",
        subtitle: "Health signals for payout pressure, reserve runway, internal use, and reward concentration.",
        rowLabel: "Safety Metric",
        rows: buildMetricRows(runs, compareTreasuryMetricKeys)
      },
      {
        title: "Distribution View",
        subtitle: "Shows which member group or source receives the largest share of ALPHA and cash impact.",
        rowLabel: "Distribution Measure",
        rows: [
          {
            label: "Largest Member Group",
            cells: runs.map((run) => {
              const largestTier = findLargestSegment(run, "member_tier", "reward_share_pct");
              return {
                primary: largestTier ? `${largestTier.label} · ${formatCommonMetricValue("reward_share_pct", largestTier.value)}` : "Not available",
                muted: !largestTier
              };
            })
          },
          {
            label: "Largest ALPHA Source",
            cells: runs.map((run) => {
              const largestSource = findLargestSegment(run, "source_system", "alpha_issued_total");
              const totalIssued = getSummaryValue(run, "alpha_issued_total");
              const share = largestSource && totalIssued > 0 ? (largestSource.value / totalIssued) * 100 : 0;
              return {
                primary: largestSource ? `${largestSource.label} · ${formatCommonMetricValue("reward_share_pct", share)}` : "Not available",
                muted: !largestSource
              };
            })
          },
          {
            label: "BGC Net Cash Change",
            cells: runs.map((run) => ({
              primary: formatCommonMetricValue(
                "company_net_treasury_delta_total",
                findSegmentValue(run, "source_system", "bgc", "company_net_treasury_delta_total")
              )
            }))
          },
          {
            label: "iBLOOMING Net Cash Change",
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
        title: "Goal Comparison",
        subtitle: "Shows each goal's status, score, evidence level, and main reason.",
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
                scorecard.primary_metrics[0] ?? scorecard.reasons[0] ?? "No reason recorded"
              }`,
              tone: getTone(scorecard.status)
            };
          })
        }))
      },
      {
        title: "Phase Comparison",
        subtitle: "Phase status, payout pressure, reserve runway, cash paid out, and net cash change.",
        rowLabel: "Phase",
        rows: milestoneKeys.length === 0
          ? [
              {
                label: "Phase results",
                cells: runs.map(() => ({
                  primary: "No phase results yet.",
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
                      primary: "Not available",
                      muted: true
                    };
                  }

                  return {
                    primary: getPolicyStatusLabel(milestone.policy_status),
                    secondary: `${formatCommonMetricValue("payout_inflow_ratio", milestone.summary_metrics.payout_inflow_ratio)} | ${formatMonthCountLabel(milestone.summary_metrics.reserve_runway_months)} | Net Cash ${formatCommonMetricValue("company_net_treasury_delta_total", milestone.summary_metrics.company_net_treasury_delta_total)}`,
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
  const format = searchParams.get("format")?.toLowerCase() ?? "pdf";
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

  if (format === "json") {
    return NextResponse.json(report, {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename(filenameSeed)}.json"`
      }
    });
  }

  if (format === "md" || format === "markdown") {
    return new NextResponse(renderCompareReportMarkdown(report), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildFilename(filenameSeed)}.md"`
      }
    });
  }

  return new NextResponse(renderCompareReportPdf(report), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildFilename(filenameSeed)}.pdf"`
    }
  });
}
