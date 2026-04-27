"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  formatCommonMetricValue,
  formatMonthCountLabel,
  getCommonMetricLabel,
  getHistoricalTruthCoverageLabel,
  getDecisionGovernanceStatusLabel,
  getEvidenceLevelLabel,
  getCanonicalGapStatusLabel,
  getPolicyStatusLabel,
  getRunReference,
  getRunStatusLabel,
  getSegmentKeyLabel
} from "@/lib/common-language";
import {
  compareAlphaMetricKeys,
  compareCashflowMetricKeys,
  compareMetricOptimization,
  compareRadarDimensions,
  compareSeriesColors,
  compareTreasuryMetricKeys
} from "@/lib/compare-config";
import { buildCompareDecisionSupportArtifacts } from "@/lib/decision-support";

import { CompareRadarChart } from "./compare-radar-chart";

type RunSummaryMetric = {
  metricKey: string;
  metricValue: number;
};

type RunSegmentMetric = {
  segmentType: string;
  segmentKey: string;
  metricKey: string;
  metricValue: number;
};

type CompareRun = {
  id: string;
  status: string;
  completedAt: string | null;
  scenario: { name: string };
  snapshot: { name: string };
  summaryMetrics: RunSummaryMetric[];
  segmentMetrics: RunSegmentMetric[];
};

type RunExtra = {
  runId: string;
  verdict: string;
  parameters: {
    scenario_mode_label: string;
    forecast_mode_caveat: string | null;
    k_pc: number;
    k_sp: number;
    reward_global_factor: number;
    reward_pool_factor: number;
    cap_user_monthly: string;
    cap_group_monthly: string;
    sink_target: number;
    cashout_mode: "ALWAYS_OPEN" | "WINDOWS";
    cashout_min_usd: number;
    cashout_fee_bps: number;
    cashout_windows_per_year: number;
    cashout_window_days: number;
    projection_horizon_months: number | null;
    milestone_count: number;
    cohort_projection_label: string;
  };
  strategicObjectives: {
    objective_key: string;
    label: string;
    status: string;
    score: number;
    evidence_level: string;
    primary_metrics: string[];
    reasons: string[];
  }[];
  milestoneEvaluations: {
    milestone_key: string;
    label: string;
    start_period_key: string;
    end_period_key: string;
    policy_status: string;
    reasons: string[];
    summary_metrics: {
      alpha_cashout_equivalent_total: number;
      company_actual_payout_out_total: number;
      company_gross_cash_in_total: number;
      company_net_treasury_delta_total: number;
      payout_inflow_ratio: number;
      reserve_runway_months: number;
      reward_concentration_top10_pct: number;
    };
  }[];
  historicalTruthCoverage: {
    status: "strong" | "partial" | "weak";
    summary: string;
    rows: {
      key: string;
      label: string;
      status: "available" | "partial" | "missing";
      detail: string;
    }[];
  } | null;
  recommendedSetup: {
    title: string;
    summary: string;
    items: {
      parameter_key: string;
      label: string;
      value: string;
      status: "recommended" | "caution" | "locked";
      rationale: string;
    }[];
    warnings: string[];
  } | null;
  decisionLog: {
    key: string;
    title: string;
    status: "fixed_truth" | "recommended" | "pending_founder" | "blocked";
    owner: string;
    rationale: string;
    governance_status: "draft" | "proposed" | "accepted" | "rejected" | "deferred" | null;
    governance_owner: string;
    resolution_note: string | null;
    reviewed_at: string | null;
    reviewed_by_user_id: string | null;
  }[];
  truthAssumptionMatrix: {
    key: string;
    label: string;
    value: string;
    classification: "historical_truth" | "scenario_lever" | "scenario_assumption" | "locked_boundary" | "derived_assessment";
    note: string;
  }[];
  canonicalGapAudit: {
    readiness: "strong" | "partial" | "weak";
    summary: string;
    rows: {
      key: string;
      label: string;
      status: "covered" | "partial" | "missing";
      detail: string;
    }[];
  } | null;
  adoptedBaselineRunId: string | null;
  adoptedBaselineAt: string | null;
  adoptedBaselineNote: string | null;
};

type CompareConsoleProps = {
  runs: CompareRun[];
  metricKeys: readonly string[];
  metricOptimization: Record<string, "lower" | "higher">;
  strategicObjectiveOrder: readonly string[];
  strategicObjectiveLabels: Record<string, string>;
  runExtras: RunExtra[];
};

const maxComparedRuns = 5;
const defaultSelectedRuns = 2;

function getVerdictBadge(status: string) {
  if (status === "candidate" || status === "approved") return "badge--candidate";
  if (status === "risky" || status === "caution") return "badge--risky";
  if (status === "rejected" || status === "failed") return "badge--rejected";
  return "badge--neutral";
}

function findSegmentValue(run: CompareRun, segmentType: string, segmentKey: string, metricKey: string) {
  return run.segmentMetrics.find(
    (metric) =>
      metric.segmentType === segmentType &&
      metric.segmentKey.toLowerCase() === segmentKey.toLowerCase() &&
      metric.metricKey === metricKey
  )?.metricValue ?? 0;
}

function findLargestSegment(run: CompareRun, segmentType: string, metricKey: string) {
  const largest = run.segmentMetrics
    .filter((metric) => metric.segmentType === segmentType && metric.metricKey === metricKey)
    .sort((left, right) => right.metricValue - left.metricValue)[0];

  if (!largest) return null;

  return {
    label: getSegmentKeyLabel(largest.segmentKey),
    value: largest.metricValue
  };
}

function formatRunOption(run: CompareRun, label: string) {
  return `${label} ${getRunReference(run.id)} ${run.snapshot.name}`.toLowerCase();
}

