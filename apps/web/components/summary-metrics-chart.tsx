"use client";

import { useEffect, useRef } from "react";
import type { ECharts } from "echarts";
import {
  formatSummaryMetricValue,
  getSummaryMetricDefinition,
  type SummaryMetricKey,
  summaryMetricDefinitions,
} from "@/lib/summary-metrics";

type SummaryMetricDatum = {
  key: SummaryMetricKey;
  value: number;
};

type SummaryMetricsChartProps = {
  metrics: SummaryMetricDatum[];
};

type DonutMetric = {
  label: string;
  value: number;
  formattedValue: string;
  description: string;
  color: string;
};

const ALPHA_DISTRIBUTION_KEYS: SummaryMetricKey[] = [
  "alpha_spent_total",
  "alpha_held_total",
  "alpha_cashout_equivalent_total",
];

const ALPHA_DISTRIBUTION_COLORS: Partial<Record<SummaryMetricKey, string>> = {
  alpha_spent_total: "#3B82F6",
  alpha_held_total: "#94A3B8",
  alpha_cashout_equivalent_total: "#F59E0B",
};

function formatAlphaValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function DonutChart({
  metrics,
  centerLabel,
  centerValue,
}: {
  metrics: DonutMetric[];
  centerLabel: string;
  centerValue: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    let disposed = false;

    async function init() {
      const echarts = await import("echarts");
      if (disposed || !containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.dispose();
      }

      const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
      chartRef.current = chart;

      chart.setOption({
        tooltip: {
          trigger: "item",
          appendToBody: true,
          confine: false,
          backgroundColor: "#1E293B",
          borderColor: "#334155",
          padding: [10, 14],
          extraCssText: "max-width:320px;white-space:normal;z-index:9999;",
          textStyle: { color: "#F8FAFC", fontSize: 13 },
          formatter: (params: { name: string; value: number; percent: number; dataIndex: number }) => {
            const m = metrics[params.dataIndex];
            return `<strong>${params.name}</strong><br/>${m?.formattedValue ?? params.value} (${params.percent}%)<br/><span style="color:#94A3B8;font-size:12px">${m?.description ?? ""}</span>`;
          },
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: "center",
          itemWidth: 14,
          itemHeight: 14,
          itemGap: 14,
          formatter: (name: string) => {
            const m = metrics.find((item) => item.label === name);
            if (!m) return name;
            return `{name|${name}}  {val|${m.formattedValue}}`;
          },
          textStyle: {
            rich: {
              name: { color: "#F8FAFC", fontSize: 12, fontWeight: 500, width: 65 },
              val: { color: "#94A3B8", fontSize: 11, fontWeight: 400 },
            },
          },
        },
        series: [
          {
            type: "pie",
            radius: ["48%", "72%"],
            center: ["35%", "50%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: "#1E293B",
              borderWidth: 3,
            },
            label: {
              show: true,
              position: "center",
              formatter: `{centerLabel|${centerLabel}}\n{centerValue|${centerValue}}`,
              rich: {
                centerLabel: {
                  color: "#94A3B8",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 16,
                },
                centerValue: {
                  color: "#F8FAFC",
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 22,
                },
              },
            },
            emphasis: {
              scale: true,
              scaleSize: 4,
            },
            data: metrics.map((m) => ({
              name: m.label,
              value: Math.round(m.value * 100) / 100,
              itemStyle: { color: m.color },
            })),
          },
        ],
      });

      const resizeObserver = new ResizeObserver(() => chart.resize());
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }

    init();

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [centerLabel, centerValue, metrics]);

  return <div ref={containerRef} className="chart-container" />;
}

function getMeterWidth(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return 0;
  return Math.max(8, Math.min(100, (value / maximum) * 100));
}

