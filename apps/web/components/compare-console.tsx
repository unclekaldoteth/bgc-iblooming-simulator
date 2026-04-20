"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  formatCommonMetricValue,
  formatMonthCountLabel,
  getCommonMetricLabel,
  getEvidenceLevelLabel,
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
  strategicObjectives: {
    objective_key: string;
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

  const compareExportHref = useMemo(() => {
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

  function toggleRun(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        if (next.size <= 1) {
          setSelectorNotice("Keep at least one run selected.");
          return prev;
        }
        next.delete(id);
        setSelectorNotice(null);
        return next;
      }

      if (next.size >= maxComparedRuns) {
        setSelectorNotice(`Compare is limited to ${maxComparedRuns} runs so charts and tables stay readable.`);
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
              Select scenarios to compare
              <span className="scenario-selector-count">{selectedIds.size}/{runs.length}</span>
            </span>
            <p className="compare-selector-subcopy">
              Recommended: 2-5 completed runs. Selection is reflected in the page URL.
            </p>
          </div>
          <div className="scenario-selector-actions">
            {compareExportHref ? (
              <a className="selector-action-btn" href={compareExportHref}>
                Download PDF
              </a>
            ) : (
              <span className="selector-action-btn selector-action-btn--disabled">Download PDF</span>
            )}
            <button className="selector-action-btn" onClick={() => setSelectorOpen((value) => !value)} type="button">
              {selectorOpen ? "Close Selector" : "Manage Scenarios"}
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
          <p className="scenario-selector-hint">Select at least 2 scenarios for meaningful comparison.</p>
        ) : null}

        {selectorOpen ? (
          <div className="compare-manage-panel">
            <div className="compare-search-row">
              <label htmlFor="compare-run-search">Find run</label>
              <input
                id="compare-run-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search scenario, ref, or snapshot"
                type="search"
                value={searchQuery}
              />
              <button className="selector-action-btn" onClick={selectVisible} type="button">
                Select Visible
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
                <p className="muted">No completed runs match that search.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <section className="page-grid">
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Scenario Profile Radar</h3>
            <p className="muted compare-section-note">
              Visual overlay for quick scanning only. Use the cashflow and treasury tables as the decision source of truth.
            </p>
            <CompareRadarChart dimensions={radarData.dimensions} series={radarData.series} />
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Compare Decision Snapshot</h3>
            <p className="muted compare-section-note">
              One-card readout per selected run. Cashflow and treasury signals are shown before ALPHA policy details.
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
                    </div>
                    <div className="compare-mini-grid">
                      <span>
                        <small>Net Delta</small>
                        <strong>{formatCommonMetricValue("company_net_treasury_delta_total", netDelta)}</strong>
                      </span>
                      <span>
                        <small>Payout Out</small>
                        <strong>{formatCommonMetricValue("company_actual_payout_out_total", payoutOut)}</strong>
                      </span>
                      <span>
                        <small>Pressure</small>
                        <strong>{formatCommonMetricValue("payout_inflow_ratio", pressure)}</strong>
                      </span>
                      <span>
                        <small>Runway</small>
                        <strong>{formatMonthCountLabel(runway)}</strong>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {filteredRuns.length > 0
          ? renderMetricTable(
              "Business Cashflow Comparison",
              "Company cashflow truth. Fiat/cashflow values are shown in $ and kept separate from ALPHA policy movement.",
              compareCashflowMetricKeys
            )
          : null}

        {filteredRuns.length > 0
          ? renderMetricTable(
              "ALPHA Policy Comparison",
              "Policy-token layer only: issued, used, held, and ALPHA routed into the cash-out path.",
              compareAlphaMetricKeys
            )
          : null}

        {filteredRuns.length > 0
          ? renderMetricTable(
              "Treasury Risk Comparison",
              "Health signals used to judge treasury pressure, runway, internal use, and concentration risk.",
              compareTreasuryMetricKeys
            )
          : null}

        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Distribution Comparison</h3>
            <p className="muted compare-section-note">
              Concentration and source split from the Distribution view. This helps show where ALPHA and source-level cashflow accumulate.
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
                    <td><strong>Largest Member Tier</strong></td>
                    {filteredRuns.map((run) => {
                      const largestTier = findLargestSegment(run, "member_tier", "reward_share_pct");
                      return (
                        <td key={`${run.id}-largest-tier`}>
                          {largestTier ? `${largestTier.label} · ${formatCommonMetricValue("reward_share_pct", largestTier.value)}` : "N/A"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td><strong>Largest Source by ALPHA</strong></td>
                    {filteredRuns.map((run) => {
                      const largestSource = findLargestSegment(run, "source_system", "alpha_issued_total");
                      const totalIssued = getMetricValue(run, "alpha_issued_total");
                      const share = largestSource && totalIssued > 0 ? (largestSource.value / totalIssued) * 100 : 0;
                      return (
                        <td key={`${run.id}-largest-source`}>
                          {largestSource ? `${largestSource.label} · ${formatCommonMetricValue("reward_share_pct", share)}` : "N/A"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td><strong>BGC Net Treasury Delta</strong></td>
                    {filteredRuns.map((run) => (
                      <td key={`${run.id}-bgc-net`}>
                        {formatCommonMetricValue("company_net_treasury_delta_total", findSegmentValue(run, "source_system", "bgc", "company_net_treasury_delta_total"))}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>iBLOOMING Net Treasury Delta</strong></td>
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
            <h3>Strategic Goals Comparison</h3>
            <p className="muted compare-section-note">
              Status, score, evidence level, and first reason from the Decision Pack scorecard.
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
            <h3>Milestone Comparison</h3>
            <p className="muted compare-section-note">
              Phase checkpoint with verdict, treasury pressure, runway, payout, and net treasury delta.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    {filteredRuns.map((run) => (
                      <th key={`${run.id}-milestone`}>{runDisplayLabels.get(run.id) ?? run.scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {milestoneRows.length === 0 ? (
                    <tr><td className="muted" colSpan={filteredRuns.length + 1}>No milestone results yet.</td></tr>
                  ) : milestoneRows.map((milestoneRow) => {
                    const [milestoneKey, milestoneLabel] = milestoneRow.split("::");
                    return (
                      <tr key={milestoneRow}>
                        <td>{milestoneLabel}</td>
                        {filteredRuns.map((run) => {
                          const milestone = extrasByRunId
                            .get(run.id)
                            ?.milestoneEvaluations.find((item) => item.milestone_key === milestoneKey);
                          if (!milestone) return <td key={`${run.id}-${milestoneKey}`} className="muted">N/A</td>;
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
                                  Net {formatCommonMetricValue("company_net_treasury_delta_total", milestone.summary_metrics.company_net_treasury_delta_total)}
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
            <h3>Run Context / Audit Trail</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Reference</th><th>Scenario</th><th>Data</th><th>Status</th><th>Finished</th></tr></thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <tr key={run.id}>
                      <td><strong>{getRunReference(run.id)}</strong><div className="muted" style={{ fontSize: "0.72rem" }}>{run.id}</div></td>
                      <td>{run.scenario.name}</td>
                      <td>{run.snapshot.name}</td>
                      <td><span className={`badge badge--${run.status === "COMPLETED" ? "candidate" : "neutral"}`}>{getRunStatusLabel(run.status)}</span></td>
                      <td>{run.completedAt ?? "Pending"}</td>
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
