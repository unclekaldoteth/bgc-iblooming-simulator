"use client";

import { useMemo, useState } from "react";

import {
  formatCommonMetricValue,
  formatMonthCountLabel,
  getCommonMetricLabel,
  getPolicyStatusLabel,
  getRunReference,
  getRunStatusLabel
} from "@/lib/common-language";

import { CompareRadarChart } from "./compare-radar-chart";

/* ─── Types ─── */

type RunSummaryMetric = {
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
};

type RunExtra = {
  runId: string;
  verdict: string;
  strategicObjectives: {
    objective_key: string;
    status: string;
    score: number;
  }[];
  milestoneEvaluations: {
    milestone_key: string;
    label: string;
    start_period_key: string;
    end_period_key: string;
    policy_status: string;
    summary_metrics: {
      payout_inflow_ratio: number;
      reserve_runway_months: number;
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

/* ─── Constants ─── */

const SERIES_COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#14B8A6", "#8B5CF6"];

const RADAR_DIMENSIONS = [
  { key: "reserve_runway_months", name: "Treasury Safety", max: 24, invert: false },
  { key: "reward_concentration_top10_pct", name: "Fairness", max: 100, invert: true },
  { key: "sink_utilization_rate", name: "Internal Use", max: 100, invert: false },
  { key: "alpha_issued_total", name: "Growth Support", max: 0, invert: false },
  { key: "payout_inflow_ratio", name: "Cash-Out Risk", max: 2, invert: true },
];

function getVerdictBadge(status: string) {
  if (status === "candidate" || status === "approved") return "badge--candidate";
  if (status === "risky" || status === "caution") return "badge--risky";
  if (status === "rejected" || status === "failed") return "badge--rejected";
  return "badge--neutral";
}

/* ─── Component ─── */

export function CompareConsole({
  runs,
  metricKeys,
  metricOptimization,
  strategicObjectiveOrder,
  strategicObjectiveLabels,
  runExtras,
}: CompareConsoleProps) {
  // Build a map of display labels that disambiguates duplicate scenario names
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
    runs.slice(0, 3).forEach((r) => initial.add(r.id));
    return initial;
  });

  function toggleRun(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(runs.map((r) => r.id)));
  }

  function clearToFirst() {
    if (runs.length > 0) {
      setSelectedIds(new Set([runs[0].id]));
    }
  }

  const filteredRuns = useMemo(
    () => runs.filter((r) => selectedIds.has(r.id)),
    [runs, selectedIds]
  );

  const filteredExtras = useMemo(
    () => runExtras.filter((e) => selectedIds.has(e.runId)),
    [runExtras, selectedIds]
  );

  const milestoneRows = useMemo(() => {
    return [...new Set(
      filteredExtras.flatMap((e) =>
        e.milestoneEvaluations.map((ms) => `${ms.milestone_key}::${ms.label}`)
      )
    )];
  }, [filteredExtras]);

  const radarData = useMemo(() => {
    if (filteredRuns.length === 0) return { dimensions: [] as { name: string; max: number }[], series: [] as { name: string; color: string; values: number[] }[] };
    const maxIssued = Math.max(1, ...filteredRuns.map((r) => {
      const m = r.summaryMetrics.find((sm) => sm.metricKey === "alpha_issued_total");
      return m?.metricValue ?? 0;
    }));
    const dimensions = RADAR_DIMENSIONS.map((d) => ({
      name: d.name,
      max: d.key === "alpha_issued_total" ? maxIssued * 1.2 : d.max,
    }));
    const series = filteredRuns.map((run) => {
      const globalIdx = runs.findIndex((r) => r.id === run.id);
      const metrics = Object.fromEntries(run.summaryMetrics.map((m) => [m.metricKey, m.metricValue])) as Record<string, number>;
      return {
        name: runDisplayLabels.get(run.id) ?? run.scenario.name,
        color: SERIES_COLORS[globalIdx % SERIES_COLORS.length],
        values: RADAR_DIMENSIONS.map((d) => {
          const raw = metrics[d.key] ?? 0;
          if (d.invert) {
            const maxVal = d.key === "alpha_issued_total" ? maxIssued * 1.2 : d.max;
            return Math.max(0, maxVal - raw);
          }
          return raw;
        }),
      };
    });
    return { dimensions, series };
  }, [filteredRuns, runDisplayLabels, runs]);

  return (
    <>
      {/* Scenario Selector */}
      <div className="scenario-selector">
        <div className="scenario-selector-header">
          <span className="scenario-selector-label">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Select scenarios to compare
            <span className="scenario-selector-count">{selectedIds.size}/{runs.length}</span>
          </span>
          <div className="scenario-selector-actions">
            <button className="selector-action-btn" onClick={selectAll} type="button">Select All</button>
            <button className="selector-action-btn" onClick={clearToFirst} type="button">Reset</button>
          </div>
        </div>

        <div className="scenario-chip-list">
          {runs.map((run, idx) => {
            const isSelected = selectedIds.has(run.id);
            const color = SERIES_COLORS[idx % SERIES_COLORS.length];
            return (
              <button
                className="scenario-chip"
                data-selected={isSelected}
                key={run.id}
                onClick={() => toggleRun(run.id)}
                type="button"
              >
                <span className="scenario-chip-dot" style={{ background: color }} />
                <span className="scenario-chip-check">
                  {isSelected ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
                {runDisplayLabels.get(run.id) ?? run.scenario.name}
              </button>
            );
          })}
        </div>

        {selectedIds.size < 2 ? (
          <p className="scenario-selector-hint">Select at least 2 scenarios for meaningful comparison.</p>
        ) : null}
      </div>

      <section className="page-grid">
        {/* Radar Chart */}
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Scenario Comparison</h3>
            <p className="muted" style={{ marginTop: "-0.4rem", marginBottom: "0.5rem", fontSize: "0.82rem" }}>
              Visual overlay of {filteredRuns.length} selected scenario{filteredRuns.length !== 1 ? "s" : ""} — larger area = stronger profile.
            </p>
            <CompareRadarChart dimensions={radarData.dimensions} series={radarData.series} />
          </div>
        ) : null}

        {/* Key Results */}
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Key Results</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {filteredRuns.map((run, idx) => {
                      const globalIdx = runs.findIndex((r) => r.id === run.id);
                      return (
                        <th key={run.id}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                            <span className="scenario-chip-dot" style={{ background: SERIES_COLORS[globalIdx % SERIES_COLORS.length], width: "8px", height: "8px", opacity: 1 }} />
                            {runDisplayLabels.get(run.id) ?? run.scenario.name}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {metricKeys.map((metricKey) => {
                    const values = filteredRuns.map((run) => {
                      const metric = run.summaryMetrics.find((item) => item.metricKey === metricKey);
                      return metric?.metricValue ?? 0;
                    });
                    const optimization = metricOptimization[metricKey] ?? "higher";
                    const bestVal = optimization === "higher" ? Math.max(...values) : Math.min(...values);
                    const worstVal = optimization === "higher" ? Math.min(...values) : Math.max(...values);
                    return (
                      <tr key={metricKey}>
                        <td>{getCommonMetricLabel(metricKey)}</td>
                        {filteredRuns.map((run, idx) => {
                          const val = values[idx];
                          const isBest = values.length > 1 && val === bestVal;
                          const isWorst = values.length > 1 && val === worstVal;
                          return (
                            <td key={`${run.id}-${metricKey}`} className={isBest ? "cell-best" : isWorst ? "cell-worst" : ""}>
                              {formatCommonMetricValue(metricKey, val)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Verdict Row */}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Verdict</td>
                    {filteredRuns.map((run) => {
                      const extra = filteredExtras.find((e) => e.runId === run.id);
                      const status = extra?.verdict ?? "pending";
                      return (
                        <td key={`${run.id}-verdict`}>
                          <span className={`badge ${getVerdictBadge(status)}`}>{getPolicyStatusLabel(status)}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Goal Comparison */}
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Goal Comparison</h3>
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
                        const extra = filteredExtras.find((e) => e.runId === run.id);
                        const scorecard = extra?.strategicObjectives.find((s) => s.objective_key === objectiveKey);
                        if (!scorecard) return <td key={`${run.id}-${objectiveKey}`} className="muted">Pending</td>;
                        return (
                          <td key={`${run.id}-${objectiveKey}`}>
                            <span className={`badge ${getVerdictBadge(scorecard.status)}`} style={{ marginRight: "0.35rem" }}>{getPolicyStatusLabel(scorecard.status)}</span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{scorecard.score.toFixed(2)}</span>
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

        {/* Milestone Comparison */}
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Milestone Comparison</h3>
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
                          const extra = filteredExtras.find((e) => e.runId === run.id);
                          const milestone = extra?.milestoneEvaluations.find((ms) => ms.milestone_key === milestoneKey);
                          if (!milestone) return <td key={`${run.id}-${milestoneKey}`} className="muted">N/A</td>;
                          return (
                            <td key={`${run.id}-${milestoneKey}`}>
                              <span className={`badge ${getVerdictBadge(milestone.policy_status)}`} style={{ marginRight: "0.25rem" }}>{getPolicyStatusLabel(milestone.policy_status)}</span>
                              <span style={{ fontSize: "0.78rem" }}>{milestone.summary_metrics.payout_inflow_ratio.toFixed(2)}x · {formatMonthCountLabel(milestone.summary_metrics.reserve_runway_months)}</span>
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

        {/* Run Context */}
        {filteredRuns.length > 0 ? (
          <div className="card span-12">
            <h3>Run Context</h3>
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
