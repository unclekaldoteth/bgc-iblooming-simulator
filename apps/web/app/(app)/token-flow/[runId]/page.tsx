import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { getRunById } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import { Card, PageHeader } from "@bgc-alpha/ui";

import { requirePageUser } from "@/lib/auth-session";
import {
  formatCommonMetricValue,
  getCommonMetricLabel,
  getRunReference,
  getScenarioModeCaveat,
  getScenarioModeLabel,
  simplifyResultText
} from "@/lib/common-language";
import { readTokenFlowEvidence } from "@/lib/strategic-objectives";

const ledgerMetricKeys = [
  "alpha_opening_balance_total",
  "alpha_issued_total",
  "alpha_spent_total",
  "alpha_actual_spent_total",
  "alpha_modeled_spent_total",
  "alpha_cashout_equivalent_total",
  "alpha_expired_burned_total",
  "alpha_ending_balance_total"
] as const;

function formatTokenPolicyValue(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/founder/g, "team")
    .replace(/not applicable internal/g, "not applicable for internal ALPHA")
    .replace(/alpha internal/g, "internal ALPHA");
}

function buildPeriodRows(timeSeries: NonNullable<Awaited<ReturnType<typeof getRunById>>>["timeSeries"]) {
  const rowsByPeriod = new Map<string, Map<string, number>>();

  for (const metric of timeSeries) {
    const metrics = rowsByPeriod.get(metric.periodKey) ?? new Map<string, number>();
    metrics.set(metric.metricKey, metric.metricValue);
    rowsByPeriod.set(metric.periodKey, metrics);
  }

  return [...rowsByPeriod.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([periodKey, metrics]) => ({
      periodKey,
      isProjected: (metrics.get("forecast_period_is_projected") ?? 0) > 0,
      metrics
    }));
}

