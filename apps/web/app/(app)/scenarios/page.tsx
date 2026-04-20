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
    ? await Promise.all([listScenarios(), listSnapshots(), listBaselineModelVersions()])
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
                validationStatus: scenario.snapshotDefault.validationStatus,
                importedFactCount: scenario.snapshotDefault._count.memberMonthFacts
              }
            : null,
          updatedAt: scenario.updatedAt.toISOString()
        }))}
        snapshots={snapshots.map((snapshot) => ({
          id: snapshot.id,
          name: snapshot.name,
          validationStatus: snapshot.validationStatus,
          importedFactCount: snapshot._count.memberMonthFacts
        }))}
        user={user}
      />
    </>
  );
}