export function CompareConsole({
  runs,
  metricOptimization,
  strategicObjectiveOrder,
  strategicObjectiveLabels,
  runExtras
}: CompareConsoleProps) {
  const runDisplayLabels = useMemo(() => {
    const nameCount = new Map<string, number>();
    for (const run of runs) {
      nameCount.set(run.scenario.name, (nameCount.get(run.scenario.name) ?? 0) + 1);
    }
    const labels = new Map<string, string>();
    for (const run of runs) {
      if ((nameCount.get(run.scenario.name) ?? 0) > 1) {
        labels.set(run.id, `${run.scenario.name} · ${getRunReference(run.id)}`);
      } else {
        labels.set(run.id, run.scenario.name);
      }
    }
    return labels;
  }, [runs]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    runs.slice(0, Math.min(defaultSelectedRuns, maxComparedRuns)).forEach((run) => initial.add(run.id));
    return initial;
  });
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorNotice, setSelectorNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUrlHydrated, setIsUrlHydrated] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const availableIds = new Set(runs.map((run) => run.id));
    const requestedIds = new URLSearchParams(window.location.search)
      .getAll("run")
      .filter((id) => availableIds.has(id))
      .slice(0, maxComparedRuns);

    if (requestedIds.length > 0) {
      setSelectedIds(new Set(requestedIds));
    }

    setIsUrlHydrated(true);
  }, [runs]);

  const filteredRuns = useMemo(
    () => runs.filter((run) => selectedIds.has(run.id)),
    [runs, selectedIds]
  );
  const selectedRunIds = useMemo(() => filteredRuns.map((run) => run.id), [filteredRuns]);

  useEffect(() => {
    if (!isUrlHydrated) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    selectedRunIds.forEach((runId) => url.searchParams.append("run", runId));
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [isUrlHydrated, selectedRunIds]);

  const extrasByRunId = useMemo(
    () => new Map(runExtras.map((extra) => [extra.runId, extra] as const)),
    [runExtras]
  );
  const summaryByRunId = useMemo(
    () =>
      new Map(
        runs.map((run) => [
          run.id,
          new Map(run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const))
        ] as const)
      ),
    [runs]
  );
  const filteredExtras = useMemo(
    () => runExtras.filter((extra) => selectedIds.has(extra.runId)),
    [runExtras, selectedIds]
  );

  const matchingRuns = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const matches = query
      ? runs.filter((run) => formatRunOption(run, runDisplayLabels.get(run.id) ?? run.scenario.name).includes(query))
      : runs;

    return [...matches].sort((left, right) => {
      const leftSelected = selectedIds.has(left.id) ? 1 : 0;
      const rightSelected = selectedIds.has(right.id) ? 1 : 0;
      return rightSelected - leftSelected;
    });
  }, [deferredSearchQuery, runDisplayLabels, runs, selectedIds]);

  const compareExportBaseHref = useMemo(() => {
    if (filteredRuns.length < 2) return null;

    const params = new URLSearchParams();
    filteredRuns.forEach((run) => params.append("runId", run.id));
    return `/api/compare/export?${params.toString()}`;
  }, [filteredRuns]);

  const milestoneRows = useMemo(() => {
    return [
      ...new Set(
        filteredExtras.flatMap((extra) =>
          extra.milestoneEvaluations.map((milestone) => `${milestone.milestone_key}::${milestone.label}`)
        )
      )
    ];
  }, [filteredExtras]);

  const truthCoverageRows = useMemo(() => {
    return [
      ...new Set(
        filteredExtras.flatMap((extra) =>
          (extra.historicalTruthCoverage?.rows ?? []).map((row) => `${row.key}::${row.label}`)
        )
      )
    ];
  }, [filteredExtras]);
  const canonicalGapRows = useMemo(() => {
    return [
      ...new Set(
        filteredExtras.flatMap((extra) =>
          (extra.canonicalGapAudit?.rows ?? []).map((row) => `${row.key}::${row.label}`)
        )
      )
    ];
  }, [filteredExtras]);
  const decisionGovernanceRows = useMemo(() => {
    return [
      ...new Set(
        filteredExtras.flatMap((extra) => extra.decisionLog.map((entry) => `${entry.key}::${entry.title}`))
      )
    ];
  }, [filteredExtras]);

  const radarData = useMemo(() => {
    if (filteredRuns.length === 0) {
      return { dimensions: [] as { name: string; max: number }[], series: [] as { name: string; color: string; values: number[] }[] };
    }

    const maxIssued = Math.max(
      1,
      ...filteredRuns.map((run) => summaryByRunId.get(run.id)?.get("alpha_issued_total") ?? 0)
    );
    const dimensions = compareRadarDimensions.map((dimension) => ({
      name: dimension.name,
      max: dimension.max === 0 ? maxIssued * 1.2 : dimension.max
    }));
    const series = filteredRuns.map((run) => {
      const globalIdx = runs.findIndex((item) => item.id === run.id);
      const metrics = summaryByRunId.get(run.id) ?? new Map<string, number>();
      return {
        name: runDisplayLabels.get(run.id) ?? run.scenario.name,
        color: compareSeriesColors[globalIdx % compareSeriesColors.length],
        values: compareRadarDimensions.map((dimension) => {
          const raw = metrics.get(dimension.key) ?? 0;
          if (dimension.invert) {
            const maxValue = dimension.max === 0 ? maxIssued * 1.2 : dimension.max;
            return Math.max(0, maxValue - raw);
          }
          return raw;
        })
      };
    });

    return { dimensions, series };
  }, [filteredRuns, runDisplayLabels, runs, summaryByRunId]);

  const decisionSupport = useMemo(() => {
    return buildCompareDecisionSupportArtifacts(
      filteredRuns.map((run) => {
        const extra = extrasByRunId.get(run.id);

        return {
          id: run.id,
          label: runDisplayLabels.get(run.id) ?? run.scenario.name,
          scenarioName: run.scenario.name,
          snapshotName: run.snapshot.name,
          verdict: extra?.verdict ?? "pending",
          summaryMetrics: Object.fromEntries(
            run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const)
          ),
          parameters:
            extra?.parameters ?? {
              scenario_mode_label: "Imported Data Only",
              forecast_mode_caveat: null,
              k_pc: 1,
              k_sp: 1,
              reward_global_factor: 1,
              reward_pool_factor: 1,
              cap_user_monthly: "0",
              cap_group_monthly: "0",
              sink_target: 0,
              cashout_mode: "WINDOWS",
              cashout_min_usd: 0,
              cashout_fee_bps: 0,
              cashout_windows_per_year: 0,
              cashout_window_days: 0,
              projection_horizon_months: null,
              milestone_count: 0,
              cohort_projection_label: "off in Imported Data Only"
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
  }, [extrasByRunId, filteredRuns, runDisplayLabels]);

  function getMetricValue(run: CompareRun, metricKey: string) {
    return summaryByRunId.get(run.id)?.get(metricKey) ?? 0;
  }

  function getMetricCellClass(metricKey: string, value: number, values: number[]) {
    const uniqueValues = new Set(values.map((item) => item.toFixed(8)));
    if (values.length <= 1 || uniqueValues.size <= 1) return "";

    const optimization = metricOptimization[metricKey] ?? compareMetricOptimization[metricKey];
    if (!optimization) return "";

    const bestValue = optimization === "higher" ? Math.max(...values) : Math.min(...values);
    const worstValue = optimization === "higher" ? Math.min(...values) : Math.max(...values);

    if (value === bestValue) return "cell-best";
    if (value === worstValue) return "cell-worst";
    return "";
  }

  function getDecisionLogBadge(status: string) {
    if (status === "recommended") return "badge--candidate";
    if (status === "pending_founder") return "badge--risky";
    if (status === "blocked") return "badge--rejected";
    return "badge--neutral";
  }

  function getDecisionLogStatusLabel(status: string) {
    if (status === "fixed_truth") return "Imported Data";
    if (status === "recommended") return "Recommended";
    if (status === "pending_founder") return "Decision Needed";
    if (status === "blocked") return "Blocked";
    return status;
  }

  function getTruthClassificationLabel(classification: string) {
    switch (classification) {
      case "historical_truth":
        return "Imported Data";
      case "scenario_lever":
        return "Editable";
      case "scenario_assumption":
        return "Assumption";
      case "locked_boundary":
        return "Locked";
      case "derived_assessment":
        return "Calculated";
      default:
        return classification;
    }
  }

  function getSimulationSummaryBadge(status: string) {
    if (status === "ready") return "badge--candidate";
    if (status === "review") return "badge--risky";
    if (status === "blocked") return "badge--rejected";
    return "badge--info";
  }

  function getSimulationSummaryStatusLabel(status: string) {
    if (status === "ready") return "Ready";
    if (status === "review") return "Needs Review";
    if (status === "blocked") return "Blocked";
    return "Info";
  }

  function getFounderQuestionBadge(status: string) {
    if (status === "recommended") return "badge--candidate";
    if (status === "pending_founder") return "badge--risky";
    return "badge--rejected";
  }

  function getFounderQuestionStatusLabel(status: string) {
    if (status === "recommended") return "Recommended";
    if (status === "pending_founder") return "Decision Needed";
    return "Blocked";
  }

  function getParameterClassificationLabel(classification: string) {
    if (classification === "scenario_lever") return "Editable";
    if (classification === "scenario_assumption") return "Assumption";
    return "Locked";
  }

  function getParameterClassificationBadge(classification: string) {
    if (classification === "scenario_lever") return "badge--candidate";
    if (classification === "scenario_assumption") return "badge--risky";
    return "badge--neutral";
  }

  function getImplementationPlanBadge(status: string) {
    if (status === "ready") return "badge--candidate";
    if (status === "in_progress") return "badge--risky";
    if (status === "blocked") return "badge--rejected";
    return "badge--neutral";
  }

  function getImplementationPlanStatusLabel(status: string) {
    if (status === "ready") return "Ready";
    if (status === "in_progress") return "In Progress";
    if (status === "blocked") return "Blocked";
    return "Deferred";
  }

  function getFinancialPostureBadge(posture: string) {
    if (posture === "Safety-First" || posture === "Working Baseline") return "badge--candidate";
    if (posture === "Expansion") return "badge--risky";
    if (posture === "Shock Case") return "badge--rejected";
    return "badge--neutral";
  }

  function toggleRun(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        if (next.size <= 1) {
          setSelectorNotice("Keep at least one result selected.");
          return prev;
        }
        next.delete(id);
        setSelectorNotice(null);
        return next;
      }

      if (next.size >= maxComparedRuns) {
        setSelectorNotice(`You can compare up to ${maxComparedRuns} results so charts and tables stay readable.`);
        return prev;
      }

      next.add(id);
      setSelectorNotice(null);
      return next;
    });
  }

  function resetSelection() {
    setSelectedIds(new Set(runs.slice(0, Math.min(defaultSelectedRuns, maxComparedRuns)).map((run) => run.id)));
    setSelectorNotice(null);
  }

  function selectVisible() {
    const next = new Set(matchingRuns.slice(0, maxComparedRuns).map((run) => run.id));
    if (next.size > 0) {
      setSelectedIds(next);
      setSelectorNotice(null);
    }
  }

  function renderMetricRows(metricKeys: readonly string[]) {
    return metricKeys.map((metricKey) => {
      const values = filteredRuns.map((run) => getMetricValue(run, metricKey));

      return (
        <tr key={metricKey}>
          <td>
            <strong>{getCommonMetricLabel(metricKey)}</strong>
          </td>
          {filteredRuns.map((run, index) => {
            const value = values[index] ?? 0;
            return (
              <td key={`${run.id}-${metricKey}`} className={getMetricCellClass(metricKey, value, values)}>
                {formatCommonMetricValue(metricKey, value)}
              </td>
            );
          })}
        </tr>
      );
    });
  }

  function renderMetricTable(title: string, subtitle: string, metricKeys: readonly string[]) {
    return (
      <div className="card span-12">
        <h3>{title}</h3>
        <p className="muted compare-section-note">{subtitle}</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                {filteredRuns.map((run) => {
                  const globalIdx = runs.findIndex((item) => item.id === run.id);
                  return (
                    <th key={`${run.id}-${title}`}>
                      <span className="compare-table-heading">
                        <span
                          className="scenario-chip-dot"
                          style={{
                            background: compareSeriesColors[globalIdx % compareSeriesColors.length],
                            height: "8px",
                            opacity: 1,
                            width: "8px"
                          }}
                        />
                        {runDisplayLabels.get(run.id) ?? run.scenario.name}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>{renderMetricRows(metricKeys)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="scenario-selector compare-selector-card">
        <div className="compare-selected-bar">
          <div>
            <span className="scenario-selector-label">
              Choose results to compare
              <span className="scenario-selector-count">{selectedIds.size}/{runs.length}</span>
            </span>
            <p className="compare-selector-subcopy">
              Pick 2-5 completed results. The page link updates so you can reopen the same comparison.
            </p>
          </div>
          <div className="scenario-selector-actions">
            {compareExportBaseHref ? (
              <>
                <a className="selector-action-btn" href={`${compareExportBaseHref}&format=pdf`}>
                  Download Report PDF
                </a>
                <a className="selector-action-btn" href={`${compareExportBaseHref}&format=md`}>
                  Download Notes
                </a>
                <a className="selector-action-btn" href={`${compareExportBaseHref}&format=json`}>
                  Download Data
                </a>
              </>
            ) : (
              <>
                <span className="selector-action-btn selector-action-btn--disabled">Download Report PDF</span>
                <span className="selector-action-btn selector-action-btn--disabled">Download Notes</span>
                <span className="selector-action-btn selector-action-btn--disabled">Download Data</span>
              </>
            )}
            <button className="selector-action-btn" onClick={() => setSelectorOpen((value) => !value)} type="button">
              {selectorOpen ? "Close List" : "Change Results"}
            </button>
            <button className="selector-action-btn" onClick={resetSelection} type="button">Reset</button>
          </div>
        </div>

        <div className="compare-selected-list">
          {filteredRuns.map((run) => {
            const globalIdx = runs.findIndex((item) => item.id === run.id);
            return (
              <button
                className="scenario-chip"
                data-selected="true"
                key={run.id}
                onClick={() => toggleRun(run.id)}
                type="button"
              >
                <span className="scenario-chip-dot" style={{ background: compareSeriesColors[globalIdx % compareSeriesColors.length] }} />
                <span className="scenario-chip-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                {runDisplayLabels.get(run.id) ?? run.scenario.name}
              </button>
            );
          })}
        </div>

        {selectorNotice ? <p className="scenario-selector-hint">{selectorNotice}</p> : null}
        {selectedIds.size < 2 ? (
          <p className="scenario-selector-hint">Choose at least 2 results to compare side by side.</p>
        ) : null}

        {selectorOpen ? (
          <div className="compare-manage-panel">
            <div className="compare-search-row">
              <label htmlFor="compare-run-search">Find result</label>
              <input
                id="compare-run-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, ref, or data snapshot"
                type="search"
                value={searchQuery}
              />
              <button className="selector-action-btn" onClick={selectVisible} type="button">
                Select Shown
              </button>
            </div>

            <div className="compare-run-list">
              {matchingRuns.map((run) => {
                const isSelected = selectedIds.has(run.id);
                const isDisabled = !isSelected && selectedIds.size >= maxComparedRuns;
                const globalIdx = runs.findIndex((item) => item.id === run.id);

                return (
                  <button
                    className="compare-run-option"
                    data-selected={isSelected}
                    disabled={isDisabled}
                    key={run.id}
                    onClick={() => toggleRun(run.id)}
                    type="button"
                  >
                    <span className="scenario-chip-dot" style={{ background: compareSeriesColors[globalIdx % compareSeriesColors.length] }} />
                    <span className="scenario-chip-check">
                      {isSelected ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </span>
                    <span>
                      <strong>{runDisplayLabels.get(run.id) ?? run.scenario.name}</strong>
                      <small>{getRunReference(run.id)} · {run.snapshot.name}</small>
                    </span>
                  </button>
                );
              })}
              {matchingRuns.length === 0 ? (
                <p className="muted">No completed results match that search.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <section className="page-grid">
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Quick Score Chart</h3>
            <p className="muted compare-section-note">
              Use this chart for a quick visual only. Use the money and treasury tables for decisions.
            </p>
            <CompareRadarChart dimensions={radarData.dimensions} series={radarData.series} />
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Summary</h3>
            <p className="muted compare-section-note">
              Plain summary of the selected results, strongest choice, treasury safety, and data quality.
            </p>
            <div className="decision-summary">
              <div className="decision-summary__verdict">
                <span className={`badge ${
                  decisionSupport.simulationSummary.status === "recommended"
                    ? "badge--candidate"
                    : decisionSupport.simulationSummary.status === "review"
                      ? "badge--risky"
                      : "badge--rejected"
                }`}>
                  {decisionSupport.simulationSummary.status === "recommended"
                    ? "Recommended"
                    : decisionSupport.simulationSummary.status === "review"
                      ? "Needs Review"
                      : "Blocked"}
                </span>
                <p style={{ marginTop: "0.75rem" }}>{decisionSupport.simulationSummary.summary}</p>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>What It Shows</th>
                    <th>Why It Matters</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.simulationSummary.rows.map((row) => (
                    <tr key={row.key}>
                      <td><strong>{row.label}</strong></td>
                      <td>
                        <span className={`badge ${getSimulationSummaryBadge(row.status)}`}>
                          {getSimulationSummaryStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.currentReadout}</td>
                      <td>{row.implication}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Status Memo</h3>
            <p className="muted compare-section-note">
              Short memo for review. Shows whether this comparison is ready, blocked, or still needs a decision.
            </p>
            <div className="decision-summary">
              <div className="decision-summary__verdict">
                <span className={`badge ${
                  decisionSupport.executiveStatusMemo.status === "recommended"
                    ? "badge--candidate"
                    : decisionSupport.executiveStatusMemo.status === "review"
                      ? "badge--risky"
                      : "badge--rejected"
                }`}>
                  {decisionSupport.executiveStatusMemo.status === "recommended"
                    ? "Ready to Use"
                    : decisionSupport.executiveStatusMemo.status === "review"
                      ? "Decision Required"
                      : "Blocked"}
                </span>
                <p style={{ marginTop: "0.75rem" }}>{decisionSupport.executiveStatusMemo.summary}</p>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Memo Item</th>
                    <th>Status</th>
                    <th>What It Shows</th>
                    <th>Why It Matters</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.executiveStatusMemo.rows.map((row) => (
                    <tr key={row.key}>
                      <td><strong>{row.label}</strong></td>
                      <td>
                        <span className={`badge ${getSimulationSummaryBadge(row.status)}`}>
                          {getSimulationSummaryStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.currentReadout}</td>
                      <td>{row.implication}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Result Cards</h3>
            <p className="muted compare-section-note">
              Each card shows money impact and treasury pressure before ALPHA policy details.
            </p>
            <div className="compare-decision-grid">
              {filteredRuns.map((run) => {
                const extra = extrasByRunId.get(run.id);
                const globalIdx = runs.findIndex((item) => item.id === run.id);
                const pressure = getMetricValue(run, "payout_inflow_ratio");
                const netDelta = getMetricValue(run, "company_net_treasury_delta_total");
                const payoutOut = getMetricValue(run, "company_actual_payout_out_total");
                const runway = getMetricValue(run, "reserve_runway_months");

                return (
                  <article className="compare-decision-card" key={run.id}>
                    <div className="compare-card-top">
                      <span className="scenario-chip-dot" style={{ background: compareSeriesColors[globalIdx % compareSeriesColors.length], opacity: 1 }} />
                      <strong>{runDisplayLabels.get(run.id) ?? run.scenario.name}</strong>
                      <span className={`badge ${getVerdictBadge(extra?.verdict ?? "pending")}`}>
                        {getPolicyStatusLabel(extra?.verdict ?? "pending")}
                      </span>
                      {extra ? (
                        <span className={`badge ${extra.parameters.forecast_mode_caveat ? "badge--risky" : "badge--info"}`}>
                          {extra.parameters.scenario_mode_label}
                        </span>
                      ) : null}
                      {extra?.adoptedBaselineRunId === run.id ? (
                        <span className="badge badge--info">Current Baseline</span>
                      ) : null}
                    </div>
                    <div className="compare-mini-grid">
                      <span>
                        <small>Net Cash Change</small>
                        <strong>{formatCommonMetricValue("company_net_treasury_delta_total", netDelta)}</strong>
                      </span>
                      <span>
                        <small>Paid Out</small>
                        <strong>{formatCommonMetricValue("company_actual_payout_out_total", payoutOut)}</strong>
                      </span>
                      <span>
                        <small>Payout Pressure</small>
                        <strong>{formatCommonMetricValue("payout_inflow_ratio", pressure)}</strong>
                      </span>
                      <span>
                        <small>Runway</small>
                        <strong>{formatMonthCountLabel(runway)}</strong>
                      </span>
                    </div>
                    {extra?.parameters.forecast_mode_caveat ? (
                      <p className="muted" style={{ marginTop: "0.75rem" }}>
                        {extra.parameters.forecast_mode_caveat}
                      </p>
                    ) : null}
                    {extra?.adoptedBaselineRunId === run.id && extra.adoptedBaselineAt ? (
                      <p className="muted" style={{ marginTop: "0.75rem" }}>
                        Adopted {new Date(extra.adoptedBaselineAt).toLocaleString("en-US")}
                        {extra.adoptedBaselineNote ? ` · ${extra.adoptedBaselineNote}` : ""}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Money View by Result</h3>
            <p className="muted compare-section-note">
              Money view for each result: cash in, revenue kept, payouts, treasury pressure, and business tradeoff.
            </p>
            <div className="compare-financial-grid">
              {decisionSupport.financialScenarioView.rows.map((row) => {
                const globalIdx = runs.findIndex((item) => item.id === row.runId);

                return (
                  <article className="compare-financial-card" key={row.runId}>
                    <div className="compare-card-top">
                      <span className="scenario-chip-dot" style={{ background: compareSeriesColors[globalIdx % compareSeriesColors.length], opacity: 1 }} />
                      <strong>{row.label}</strong>
                      <span className={`badge ${getFinancialPostureBadge(row.posture)}`}>{row.posture}</span>
                    </div>
                    <p className="compare-financial-summary">{row.summary}</p>
                    <div className="compare-financial-metrics">
                      <span>
                        <small>Cash In</small>
                        <strong>{formatCommonMetricValue("company_gross_cash_in_total", row.grossCashIn)}</strong>
                      </span>
                      <span>
                        <small>Revenue Kept</small>
                        <strong>{formatCommonMetricValue("company_retained_revenue_total", row.retainedRevenue)}</strong>
                      </span>
                      <span>
                        <small>Partner Payout</small>
                        <strong>{formatCommonMetricValue("company_partner_payout_out_total", row.partnerPayoutOut)}</strong>
                      </span>
                      <span>
                        <small>Direct Rewards Owed</small>
                        <strong>{formatCommonMetricValue("company_direct_reward_obligation_total", row.directObligations)}</strong>
                      </span>
                      <span>
                        <small>Paid Out</small>
                        <strong>{formatCommonMetricValue("company_actual_payout_out_total", row.actualPayoutOut)}</strong>
                      </span>
                      <span>
                        <small>Fulfillment Cost</small>
                        <strong>{formatCommonMetricValue("company_product_fulfillment_out_total", row.fulfillmentOut)}</strong>
                      </span>
                      <span>
                        <small>Net Cash Change</small>
                        <strong>{formatCommonMetricValue("company_net_treasury_delta_total", row.netTreasuryDelta)}</strong>
                      </span>
                      <span>
                        <small>Pressure + Runway</small>
                        <strong>{formatCommonMetricValue("payout_inflow_ratio", row.treasuryPressure)} · {formatMonthCountLabel(row.reserveRunwayMonths)}</strong>
                      </span>
                    </div>
                    <p className="compare-financial-tradeoff">
                      <strong>Tradeoff:</strong> {row.tradeoff}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0
          ? renderMetricTable(
              "Money Comparison",
              "Cash in and cash out are shown in dollars. ALPHA movement is kept separate in the ALPHA table.",
              compareCashflowMetricKeys
            )
          : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Data Completeness</h3>
            <p className="muted compare-section-note">
              Shows how complete the uploaded data is behind each result.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data Area</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-truth-coverage`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Overall Data Quality</strong></td>
                    {filteredRuns.map((run) => {
                      const coverage = extrasByRunId.get(run.id)?.historicalTruthCoverage;
                      return (
                        <td key={`${run.id}-truth-overall`}>
                          <div className="compare-rich-cell">
                            <span className={`badge ${getVerdictBadge(coverage?.status === "strong" ? "candidate" : coverage?.status === "partial" ? "risky" : "rejected")}`}>
                              {getHistoricalTruthCoverageLabel(coverage?.status ?? "weak")}
                            </span>
                            {coverage?.summary ? <p>{coverage.summary}</p> : <p>No imported data coverage summary yet.</p>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {truthCoverageRows.map((coverageRow) => {
                    const [coverageKey, coverageLabel] = coverageRow.split("::");
                    return (
                      <tr key={coverageRow}>
                        <td>{coverageLabel}</td>
                        {filteredRuns.map((run) => {
                          const coverage = extrasByRunId
                            .get(run.id)
                            ?.historicalTruthCoverage?.rows.find((row) => row.key === coverageKey);

                          if (!coverage) {
                            return <td key={`${run.id}-${coverageKey}`} className="muted">Not available</td>;
                          }

                          return (
                            <td key={`${run.id}-${coverageKey}`}>
                              <div className="compare-rich-cell">
                                <span className={`badge ${getVerdictBadge(coverage.status === "available" ? "candidate" : coverage.status === "partial" ? "risky" : "rejected")}`}>
                                  {getHistoricalTruthCoverageLabel(coverage.status)}
                                </span>
                                <p>{coverage.detail}</p>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Source Detail Check</h3>
            <p className="muted compare-section-note">
              Shows which source details are already available and which details are still missing.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Source Area</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-canonical-gap`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Overall Source Detail</strong></td>
                    {filteredRuns.map((run) => {
                      const audit = extrasByRunId.get(run.id)?.canonicalGapAudit;
                      return (
                        <td key={`${run.id}-canonical-overall`}>
                          <div className="compare-rich-cell">
                            <span className={`badge ${getVerdictBadge(audit?.readiness === "strong" ? "candidate" : audit?.readiness === "partial" ? "risky" : "rejected")}`}>
                              {audit?.readiness ?? "weak"}
                            </span>
                            {audit?.summary ? <p>{audit.summary}</p> : <p>No source detail check recorded yet.</p>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {canonicalGapRows.map((gapRow) => {
                    const [gapKey, gapLabel] = gapRow.split("::");
                    return (
                      <tr key={gapRow}>
                        <td>{gapLabel}</td>
                        {filteredRuns.map((run) => {
                          const auditRow = extrasByRunId
                            .get(run.id)
                            ?.canonicalGapAudit?.rows.find((row) => row.key === gapKey);

                          if (!auditRow) {
                            return <td key={`${run.id}-${gapKey}`} className="muted">Not available</td>;
                          }

                          return (
                            <td key={`${run.id}-${gapKey}`}>
                              <div className="compare-rich-cell">
                                <span className={`badge ${getVerdictBadge(auditRow.status === "covered" ? "candidate" : auditRow.status === "partial" ? "risky" : "rejected")}`}>
                                  {getCanonicalGapStatusLabel(auditRow.status)}
                                </span>
                                <p>{auditRow.detail}</p>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Recommended Setup</h3>
            <p className="muted compare-section-note">
              Best current setup from the selected results. This changes policy settings only, not uploaded data.
            </p>
            <div className="decision-summary">
              <div className="decision-summary__verdict">
                <span className={`badge ${getVerdictBadge(
                  decisionSupport.recommendedEnvelope.status === "recommended"
                    ? "candidate"
                    : decisionSupport.recommendedEnvelope.status === "review"
                      ? "risky"
                      : "rejected"
                )}`}>
                  {decisionSupport.recommendedEnvelope.status === "recommended"
                    ? "Recommended"
                    : decisionSupport.recommendedEnvelope.status === "review"
                      ? "Needs Review"
                      : "Blocked"}
                </span>
                <p style={{ marginTop: "0.75rem" }}>{decisionSupport.recommendedEnvelope.summary}</p>
                {decisionSupport.recommendedEnvelope.recommendedRunLabel ? (
                  <p className="muted" style={{ marginTop: "0.5rem" }}>
                    Current strongest result: <strong>{decisionSupport.recommendedEnvelope.recommendedRunLabel}</strong>
                  </p>
                ) : null}
              </div>
              <div className="decision-summary__meta">
                {decisionSupport.recommendedEnvelope.reasons.map((reason) => (
                  <div key={reason}>
                    <span>Reason</span>
                    <strong>{reason}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Setup Item</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.recommendedEnvelope.items.map((item) => (
                    <tr key={item.label}>
                      <td><strong>{item.label}</strong></td>
                      <td>{item.value}</td>
                      <td>
                        <span className={`badge ${item.status === "recommended" ? "badge--candidate" : item.status === "caution" ? "badge--risky" : "badge--neutral"}`}>
                          {item.status === "recommended" ? "Recommended" : item.status === "caution" ? "Assumption" : "Locked"}
                        </span>
                      </td>
                      <td>{item.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Parameter Guide</h3>
            <p className="muted compare-section-note">
              Guide for each setting: what it means, what values were tested, the current default, and who should decide.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Meaning</th>
                    <th>Tested Values</th>
                    <th>Current Default</th>
                    <th>Suggested Choice</th>
                    <th>Decision Owner</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.parameterRegistry.map((row) => (
                    <tr key={row.parameterKey}>
                      <td>
                        <strong>{row.label}</strong>
                        <div className="muted" style={{ fontSize: "0.74rem", marginTop: "0.25rem" }}>
                          <code>{row.symbol}</code>
                        </div>
                      </td>
                      <td>{row.description}</td>
                      <td>{row.testedRange}</td>
                      <td>{row.workingDefault}</td>
                      <td>{row.currentRecommended}</td>
                      <td>{row.decisionOwner}</td>
                      <td>
                        <div className="compare-rich-cell">
                          <span className={`badge ${getParameterClassificationBadge(row.classification)}`}>
                            {getParameterClassificationLabel(row.classification)}
                          </span>
                          <small>
                            Rule: {
                              row.guardrailStatus === "allowed"
                                ? "Editable"
                                : row.guardrailStatus === "conditional"
                                  ? "Assumption"
                                  : "Locked"
                            }
                          </small>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Parameter Ranges</h3>
            <p className="muted compare-section-note">
              Values tested across the selected results, grouped into recommended, use-with-care, and do-not-use ranges.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Status</th>
                    <th>Recommended Values</th>
                    <th>Use With Care</th>
                    <th>Do Not Use</th>
                    <th>Tested Values</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.parameterRanges.map((row) => (
                    <tr key={row.parameterKey}>
                      <td>
                        <strong>{row.label}</strong>
                        <div className="muted" style={{ fontSize: "0.74rem", marginTop: "0.25rem" }}>{row.rationale}</div>
                      </td>
                      <td>
                        <span className={`badge ${row.guardrailStatus === "allowed" ? "badge--candidate" : row.guardrailStatus === "conditional" ? "badge--risky" : "badge--neutral"}`}>
                          {row.guardrailStatus === "allowed" ? "Editable" : row.guardrailStatus === "conditional" ? "Assumption" : "Locked"}
                        </span>
                      </td>
                      <td>{row.recommendedValues}</td>
                      <td>{row.cautionValues ?? "Not set"}</td>
                      <td>{row.rejectedValues ?? "Not set"}</td>
                      <td>{row.testedValues}</td>
                      <td>{row.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Open Decisions</h3>
            <p className="muted compare-section-note">
              Decisions that still need a clear answer before the Whitepaper and Token Flow can be treated as final.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Status</th>
                    <th>Why It Matters</th>
                    <th>Suggested Answer</th>
                    <th>Decision Owner</th>
                    <th>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.founderQuestionQueue.map((row) => (
                    <tr key={row.key}>
                      <td><strong>{row.question}</strong></td>
                      <td>
                        <span className={`badge ${getFounderQuestionBadge(row.status)}`}>
                          {getFounderQuestionStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.whyNow}</td>
                      <td>{row.recommendedDirection}</td>
                      <td>{row.decisionOwner}</td>
                      <td>{row.decisionOptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Next Build Steps</h3>
            <p className="muted compare-section-note">
              Practical build steps needed to close the brief package without adding unnecessary engine work.
            </p>
            <div className="decision-summary">
              <div className="decision-summary__verdict">
                <p>{decisionSupport.technicalImplementationPlan.summary}</p>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Work Area</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Next Action</th>
                    <th>Why It Matters</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.technicalImplementationPlan.rows.map((row) => (
                    <tr key={row.key}>
                      <td><strong>{row.label}</strong></td>
                      <td>{row.owner}</td>
                      <td>
                        <span className={`badge ${getImplementationPlanBadge(row.status)}`}>
                          {getImplementationPlanStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.nextAction}</td>
                      <td>{row.whyItMatters}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Decision Notes</h3>
            <p className="muted compare-section-note">
              Saved notes for each decision: current status, owner, and latest reason or resolution.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Decision Item</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-decision-governance`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {decisionGovernanceRows.map((decisionRow) => {
                    const [decisionKey, decisionTitle] = decisionRow.split("::");
                    return (
                      <tr key={decisionRow}>
                        <td><strong>{decisionTitle}</strong></td>
                        {filteredRuns.map((run) => {
                          const entry = extrasByRunId
                            .get(run.id)
                            ?.decisionLog.find((item) => item.key === decisionKey);

                          if (!entry) {
                            return <td key={`${run.id}-${decisionKey}`} className="muted">Not available</td>;
                          }

                          return (
                            <td key={`${run.id}-${decisionKey}`}>
                              <div className="compare-rich-cell">
                                <span className={`badge ${getDecisionLogBadge(entry.status)}`}>
                                  {getDecisionLogStatusLabel(entry.status)}
                                </span>
                                <small>
                                  Review status: {getDecisionGovernanceStatusLabel(entry.governance_status ?? "draft")} · {entry.governance_owner}
                                </small>
                                {entry.resolution_note ? <p>{entry.resolution_note}</p> : <p>{entry.rationale}</p>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Data vs Assumptions</h3>
            <p className="muted compare-section-note">
              Shows which values come from uploaded data, which are editable, and which are assumptions or calculated outputs.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Value</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionSupport.truthAssumptionMatrix.map((item) => (
                    <tr key={item.key}>
                      <td><strong>{item.label}</strong></td>
                      <td>
                        <span className={`badge ${
                          item.classification === "historical_truth"
                            ? "badge--candidate"
                            : item.classification === "scenario_assumption"
                              ? "badge--risky"
                              : item.classification === "locked_boundary"
                                ? "badge--neutral"
                                : "badge--info"
                        }`}>
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
          </div>
        ) : null}

        {filteredRuns.length > 0
          ? renderMetricTable(
              "ALPHA Flow Comparison",
              "Shows ALPHA issued, used, held, and sent to the cash-out path.",
              compareAlphaMetricKeys
            )
          : null}

        {filteredRuns.length > 0
          ? renderMetricTable(
              "Treasury Safety Comparison",
              "Health signals for payout pressure, reserve runway, internal use, and reward concentration.",
              compareTreasuryMetricKeys
            )
          : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Distribution View</h3>
            <p className="muted compare-section-note">
              Shows which member group or source receives the largest share of ALPHA and cash impact.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Measure</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-distribution`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Largest Member Group</strong></td>
                    {filteredRuns.map((run) => {
                      const largestTier = findLargestSegment(run, "member_tier", "reward_share_pct");
                      return (
                        <td key={`${run.id}-largest-tier`}>
                          {largestTier ? `${largestTier.label} · ${formatCommonMetricValue("reward_share_pct", largestTier.value)}` : "Not available"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td><strong>Largest ALPHA Source</strong></td>
                    {filteredRuns.map((run) => {
                      const largestSource = findLargestSegment(run, "source_system", "alpha_issued_total");
                      const totalIssued = getMetricValue(run, "alpha_issued_total");
                      const share = largestSource && totalIssued > 0 ? (largestSource.value / totalIssued) * 100 : 0;
                      return (
                        <td key={`${run.id}-largest-source`}>
                          {largestSource ? `${largestSource.label} · ${formatCommonMetricValue("reward_share_pct", share)}` : "Not available"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td><strong>BGC Net Cash Change</strong></td>
                    {filteredRuns.map((run) => (
                      <td key={`${run.id}-bgc-net`}>
                        {formatCommonMetricValue("company_net_treasury_delta_total", findSegmentValue(run, "source_system", "bgc", "company_net_treasury_delta_total"))}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>iBLOOMING Net Cash Change</strong></td>
                    {filteredRuns.map((run) => (
                      <td key={`${run.id}-ib-net`}>
                        {formatCommonMetricValue("company_net_treasury_delta_total", findSegmentValue(run, "source_system", "iblooming", "company_net_treasury_delta_total"))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Goal Comparison</h3>
            <p className="muted compare-section-note">
              Shows each goal&apos;s status, score, evidence level, and main reason.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Objective</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-strategic`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {strategicObjectiveOrder.map((objectiveKey) => (
                    <tr key={objectiveKey}>
                      <td>{strategicObjectiveLabels[objectiveKey]}</td>
                      {filteredRuns.map((run) => {
                        const scorecard = extrasByRunId
                          .get(run.id)
                          ?.strategicObjectives.find((item) => item.objective_key === objectiveKey);
                        if (!scorecard) return <td key={`${run.id}-${objectiveKey}`} className="muted">Pending</td>;
                        return (
                          <td key={`${run.id}-${objectiveKey}`}>
                            <div className="compare-rich-cell">
                              <span>
                                <span className={`badge ${getVerdictBadge(scorecard.status)}`}>{getPolicyStatusLabel(scorecard.status)}</span>
                                <strong>{scorecard.score.toFixed(2)}</strong>
                              </span>
                              <small>{getEvidenceLevelLabel(scorecard.evidence_level)}</small>
                              {scorecard.primary_metrics[0] ? <small>{scorecard.primary_metrics[0]}</small> : null}
                              {scorecard.reasons[0] ? <p>{scorecard.reasons[0]}</p> : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Phase Comparison</h3>
            <p className="muted compare-section-note">
              Phase checkpoint with status, payout pressure, reserve runway, cash paid out, and net cash change.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Phase</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-milestone`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {milestoneRows.length === 0 ? (
                    <tr><td className="muted" colSpan={filteredRuns.length + 1}>No phase results yet.</td></tr>
                  ) : milestoneRows.map((milestoneRow) => {
                    const [milestoneKey, milestoneLabel] = milestoneRow.split("::");
                    return (
                      <tr key={milestoneRow}>
                        <td>{milestoneLabel}</td>
                        {filteredRuns.map((run) => {
                          const milestone = extrasByRunId
                            .get(run.id)
                            ?.milestoneEvaluations.find((item) => item.milestone_key === milestoneKey);
                          if (!milestone) return <td key={`${run.id}-${milestoneKey}`} className="muted">Not available</td>;
                          return (
                            <td key={`${run.id}-${milestoneKey}`}>
                              <div className="compare-rich-cell">
                                <span>
                                  <span className={`badge ${getVerdictBadge(milestone.policy_status)}`}>
                                    {getPolicyStatusLabel(milestone.policy_status)}
                                  </span>
                                </span>
                                <small>
                                  Pressure {formatCommonMetricValue("payout_inflow_ratio", milestone.summary_metrics.payout_inflow_ratio)}
                                  {" · "}
                                  Runway {formatMonthCountLabel(milestone.summary_metrics.reserve_runway_months)}
                                </small>
                                <small>
                                  Payout {formatCommonMetricValue("company_actual_payout_out_total", milestone.summary_metrics.company_actual_payout_out_total)}
                                  {" · "}
                                  Net Cash {formatCommonMetricValue("company_net_treasury_delta_total", milestone.summary_metrics.company_net_treasury_delta_total)}
                                </small>
                                {milestone.reasons[0] ? <p>{milestone.reasons[0]}</p> : null}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Result Details</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Result Ref</th><th>Scenario</th><th>Data</th><th>Status</th><th>Completed</th></tr></thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <tr key={run.id}>
                      <td><strong>{getRunReference(run.id)}</strong><div className="muted" style={{ fontSize: "0.72rem" }}>{run.id}</div></td>
                      <td>{run.scenario.name}</td>
                      <td>{run.snapshot.name}</td>
                      <td><span className={`badge badge--${run.status === "COMPLETED" ? "candidate" : "neutral"}`}>{getRunStatusLabel(run.status)}</span></td>
                      <td>{run.completedAt ?? "Not completed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