function getSignalStatus(key: SummaryMetricKey, value: number): "safe" | "warning" | "danger" {
  if (key === "payout_inflow_ratio") return value > 1.0 ? "danger" : value > 0.8 ? "warning" : "safe";
  if (key === "reserve_runway_months") return value < 6 ? "danger" : value < 12 ? "warning" : "safe";
  if (key.endsWith("sink_utilization_rate")) return value < 20 ? "danger" : value < 30 ? "warning" : "safe";
  if (key === "reward_concentration_top10_pct") return value > 60 ? "danger" : value > 45 ? "warning" : "safe";
  return "safe";
}

const STATUS_LABELS: Record<string, { color: string; label: string }> = {
  safe:    { color: "#10B981", label: "Healthy" },
  warning: { color: "#F59E0B", label: "Needs Attention" },
  danger:  { color: "#EF4444", label: "Critical" },
};

export function SummaryMetricsChart({ metrics }: SummaryMetricsChartProps) {
  return (
    <div className="summary-visuals">
      <AlphaDistributionChart metrics={metrics} />
      <HealthSignalsChart metrics={metrics} />
    </div>
  );
}

export function AlphaDistributionChart({ metrics }: SummaryMetricsChartProps) {
  const valuesByKey = new Map(
    metrics.map((metric) => [metric.key, metric.value]),
  );
  const alphaIssuedValue = valuesByKey.get("alpha_issued_total") ?? 0;
  const alphaDistributionMetrics = ALPHA_DISTRIBUTION_KEYS.map((key) => {
    const definition = getSummaryMetricDefinition(key);
    const value = valuesByKey.get(key) ?? 0;
    return {
      label: definition.shortLabel,
      value,
      formattedValue: formatAlphaValue(value),
      description: definition.description,
      color: ALPHA_DISTRIBUTION_COLORS[key] ?? "#10B981",
    };
  });

  return (
    <section
      className="summary-visual-panel"
      aria-label="ALPHA distribution chart"
    >
      <h4>ALPHA Distribution</h4>
      <p className="muted">
        Breakdown of issued ALPHA into used, held, and cash-out path.
      </p>
      <div
        className="alpha-issued-summary"
        aria-label={`Total ALPHA issued: ${formatAlphaValue(alphaIssuedValue)}`}
      >
        <span>Total Issued</span>
        <strong>{formatAlphaValue(alphaIssuedValue)}</strong>
      </div>
      <DonutChart
        centerLabel="Issued"
        centerValue={formatAlphaValue(alphaIssuedValue)}
        metrics={alphaDistributionMetrics}
      />
    </section>
  );
}

function HealthSignalsChart({ metrics }: SummaryMetricsChartProps) {
  const valuesByKey = new Map(
    metrics.map((metric) => [metric.key, metric.value]),
  );
  const signalMetrics = summaryMetricDefinitions
    .filter((definition) => definition.group === "signal")
    .map((definition) => ({
      ...definition,
      value: valuesByKey.get(definition.key) ?? 0,
    }));

  return (
    <section
      className="summary-visual-panel"
      aria-label="Health signals chart"
    >
      <h4>Health Signals</h4>
      <p className="muted">
        Each meter is scaled to its own operating range.
      </p>

      {/* Color Legend */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {Object.entries(STATUS_LABELS).map(([key, { color, label }]) => (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "#94A3B8" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>

      <div className="summary-bar-list">
        {signalMetrics.map((metric) => {
          const status = getSignalStatus(metric.key, metric.value);
          const statusColor = STATUS_LABELS[status].color;
          return (
            <div className="summary-bar-row" key={metric.key}>
              <div className="summary-bar-copy">
                <strong style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                  {metric.shortLabel}
                </strong>
                <span className="muted">
                  {formatSummaryMetricValue(metric.key, metric.value)}
                </span>
              </div>
              <div
                className="summary-bar-track"
                aria-label={`${metric.label}: ${formatSummaryMetricValue(metric.key, metric.value)}`}
              >
                <div
                  className="summary-bar-fill summary-bar-fill-signal"
                  data-status={status}
                  style={{
                    width: `${getMeterWidth(metric.value, metric.chartMax ?? 1)}%`,
                  }}
                />
              </div>
              <p className="muted">
                {getSummaryMetricDefinition(metric.key).description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
