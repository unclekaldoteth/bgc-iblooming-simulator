import { listBaselineModelVersions, listScenarios, listSnapshots } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import { parseFounderSafeScenarioParameters } from "@bgc-alpha/schemas";
import { PageHeader } from "@bgc-alpha/ui";

import { ScenarioConsole } from "@/components/scenario-console";
import { requirePageUser } from "@/lib/auth-session";

const validTemplates = ["Baseline", "Conservative", "Growth", "Stress"] as const;

function toTemplateType(value: string) {
  return validTemplates.includes(value as (typeof validTemplates)[number])
    ? (value as (typeof validTemplates)[number])
    : "Baseline";
}

export default async function ScenariosPage() {
  const databaseConfigured = hasDatabaseUrl();
  const user = await requirePageUser(["scenarios.read"]);
  const [scenarios, snapshots, baselineModels] = databaseConfigured
    ? await Promise.all([
        listScenarios({ includeArchived: true }),
        listSnapshots({ includeArchived: true }),
        listBaselineModelVersions()
      ])
    : [[], [], []];

  return (
    <>
      <PageHeader
        step={{ current: 2, total: 4, label: "Policy Configuration" }}
        title="Scenarios"
        description="Create ALPHA policy configurations with adjustable parameters and run simulations."
      />

      {!databaseConfigured ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>Database setup required</h3>
          <p className="muted">
            Configure DATABASE_URL and seed the baseline model first.
          </p>
        </div>
      ) : null}

      <ScenarioConsole
        baselineModels={baselineModels.map((model) => ({
          id: model.id,
          versionName: model.versionName,
          status: model.status,
          guardrailDefaults: {
            reward_global_factor: resolveBaselineModelRuleset(
              model.rulesetJson,
              model.versionName
            ).defaults.reward_global_factor,
            reward_pool_factor: resolveBaselineModelRuleset(
              model.rulesetJson,
              model.versionName
            ).defaults.reward_pool_factor
          }
        }))}
        scenarios={scenarios.map((scenario) => ({
          ...scenario,
          templateType: toTemplateType(scenario.templateType),
          latestRun: scenario.runs[0]
            ? {
                id: scenario.runs[0].id,
                status: scenario.runs[0].status
              }
            : null,
          runCount: scenario._count.runs,
          archivedAt: scenario.archivedAt?.toISOString() ?? null,
          parameterJson: parseFounderSafeScenarioParameters(scenario.parameterJson, {
            reward_global_factor: resolveBaselineModelRuleset(
              scenario.modelVersion.rulesetJson,
              scenario.modelVersion.versionName
            ).defaults.reward_global_factor,
            reward_pool_factor: resolveBaselineModelRuleset(
              scenario.modelVersion.rulesetJson,
              scenario.modelVersion.versionName
            ).defaults.reward_pool_factor
          }),
          snapshotDefault: scenario.snapshotDefault
            ? {
                id: scenario.snapshotDefault.id,
                name: scenario.snapshotDefault.name,
                hasDataFingerprint: Boolean(scenario.snapshotDefault.dataFingerprint),
                validationStatus: scenario.snapshotDefault.validationStatus,
                importedFactCount: scenario.snapshotDefault._count.memberMonthFacts,
                archivedAt: scenario.snapshotDefault.archivedAt?.toISOString() ?? null
              }
            : null,
          adoptedBaselineRunId: scenario.adoptedBaselineRunId ?? null,
          adoptedBaselineAt: scenario.adoptedBaselineAt?.toISOString() ?? null,
          adoptedBaselineNote: scenario.adoptedBaselineNote ?? null,
          adoptedBaselineRun: scenario.adoptedBaselineRun
            ? {
                id: scenario.adoptedBaselineRun.id,
                status: scenario.adoptedBaselineRun.status,
                completedAt: scenario.adoptedBaselineRun.completedAt?.toISOString() ?? null
              }
            : null,
          updatedAt: scenario.updatedAt.toISOString()
        }))}
        snapshots={snapshots.map((snapshot) => ({
          id: snapshot.id,
          name: snapshot.name,
          hasDataFingerprint: Boolean(snapshot.dataFingerprint),
          validationStatus: snapshot.validationStatus,
          importedFactCount: snapshot._count.memberMonthFacts,
          archivedAt: snapshot.archivedAt?.toISOString() ?? null
        }))}
        user={user}
      />
    </>
  );
}
