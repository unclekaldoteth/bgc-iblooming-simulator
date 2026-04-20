"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  applyFounderScenarioGuardrails,
  evaluateFounderScenarioGuardrails,
  founderSafePassiveCohortAssumptions,
  scenarioCohortAssumptionsSchema,
  scenarioGuardrailMatrix,
  type ScenarioGuardrailIssue,
  type ScenarioCohortAssumptions,
  type ScenarioMilestoneScheduleItem,
  type ScenarioParameters
} from "@bgc-alpha/schemas";

import type { AppSessionUser } from "@/lib/auth-session";
import { getDataSetStatusLabel, getRunReference } from "@/lib/common-language";

/** Locale-proof numeric input — always shows "." as decimal separator */
function NumericInput({
  value,
  onChange,
  disabled,
  min,
  max,
  step,
}: {
  value: number | string;
  onChange: (val: number) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  // Sync when external value changes (e.g. template switch)
  const externalStr = String(value);
  if (localValue !== externalStr && document.activeElement?.tagName !== "INPUT") {
    setLocalValue(externalStr);
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow only digits, dots, and minus
      const raw = e.target.value.replace(/,/g, ".");
      const cleaned = raw.replace(/[^0-9.\-]/g, "");
      setLocalValue(cleaned);
      const num = Number(cleaned);
      if (!Number.isNaN(num) && cleaned !== "" && cleaned !== "-" && cleaned !== ".") {
        onChange(num);
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    // On blur, normalize displayed value
    const num = Number(localValue);
    if (!Number.isNaN(num) && localValue !== "") {
      setLocalValue(String(num));
    }
  }, [localValue]);

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
    />
  );
}

type ScenarioRecord = {
  id: string;
  name: string;
  templateType: "Baseline" | "Conservative" | "Growth" | "Stress";
  description: string | null;
  snapshotIdDefault: string | null;
  modelVersionId: string;
  parameterJson: {
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
    cohort_assumptions: ScenarioCohortAssumptions;
    projection_horizon_months: number | null;
    milestone_schedule: ScenarioMilestoneScheduleItem[];
  };
  modelVersion: { id: string; versionName: string; status: string; };
  snapshotDefault: { id: string; name: string; validationStatus: string; importedFactCount: number; } | null;
  latestRun: { id: string; status: string; } | null;
  updatedAt: string;
};

type BaselineModelRecord = {
  id: string;
  versionName: string;
  status: string;
  guardrailDefaults: {
    reward_global_factor: number;
    reward_pool_factor: number;
  };
};
type SnapshotOption = { id: string; name: string; validationStatus: string; importedFactCount: number; };
type ScenarioFormState = {
  name: string;
  templateType: ScenarioRecord["templateType"];
  description: string;
  snapshotIdDefault: string;
  modelVersionId: string;
  parameters: ScenarioRecord["parameterJson"];
  milestones: ScenarioMilestoneScheduleItem[];
};

type ScenarioConsoleProps = {
  scenarios: ScenarioRecord[];
  snapshots: SnapshotOption[];
  baselineModels: BaselineModelRecord[];
  user: AppSessionUser;
};

const templateDefaults: Record<ScenarioRecord["templateType"], ScenarioRecord["parameterJson"]> = {
  Baseline: { k_pc: 1, k_sp: 1, reward_global_factor: 1, reward_pool_factor: 1, cap_user_monthly: "2500", cap_group_monthly: "25000", sink_target: 0.3, cashout_mode: "WINDOWS", cashout_min_usd: 25, cashout_fee_bps: 150, cashout_windows_per_year: 4, cashout_window_days: 7, cohort_assumptions: scenarioCohortAssumptionsSchema.parse({}), projection_horizon_months: null, milestone_schedule: [] },
  Conservative: { k_pc: 0.8, k_sp: 0.8, reward_global_factor: 0.85, reward_pool_factor: 0.85, cap_user_monthly: "1800", cap_group_monthly: "18000", sink_target: 0.4, cashout_mode: "WINDOWS", cashout_min_usd: 50, cashout_fee_bps: 250, cashout_windows_per_year: 2, cashout_window_days: 5, cohort_assumptions: { new_members_per_month: 1, monthly_churn_rate_pct: 2, monthly_reactivation_rate_pct: 1, affiliate_new_member_share_pct: 20, cross_app_adoption_rate_pct: 15, new_member_value_factor: 0.55, reactivated_member_value_factor: 0.7 }, projection_horizon_months: null, milestone_schedule: [] },
  Growth: { k_pc: 1.2, k_sp: 1.2, reward_global_factor: 1.15, reward_pool_factor: 1.15, cap_user_monthly: "3000", cap_group_monthly: "30000", sink_target: 0.25, cashout_mode: "WINDOWS", cashout_min_usd: 25, cashout_fee_bps: 100, cashout_windows_per_year: 6, cashout_window_days: 7, cohort_assumptions: { new_members_per_month: 2, monthly_churn_rate_pct: 2.5, monthly_reactivation_rate_pct: 1.5, affiliate_new_member_share_pct: 25, cross_app_adoption_rate_pct: 20, new_member_value_factor: 0.65, reactivated_member_value_factor: 0.75 }, projection_horizon_months: null, milestone_schedule: [] },
  Stress: { k_pc: 0.65, k_sp: 0.7, reward_global_factor: 0.7, reward_pool_factor: 0.75, cap_user_monthly: "1200", cap_group_monthly: "12000", sink_target: 0.5, cashout_mode: "WINDOWS", cashout_min_usd: 75, cashout_fee_bps: 400, cashout_windows_per_year: 1, cashout_window_days: 3, cohort_assumptions: { new_members_per_month: 0, monthly_churn_rate_pct: 4, monthly_reactivation_rate_pct: 0.5, affiliate_new_member_share_pct: 10, cross_app_adoption_rate_pct: 10, new_member_value_factor: 0.45, reactivated_member_value_factor: 0.6 }, projection_horizon_months: null, milestone_schedule: [] },
};