export default async function TokenFlowPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  await requirePageUser(["runs.read"]);

  if (!hasDatabaseUrl()) {
    return (
      <>
        <PageHeader eyebrow="Token Flow" title={`Token Flow for ${runId}`} description="Configure the database before viewing token-flow evidence." />
        <section className="page-grid">
          <Card className="span-12" title="Database setup required"><p className="muted">DATABASE_URL is required.</p></Card>
        </section>
      </>
    );
  }

  const run = await getRunById(runId);
  if (!run) notFound();

  const baselineModel = resolveBaselineModelRuleset(
    run.modelVersion.rulesetJson,
    run.modelVersion.versionName
  );
  const parameters = parseFounderSafeScenarioParameters(run.scenario.parameterJson, {
    reward_global_factor: baselineModel.defaults.reward_global_factor,
    reward_pool_factor: baselineModel.defaults.reward_pool_factor
  });
  const tokenPolicy = parameters.alpha_token_policy;
  const forecastPolicy = parameters.forecast_policy;
  const sinkAdoption = parameters.sink_adoption_model;
  const web3 = parameters.web3_tokenomics;
  const tokenFlowEvidence = readTokenFlowEvidence(run.decisionPacks[0]?.recommendationJson);
  const periodRows = buildPeriodRows(run.timeSeries);
  const summaryByKey = new Map(run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue] as const));
  const actualPeriods = summaryByKey.get("forecast_actual_period_count") ?? 0;
  const projectedPeriods = summaryByKey.get("forecast_projected_period_count") ?? 0;
  const scenarioModeCaveat = getScenarioModeCaveat(parameters.scenario_mode);

  return (
    <>
      <PageHeader
        eyebrow="Token Flow"
        title={`Token Flow · ${getRunReference(runId)}`}
        description="ALPHA policy, monthly balance ledger, forecast split, Web3 assumptions, and whitepaper evidence."
      />

      <nav className="tab-nav">
        <Link href={`/runs/${run.id}`} className="tab-item">Summary</Link>
        <Link href={`/distribution/${run.id}`} className="tab-item">Distribution</Link>
        <Link href={`/token-flow/${run.id}`} className="tab-item active">Token Flow</Link>
        <Link href={`/treasury/${run.id}`} className="tab-item">Treasury</Link>
        <Link href={`/decision-pack/${run.id}`} className="tab-item">Decision Pack</Link>
      </nav>

      <section className="page-grid">
        <Card className="span-12" title="Result Mode">
          <div className="decision-summary">
            <div className="decision-summary__verdict">
              <span className={`badge ${parameters.scenario_mode === "advanced_forecast" ? "badge--risky" : "badge--info"}`}>
                {getScenarioModeLabel(parameters.scenario_mode)}
              </span>
              <p style={{ marginTop: "0.75rem" }}>
                {scenarioModeCaveat ?? "Imported Data Only uses uploaded data and does not add growth forecasts."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="span-12" title="ALPHA Policy">
          <div className="decision-kpi-grid">
            <div className="decision-kpi">
              <span>Classification</span>
              <strong>{formatTokenPolicyValue(tokenPolicy.classification)}</strong>
            </div>
            <div className="decision-kpi">
              <span>Transferability</span>
              <strong>{formatTokenPolicyValue(tokenPolicy.transferability)}</strong>
            </div>
            <div className="decision-kpi">
              <span>On-Chain Status</span>
              <strong>{formatTokenPolicyValue(tokenPolicy.on_chain_status)}</strong>
            </div>
            <div className="decision-kpi">
              <span>Settlement</span>
              <strong>{formatTokenPolicyValue(tokenPolicy.settlement_unit)}</strong>
            </div>
          </div>
        </Card>

        <Card className="span-12" title="ALPHA Ledger">
          <p className="card-intro">
            Ledger check: opening balance + issued - used - cash-out - expired/burned = ending balance.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Basis</th>
                  {ledgerMetricKeys.map((key) => (
                    <th key={key}>{getCommonMetricLabel(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodRows.map((row) => (
                  <tr key={row.periodKey}>
                    <td>{row.periodKey}</td>
                    <td>{row.isProjected ? "Forecast" : "Uploaded Data"}</td>
                    {ledgerMetricKeys.map((key) => (
                      <td key={key}>{formatCommonMetricValue(key, row.metrics.get(key) ?? 0)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="span-6" title="Forecast Settings">
          <div className="decision-kpi-grid decision-kpi-grid--two">
            <div className="decision-kpi">
              <span>Observed Months</span>
              <strong>{actualPeriods}</strong>
            </div>
            <div className="decision-kpi">
              <span>Forecast Months</span>
              <strong>{projectedPeriods}</strong>
            </div>
            <div className="decision-kpi">
              <span>Actual ALPHA Used</span>
              <strong>{formatCommonMetricValue("alpha_actual_spent_total", summaryByKey.get("alpha_actual_spent_total") ?? 0)}</strong>
            </div>
            <div className="decision-kpi">
              <span>Modeled ALPHA Used</span>
              <strong>{formatCommonMetricValue("alpha_modeled_spent_total", summaryByKey.get("alpha_modeled_spent_total") ?? 0)}</strong>
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Mode</dt><dd>{formatTokenPolicyValue(forecastPolicy.mode)}</dd></div>
            <div><dt>Basis</dt><dd>{formatTokenPolicyValue(forecastPolicy.forecast_basis)}</dd></div>
            <div><dt>Uploaded Data Through</dt><dd>{forecastPolicy.actuals_through_period ?? "Not set"}</dd></div>
            <div><dt>Forecast Start</dt><dd>{forecastPolicy.forecast_start_period ?? "Not set"}</dd></div>
            <div><dt>Internal Use Adoption</dt><dd>{sinkAdoption.sink_adoption_rate_pct}% adoption · {sinkAdoption.eligible_member_share_pct}% eligible</dd></div>
            <div><dt>Internal Use Demand</dt><dd>${sinkAdoption.avg_sink_ticket_usd} ticket · {sinkAdoption.sink_frequency_per_month}/month · {sinkAdoption.alpha_payment_share_pct}% ALPHA</dd></div>
            <div><dt>Internal Use Growth</dt><dd>{sinkAdoption.sink_growth_rate_pct}% / month</dd></div>
          </dl>
        </Card>

        <Card className="span-6" title="Web3 Assumptions">
          <dl className="detail-list">
            <div><dt>Network</dt><dd>{formatTokenPolicyValue(web3.network_status)}</dd></div>
            <div><dt>Supply Model</dt><dd>{formatTokenPolicyValue(web3.supply_model)}</dd></div>
            <div><dt>Max Supply</dt><dd>{web3.max_supply ?? "Not set"}</dd></div>
            <div><dt>Liquidity</dt><dd>{web3.liquidity.enabled ? "enabled" : "not enabled"}</dd></div>
            <div><dt>Decision Rules</dt><dd>{formatTokenPolicyValue(web3.governance.mode)}</dd></div>
            <div><dt>Legal Status</dt><dd>{formatTokenPolicyValue(web3.legal.classification)}</dd></div>
            <div><dt>Smart Contract</dt><dd>{web3.smart_contract.chain ?? "Not set"} / {web3.smart_contract.standard ?? "Not set"}</dd></div>
            <div><dt>Contract Audit</dt><dd>{formatTokenPolicyValue(web3.smart_contract.audit_status)}</dd></div>
          </dl>
        </Card>

        {tokenFlowEvidence ? (
          <Card className="span-12" title="Whitepaper Evidence">
            <p className="card-intro">{simplifyResultText(tokenFlowEvidence.summary)}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Status</th>
                    <th>Value</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenFlowEvidence.rows.map((row) => (
                    <tr key={row.key}>
                      <td>{simplifyResultText(row.label)}</td>
                      <td>{row.status}</td>
                      <td>{simplifyResultText(row.value)}</td>
                      <td>{simplifyResultText(row.detail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tokenFlowEvidence.caveats.length > 0 ? (
              <ul className="compact-list">
                {tokenFlowEvidence.caveats.map((caveat) => (
                  <li key={caveat}>{simplifyResultText(caveat)}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}
      </section>
    </>
  );
}