const templateDescriptions: Record<ScenarioRecord["templateType"], string> = {
  Baseline: "Balanced defaults to test the standard reward profile",
  Conservative: "Tighter caps & higher fees to limit payout exposure",
  Growth: "Higher rewards & loose caps to accelerate adoption",
  Stress: "Restrictive settings to test worst-case treasury drain"
};

function getBaselineModelRecord(
  baselineModels: BaselineModelRecord[],
  modelVersionId: string
) {
  return baselineModels.find((item) => item.id === modelVersionId) ?? baselineModels[0] ?? null;
}

function sanitizeScenarioParameters(
  parameters: ScenarioParameters,
  baselineModels: BaselineModelRecord[],
  modelVersionId: string
) {
  return applyFounderScenarioGuardrails(
    parameters,
    getBaselineModelRecord(baselineModels, modelVersionId)?.guardrailDefaults
  );
}

function evaluateScenarioGuardrailsForModel(
  parameters: ScenarioParameters,
  baselineModels: BaselineModelRecord[],
  modelVersionId: string
) {
  return evaluateFounderScenarioGuardrails(
    parameters,
    getBaselineModelRecord(baselineModels, modelVersionId)?.guardrailDefaults
  );
}

function formatGuardrailIssueMessage(
  issues: ScenarioGuardrailIssue[] | undefined,
  fallback: string
) {
  if (!issues || issues.length === 0) {
    return fallback;
  }

  const firstError = issues.find((issue) => issue.severity === "ERROR") ?? issues[0];
  return firstError?.message ?? fallback;
}



function ChevronIcon() {
  return (
    <svg className="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function getTemplateBadgeClass(template: string) {
  switch (template) {
    case "Conservative": return "badge--info";
    case "Growth": return "badge--candidate";
    case "Stress": return "badge--rejected";
    default: return "badge--accent";
  }
}

type RunLaunchResponse = {
  id?: string;
  run?: { id: string; status?: string };
  error?: string;
  existingRunId?: string;
  guardrailIssues?: ScenarioGuardrailIssue[];
};

type ScenarioMutationResponse = {
  scenario?: {
    id: string;
    name: string;
    snapshotIdDefault: string | null;
  };
  error?: string;
  guardrailIssues?: ScenarioGuardrailIssue[];
};

type ScenarioConsoleMessage = {
  text: string;
  actionHref?: string;
  actionLabel?: string;
};

function createDefaultFormState(
  baselineModels: BaselineModelRecord[]
): ScenarioFormState {
  const activeModel = baselineModels.find((item) => item.status === "ACTIVE") ?? baselineModels[0];
  const parameters = sanitizeScenarioParameters(
    templateDefaults.Baseline,
    baselineModels,
    activeModel?.id ?? ""
  );

  return {
    name: "",
    templateType: "Baseline",
    description: "",
    snapshotIdDefault: "",
    modelVersionId: activeModel?.id ?? "",
    parameters,
    milestones: [...parameters.milestone_schedule]
  };
}

function createFormStateFromScenario(
  scenario: ScenarioRecord,
  baselineModels: BaselineModelRecord[]
): ScenarioFormState {
  const parameters = sanitizeScenarioParameters(
    scenario.parameterJson,
    baselineModels,
    scenario.modelVersionId
  );

  return {
    name: scenario.name,
    templateType: scenario.templateType,
    description: scenario.description ?? "",
    snapshotIdDefault: scenario.snapshotIdDefault ?? "",
    modelVersionId: scenario.modelVersionId,
    parameters,
    milestones: [...parameters.milestone_schedule]
  };
}

function buildScenarioParameters(formState: ScenarioFormState): ScenarioParameters {
  return {
    ...formState.parameters,
    milestone_schedule: formState.milestones
  };
}

function buildScenarioPayload(
  formState: ScenarioFormState,
  baselineModels: BaselineModelRecord[]
) {
  return {
    name: formState.name,
    templateType: formState.templateType,
    description: formState.description || null,
    snapshotIdDefault: formState.snapshotIdDefault || null,
    modelVersionId: formState.modelVersionId,
    parameters: sanitizeScenarioParameters(
      buildScenarioParameters(formState),
      baselineModels,
      formState.modelVersionId
    )
  };
}

function getScenarioPayloadFingerprint(
  formState: ScenarioFormState,
  baselineModels: BaselineModelRecord[]
) {
  return JSON.stringify(buildScenarioPayload(formState, baselineModels));
}

function getRunLaunchErrorMessage(
  errorCode: string | undefined,
  scenarioName: string,
  existingRunId?: string,
  guardrailIssues?: ScenarioGuardrailIssue[]
) {
  switch (errorCode) {
    case "duplicate_run":
      return existingRunId
        ? `${scenarioName} already has a saved result: ${getRunReference(existingRunId)}.`
        : `${scenarioName} already has a saved result.`;
    case "snapshot_required":
      return `Attach a data set to ${scenarioName} before running it.`;
    case "snapshot_not_found":
      return `The selected data set for ${scenarioName} no longer exists.`;
    case "snapshot_must_be_approved":
      return `Approve the selected data set before running ${scenarioName}.`;
    case "snapshot_has_no_facts":
      return `Import rows into the selected data set before running ${scenarioName}.`;
    case "scenario_not_found":
      return `${scenarioName} could not be found. Refresh and try again.`;
    case "validation_failed":
      return `Run launch failed validation for ${scenarioName}. Check the scenario inputs and try again.`;
    case "scenario_guardrail_failed":
      return formatGuardrailIssueMessage(
        guardrailIssues,
        `${scenarioName} still contains locked founder-unsafe parameters. Update the scenario before running it.`
      );
    default:
      return `Run failed for ${scenarioName}.`;
  }
}

function getDraftRunDisabledReason(
  parameters: ScenarioParameters,
  modelVersionId: string,
  baselineModels: BaselineModelRecord[],
  snapshotIdDefault: string,
  snapshots: SnapshotOption[],
  canRun: boolean
) {
  if (!canRun) return "You do not have permission to run simulations.";
  const guardrailIssues = evaluateScenarioGuardrailsForModel(
    parameters,
    baselineModels,
    modelVersionId
  );
  const blockingIssue = guardrailIssues.find((issue) => issue.severity === "ERROR");
  if (blockingIssue) return blockingIssue.message;
  if (!snapshotIdDefault) return "Attach a default data set before running this scenario.";

  const snapshot = snapshots.find((item) => item.id === snapshotIdDefault);

  if (!snapshot) return "The selected data set no longer exists.";
  if (snapshot.validationStatus !== "APPROVED") {
    return "Approve the default data set before running this scenario.";
  }
  if (snapshot.importedFactCount === 0) {
    return "Import rows into the default data set before running this scenario.";
  }
  return null;
}

function getSavedScenarioRunDisabledReason(
  scenario: ScenarioRecord,
  baselineModels: BaselineModelRecord[],
  canRun: boolean
) {
  if (!canRun) return "You do not have permission to run simulations.";

  const guardrailIssues = evaluateScenarioGuardrailsForModel(
    scenario.parameterJson,
    baselineModels,
    scenario.modelVersionId
  );
  const blockingIssue = guardrailIssues.find((issue) => issue.severity === "ERROR");
  if (blockingIssue) return blockingIssue.message;

  if (!scenario.snapshotDefault) {
    return "Attach a default data set before running this scenario.";
  }
  if (scenario.snapshotDefault.validationStatus !== "APPROVED") {
    return "Approve the default data set before running this scenario.";
  }
  if (scenario.snapshotDefault.importedFactCount === 0) {
    return "Import rows into the default data set before running this scenario.";
  }

  return null;
}

export function ScenarioConsole({ scenarios, snapshots, baselineModels, user }: ScenarioConsoleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<ScenarioConsoleMessage | null>(null);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [savedScenarioFingerprint, setSavedScenarioFingerprint] = useState<string | null>(null);
  const [runReadyScenarioId, setRunReadyScenarioId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["conversion"]));
  const [formState, setFormState] = useState<ScenarioFormState>(() => createDefaultFormState(baselineModels));

  const canWrite = user.capabilities.includes("scenarios.write");
  const canRun = user.capabilities.includes("runs.write");
  const canReadRuns = user.capabilities.includes("runs.read");

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function resetForm() {
    setEditingScenarioId(null);
    setSavedScenarioFingerprint(null);
    setRunReadyScenarioId(null);
    setShowForm(false);
    setFormState(createDefaultFormState(baselineModels));
  }

  function startEdit(scenario: ScenarioRecord) {
    const nextFormState = createFormStateFromScenario(scenario, baselineModels);

    setMessage(null);
    setEditingScenarioId(scenario.id);
    setSavedScenarioFingerprint(getScenarioPayloadFingerprint(nextFormState, baselineModels));
    setRunReadyScenarioId(null);
    setShowForm(true);
    setFormState(nextFormState);
  }

  async function launchScenarioRun(
    scenarioId: string,
    scenarioName: string,
    snapshotId?: string
  ) {
    setMessage(null);

    const response = await fetch(`/api/scenarios/${scenarioId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshotId: snapshotId || undefined
      })
    });
    const payload = (await response.json().catch(() => null)) as RunLaunchResponse | null;

    if (!response.ok) {
      if (payload?.error === "duplicate_run" && payload.existingRunId) {
        setMessage({
          text: getRunLaunchErrorMessage(
            payload.error,
            scenarioName,
            payload.existingRunId,
            payload.guardrailIssues
          ),
          actionHref: `/runs/${payload.existingRunId}`,
          actionLabel: "Open Existing Result"
        });
        return;
      }

      setMessage({
        text: getRunLaunchErrorMessage(
          payload?.error,
          scenarioName,
          payload?.existingRunId,
          payload?.guardrailIssues
        )
      });
      return;
    }

    const runId = payload?.id ?? payload?.run?.id;

    if (!runId) {
      setMessage({
        text: `Run queued for ${scenarioName}, but the run id was missing from the response.`
      });
      router.refresh();
      return;
    }

    setMessage({
      text:
        payload?.run?.status === "COMPLETED"
          ? `Run completed for ${scenarioName}.`
          : `Run queued for ${scenarioName}.`
    });
    router.push(`/runs/${runId}`);
  }

  const currentPayloadFingerprint = getScenarioPayloadFingerprint(formState, baselineModels);
  const hasScenarioChanges = editingScenarioId
    ? currentPayloadFingerprint !== savedScenarioFingerprint
    : false;
  const currentScenarioGuardrailIssues = evaluateScenarioGuardrailsForModel(
    buildScenarioParameters(formState),
    baselineModels,
    formState.modelVersionId
  );
  const currentScenarioGuardrailError = currentScenarioGuardrailIssues.find(
    (issue) => issue.severity === "ERROR"
  );
  const editRunDisabledReason = editingScenarioId
    ? getDraftRunDisabledReason(
        buildScenarioParameters(formState),
        formState.modelVersionId,
        baselineModels,
        formState.snapshotIdDefault,
        snapshots,
        canRun
      )
    : null;
  const showRunAfterUpdateButton =
    Boolean(editingScenarioId) &&
    runReadyScenarioId === editingScenarioId &&
    !hasScenarioChanges;
  const p = formState.parameters;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {message ? (
        <div
          className="card"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "space-between",
            padding: "0.9rem 1rem"
          }}
        >
          <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            {message.text}
          </p>
          {message.actionHref ? (
            <button
              className="ghost-button"
              onClick={() => router.push(message.actionHref!)}
              style={{ fontSize: "0.74rem", padding: "0.3rem 0.6rem" }}
              type="button"
            >
              {message.actionLabel ?? "Open"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Left: Form */}
        <div>
        {/* Create / Toggle Button */}
        {!showForm ? (
          <button
            className="primary-button"
            disabled={!canWrite}
            onClick={() => setShowForm(true)}
            type="button"
            style={{ marginBottom: "1rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Scenario
          </button>
        ) : null}

        {showForm ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0 }}>{editingScenarioId ? "Edit Scenario" : "New Scenario"}</h3>
              <button className="ghost-button" onClick={resetForm} type="button" style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}>Cancel</button>
            </div>

            {/* Template Selector */}
            <div className="template-grid" style={{ marginBottom: "1rem" }}>
              {(Object.keys(templateDefaults) as ScenarioRecord["templateType"][]).map((template) => (
                <button
                  className="template-card"
                  data-template={template}
                  data-selected={formState.templateType === template}
                  key={template}
                  onClick={() => {
                    const sanitizedParameters = sanitizeScenarioParameters(
                      templateDefaults[template],
                      baselineModels,
                      formState.modelVersionId
                    );
                    setFormState(c => ({
                      ...c,
                      templateType: template,
                      parameters: sanitizedParameters,
                      milestones: [...sanitizedParameters.milestone_schedule]
                    }));
                  }}
                  type="button"
                  disabled={!canWrite || isPending}
                >
                  <strong>{template}</strong>
                  <span>{templateDescriptions[template]}</span>
                </button>
              ))}
            </div>

            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                startTransition(async () => {
                  const endpoint = editingScenarioId ? `/api/scenarios/${editingScenarioId}` : "/api/scenarios";
                  const method = editingScenarioId ? "PATCH" : "POST";
                  const payload = buildScenarioPayload(formState, baselineModels);

                  if (editingScenarioId && !hasScenarioChanges) {
                    setRunReadyScenarioId(null);
                    setMessage({
                      text: "No scenario changes to update."
                    });
                    return;
                  }

                  const response = await fetch(endpoint, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                  });
                  const responsePayload = (await response.json().catch(() => null)) as ScenarioMutationResponse | null;
                  if (!response.ok) {
                    setRunReadyScenarioId(null);
                    setMessage({
                      text:
                        responsePayload?.error === "scenario_guardrail_failed"
                          ? formatGuardrailIssueMessage(
                              responsePayload?.guardrailIssues,
                              "Save failed because the scenario still contains founder-unsafe parameters."
                            )
                          : "Save failed. Check inputs."
                    });
                    return;
                  }

                  if (editingScenarioId) {
                    setSavedScenarioFingerprint(currentPayloadFingerprint);
                    setRunReadyScenarioId(editingScenarioId);
                    setMessage({
                      text: "Scenario updated. You can run it now."
                    });
                    router.refresh();
                    return;
                  }

                  const createdScenarioId = responsePayload?.scenario?.id;

                  if (!createdScenarioId) {
                    setRunReadyScenarioId(null);
                    setMessage({
                      text: "Scenario created, but the scenario id was missing from the response. Refresh and run it from Saved Scenarios."
                    });
                    router.refresh();
                    return;
                  }

                  setEditingScenarioId(createdScenarioId);
                  setSavedScenarioFingerprint(currentPayloadFingerprint);
                  setRunReadyScenarioId(createdScenarioId);
                  setMessage({
                    text: "Scenario created. You can run it now."
                  });
                  router.refresh();
                });
              }}
            >
              <div className="inline-fields">
                <label className="field">
                  <span>Name</span>
                  <input disabled={!canWrite || isPending} onChange={(e) => setFormState(c => ({ ...c, name: e.target.value }))} required value={formState.name} placeholder="e.g. Baseline Safety First" />
                </label>
                <label className="field">
                  <span>Baseline model</span>
                  <select
                    disabled={!canWrite || isPending}
                    onChange={(e) => {
                      const nextModelVersionId = e.target.value;
                      setFormState(c => {
                        const sanitizedParameters = sanitizeScenarioParameters(
                          buildScenarioParameters(c),
                          baselineModels,
                          nextModelVersionId
                        );

                        return {
                          ...c,
                          modelVersionId: nextModelVersionId,
                          parameters: sanitizedParameters,
                          milestones: [...sanitizedParameters.milestone_schedule]
                        };
                      });
                    }}
                    value={formState.modelVersionId}
                  >
                    {baselineModels.map((m) => <option key={m.id} value={m.id}>{m.versionName} ({m.status})</option>)}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Default snapshot</span>
                <select disabled={!canWrite || isPending} onChange={(e) => setFormState(c => ({ ...c, snapshotIdDefault: e.target.value }))} value={formState.snapshotIdDefault}>
                  <option value="">None</option>
                  {snapshots.map((s) => <option key={s.id} value={s.id}>{s.name} ({getDataSetStatusLabel(s.validationStatus)}, {s.importedFactCount.toLocaleString()} rows)</option>)}
                </select>
              </label>

              <label className="field">
                <span>Description</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState(c => ({ ...c, description: e.target.value }))} value={formState.description} placeholder="Optional notes about this scenario" />
              </label>

              <div
                className="card"
                style={{
                  background: "var(--surface-subtle)",
                  borderStyle: "dashed",
                  display: "grid",
                  gap: "0.65rem",
                  marginBottom: "0.25rem",
                  padding: "0.9rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Founder-Safe Scenario Guardrails</h4>
                    <p className="muted" style={{ fontSize: "0.78rem", margin: "0.25rem 0 0" }}>
                      Understanding-doc truth stays fixed. Scenario only changes ALPHA policy levers that remain defensible.
                    </p>
                  </div>
                  <span className="badge badge--neutral">Founder Mode</span>
                </div>
                {currentScenarioGuardrailError ? (
                  <p style={{ color: "var(--status-risky)", fontSize: "0.78rem", margin: 0 }}>
                    {currentScenarioGuardrailError.message}
                  </p>
                ) : null}
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {(["allowed", "conditional", "not_safe"] as const).map((status) => {
                    const entries = scenarioGuardrailMatrix.filter((entry) => entry.status === status);
                    const title =
                      status === "allowed"
                        ? "Allowed"
                        : status === "conditional"
                          ? "Assumption"
                          : "Locked";

                    return (
                      <div key={status}>
                        <p style={{ margin: "0 0 0.2rem", fontSize: "0.76rem", fontWeight: 600 }}>{title}</p>
                        <p className="muted" style={{ fontSize: "0.76rem", margin: 0, lineHeight: 1.5 }}>
                          {entries.map((entry) => entry.parameter_key).join(", ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accordion: Conversion Rules */}
              <div className="accordion-section" data-open={openSections.has("conversion")}>
                <button className="accordion-header" onClick={() => toggleSection("conversion")} type="button">
                  Conversion Rules
                  <span className="accordion-summary">k_pc: {p.k_pc} · k_sp: {p.k_sp}</span>
                  <ChevronIcon />
                </button>
                {openSections.has("conversion") ? (
                  <div className="accordion-body">
                    <div className="parameter-grid">
                      <label className="field">
                        <span>k_pc (reward multiplier for PC)</span>
                        <NumericInput disabled={!canWrite || isPending} min="0" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, k_pc: val } }))} step="0.01" value={p.k_pc} />
                      </label>
                      <label className="field">
                        <span>k_sp (reward multiplier for SP)</span>
                        <NumericInput disabled={!canWrite || isPending} min="0" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, k_sp: val } }))} step="0.01" value={p.k_sp} />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Accordion: Reward Settings */}
              <div className="accordion-section" data-open={openSections.has("reward")}>
                <button className="accordion-header" onClick={() => toggleSection("reward")} type="button">
                  Reward Settings
                  <span className="accordion-summary">Caps + sink · reward factors locked</span>
                  <ChevronIcon />
                </button>
                {openSections.has("reward") ? (
                  <div className="accordion-body">
                    <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
                      Generic global/pool reward multipliers are locked to the neutral baseline model values so the scenario cannot rewrite named reward sources from the understanding document.
                    </p>
                    <div className="parameter-grid">
                      <label className="field">
                        <span>Global reward factor</span>
                        <input disabled value={String(p.reward_global_factor)} />
                      </label>
                      <label className="field">
                        <span>Pool reward factor</span>
                        <input disabled value={String(p.reward_pool_factor)} />
                      </label>
                      <label className="field"><span>User monthly cap ($)</span><input disabled={!canWrite || isPending} onChange={(e) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cap_user_monthly: e.target.value } }))} value={p.cap_user_monthly} /></label>
                      <label className="field"><span>Group monthly cap ($)</span><input disabled={!canWrite || isPending} onChange={(e) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cap_group_monthly: e.target.value } }))} value={p.cap_group_monthly} /></label>
                      <label className="field"><span>Sink target (%)</span><NumericInput disabled={!canWrite || isPending} min="0" max="1" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, sink_target: val } }))} step="0.01" value={p.sink_target} /></label>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Accordion: Cash-Out Policy */}
              <div className="accordion-section" data-open={openSections.has("cashout")}>
                <button className="accordion-header" onClick={() => toggleSection("cashout")} type="button">
                  Cash-Out Policy
                  <span className="accordion-summary">{p.cashout_mode === "WINDOWS" ? `Windowed · ${p.cashout_windows_per_year}x/yr` : "Always Open"} · ${p.cashout_min_usd} min</span>
                  <ChevronIcon />
                </button>
                {openSections.has("cashout") ? (
                  <div className="accordion-body">
                    <div className="parameter-grid">
                      <label className="field"><span>Cash-out mode</span><select disabled={!canWrite || isPending} onChange={(e) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cashout_mode: e.target.value as "ALWAYS_OPEN" | "WINDOWS" } }))} value={p.cashout_mode}><option value="WINDOWS">Windowed</option><option value="ALWAYS_OPEN">Always Open</option></select></label>
                      <label className="field"><span>Min cash-out ($)</span><NumericInput disabled={!canWrite || isPending} min="0" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cashout_min_usd: val } }))} value={p.cashout_min_usd} /></label>
                      <label className="field"><span>Fee (basis points)</span><NumericInput disabled={!canWrite || isPending} min="0" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cashout_fee_bps: val } }))} value={p.cashout_fee_bps} /></label>
                      <label className="field"><span>Windows per year</span><NumericInput disabled={!canWrite || isPending} min="1" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cashout_windows_per_year: val } }))} value={p.cashout_windows_per_year} /></label>
                      <label className="field"><span>Window length (days)</span><NumericInput disabled={!canWrite || isPending} min="1" onChange={(val) => setFormState(c => ({ ...c, parameters: { ...c.parameters, cashout_window_days: val } }))} value={p.cashout_window_days} /></label>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Accordion: Growth Assumptions */}
              <div className="accordion-section" data-open={openSections.has("cohort")}>
                <button className="accordion-header" onClick={() => toggleSection("cohort")} type="button">
                  Growth Projection
                  <span className="accordion-summary">Locked off for founder-safe mode</span>
                  <ChevronIcon />
                </button>
                {openSections.has("cohort") ? (
                  <div className="accordion-body">
                    <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
                      Synthetic member growth, churn, and reactivation are disabled in founder-safe mode because they are not faithful to understanding-doc event logic.
                    </p>
                    <div className="parameter-grid">
                      <label className="field"><span>New members/month</span><input disabled value={String(founderSafePassiveCohortAssumptions.new_members_per_month)} /></label>
                      <label className="field"><span>Monthly churn (%)</span><input disabled value={String(founderSafePassiveCohortAssumptions.monthly_churn_rate_pct)} /></label>
                      <label className="field"><span>Reactivation rate (%)</span><input disabled value={String(founderSafePassiveCohortAssumptions.monthly_reactivation_rate_pct)} /></label>
                      <label className="field"><span>Affiliate share (%)</span><input disabled value={String(founderSafePassiveCohortAssumptions.affiliate_new_member_share_pct)} /></label>
                      <label className="field"><span>Cross-app adoption (%)</span><input disabled value={String(founderSafePassiveCohortAssumptions.cross_app_adoption_rate_pct)} /></label>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Accordion: Advanced */}
              <div className="accordion-section" data-open={openSections.has("advanced")}>
                <button className="accordion-header" onClick={() => toggleSection("advanced")} type="button">
                  Advanced
                  <span className="accordion-summary">{p.projection_horizon_months ? `${p.projection_horizon_months}mo` : "Auto"} · {formState.milestones.length} milestones</span>
                  <ChevronIcon />
                </button>
                {openSections.has("advanced") ? (
                  <div className="accordion-body">
                    <p className="muted" style={{ fontSize: "0.78rem", marginTop: 0 }}>
                      Projection horizon and milestone schedule are allowed, but they must be presented as scenario assumptions rather than direct consequences of the understanding document.
                    </p>
                    <label className="field" style={{ marginBottom: "0.5rem" }}>
                      <span>Projection horizon (months)</span>
                      <small>Leave empty to use the default from the data range.</small>
                      <input disabled={!canWrite || isPending} min="1" onChange={(e) => setFormState(c => ({ ...c, parameters: { ...c.parameters, projection_horizon_months: e.target.value ? Number(e.target.value) : null } }))} type="text" inputMode="numeric" pattern="[0-9]*" value={p.projection_horizon_months ?? ""} />
                    </label>
                    <div className="milestone-editor">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <div>
                          <span style={{ fontWeight: 500, fontSize: "0.8rem", color: "var(--text-secondary)" }}>Milestone schedule</span>
                          <small style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", lineHeight: 1.4 }}>Define staged policy changes over time.</small>
                        </div>
                        <button
                          className="ghost-button"
                          disabled={!canWrite || isPending}
                          onClick={() => {
                            const nextIdx = formState.milestones.length + 1;
                            const lastMs = formState.milestones[formState.milestones.length - 1];
                            const nextStart = lastMs ? (lastMs.end_month ?? lastMs.start_month) + 1 : 1;
                            setFormState(c => ({
                              ...c,
                              milestones: [...c.milestones, {
                                milestone_key: `m${nextIdx}`,
                                label: `M${nextIdx}`,
                                start_month: nextStart,
                                end_month: null,
                                parameter_overrides: {}
                              }]
                            }));
                          }}
                          type="button"
                          style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
                        >
                          + Add Milestone
                        </button>
                      </div>
                      {formState.milestones.length === 0 ? (
                        <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>No milestones defined. Click &quot;+ Add Milestone&quot; to create one.</p>
                      ) : (
                        <div className="milestone-list">
                          {formState.milestones.map((ms, idx) => (
                            <div className="milestone-row" key={idx}>
                              <div className="milestone-row-fields">
                                <label className="field">
                                  <span>Key</span>
                                  <input
                                    disabled={!canWrite || isPending}
                                    value={ms.milestone_key}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormState(c => ({ ...c, milestones: c.milestones.map((m, i) => i === idx ? { ...m, milestone_key: val } : m) }));
                                    }}
                                    placeholder="m1"
                                  />
                                </label>
                                <label className="field">
                                  <span>Label</span>
                                  <input
                                    disabled={!canWrite || isPending}
                                    value={ms.label}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormState(c => ({ ...c, milestones: c.milestones.map((m, i) => i === idx ? { ...m, label: val } : m) }));
                                    }}
                                    placeholder="M1 - Stabilize"
                                  />
                                </label>
                                <label className="field">
                                  <span>Start month</span>
                                  <input
                                    disabled={!canWrite || isPending}
                                    type="number"
                                    min="1"
                                    value={ms.start_month}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setFormState(c => ({ ...c, milestones: c.milestones.map((m, i) => i === idx ? { ...m, start_month: val } : m) }));
                                    }}
                                  />
                                </label>
                                <label className="field">
                                  <span>End month</span>
                                  <input
                                    disabled={!canWrite || isPending}
                                    type="number"
                                    min="1"
                                    value={ms.end_month ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value ? Number(e.target.value) : null;
                                      setFormState(c => ({ ...c, milestones: c.milestones.map((m, i) => i === idx ? { ...m, end_month: val } : m) }));
                                    }}
                                    placeholder="—"
                                  />
                                </label>
                                <button
                                  className="ghost-button milestone-remove-btn"
                                  disabled={!canWrite || isPending}
                                  onClick={() => {
                                    setFormState(c => ({ ...c, milestones: c.milestones.filter((_, i) => i !== idx) }));
                                  }}
                                  type="button"
                                  title="Remove milestone"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="action-row">
                <button
                  className="primary-button"
                  disabled={!canWrite || isPending || Boolean(editingScenarioId && !hasScenarioChanges)}
                  type="submit"
                >
                  {isPending ? "Saving..." : editingScenarioId ? "Update Scenario" : "Create Scenario"}
                </button>
                {showRunAfterUpdateButton && editingScenarioId ? (
                  <button
                    className="primary-button"
                    disabled={Boolean(editRunDisabledReason) || isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await launchScenarioRun(
                          editingScenarioId,
                          formState.name,
                          formState.snapshotIdDefault
                        );
                      });
                    }}
                    style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}
                    title={editRunDisabledReason ?? undefined}
                    type="button"
                  >
                    Run ▶
                  </button>
                ) : null}
                {editingScenarioId ? <button className="ghost-button" onClick={resetForm} type="button">Cancel</button> : null}
              </div>
            </form>
          </div>
        ) : null}
        </div>

        {/* Right: Saved Scenarios */}
        <div>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem", color: "var(--text-secondary)" }}>Saved Scenarios</h3>
        {scenarios.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No scenarios yet</h3>
            <p>Create your first scenario to start running simulations.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {scenarios.map((scenario) => {
              const runDisabledReason = scenario.latestRun
                ? null
                : getSavedScenarioRunDisabledReason(
                    scenario,
                    baselineModels,
                    canRun
                  );
              const seeResultDisabledReason = !canReadRuns
                ? "You do not have permission to view simulation results."
                : null;

              return (
                <div className="card" key={scenario.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem" }}>{scenario.name}</h4>
                  <span className={`badge ${getTemplateBadgeClass(scenario.templateType)}`}>{scenario.templateType}</span>
                </div>
                <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 0.35rem" }}>
                  {scenario.modelVersion.versionName} · k_pc: {scenario.parameterJson.k_pc} · k_sp: {scenario.parameterJson.k_sp} · Cap: ${scenario.parameterJson.cap_user_monthly}
                </p>
                {scenario.snapshotDefault ? (
                  <p className="muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>
                    <span className={`badge ${scenario.snapshotDefault.validationStatus === "APPROVED" ? "badge--candidate" : "badge--neutral"}`} style={{ fontSize: "0.6rem", marginRight: "0.3rem" }}>{getDataSetStatusLabel(scenario.snapshotDefault.validationStatus)}</span>
                    {scenario.snapshotDefault.name} ({scenario.snapshotDefault.importedFactCount.toLocaleString()} rows)
                  </p>
                ) : (
                  <p className="muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem", color: "var(--status-risky)" }}>No snapshot attached</p>
                )}
                <div className="action-row">
                  <button className="ghost-button" disabled={!canWrite} onClick={() => startEdit(scenario)} type="button" style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}>Edit</button>
                  {scenario.latestRun ? (
                    <button
                      className="primary-button"
                      disabled={Boolean(seeResultDisabledReason) || isPending}
                      onClick={() => {
                        if (scenario.latestRun) {
                          router.push(`/runs/${scenario.latestRun.id}`);
                        }
                      }}
                      type="button"
                      title={seeResultDisabledReason ?? undefined}
                      style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}
                    >
                      See Result
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      disabled={Boolean(runDisabledReason) || isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await launchScenarioRun(
                            scenario.id,
                            scenario.name,
                            scenario.snapshotIdDefault ?? undefined
                          );
                        });
                      }}
                      type="button"
                      title={runDisabledReason ?? undefined}
                      style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}
                    >
                      Run ▶
                    </button>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </section>
  );
}
