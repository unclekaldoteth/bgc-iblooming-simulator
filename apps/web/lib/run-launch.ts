import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveBaselineModelRuleset } from "@bgc-alpha/baseline-model";
import {
  createSimulationRunIfUnique,
  getScenarioById,
  getSnapshotById,
  markRunFailed,
  processSimulationRun,
  writeAuditEvent
} from "@bgc-alpha/db";
import {
  evaluateFounderScenarioGuardrails,
  parseFounderSafeScenarioParameters
} from "@bgc-alpha/schemas";

import { jsonError } from "@/lib/http";
import { enqueueJob } from "@/lib/queue";

type LaunchSimulationRunParams = {
  scenarioId: string;
  snapshotId?: string;
  userId: string;
};

export async function launchSimulationRun({
  scenarioId,
  snapshotId,
  userId
}: LaunchSimulationRunParams) {
  let runId: string | null = null;
  const shouldProcessInline = Boolean(process.env.VERCEL);
  let inlineProcessingStarted = false;

  try {
    const scenario = await getScenarioById(scenarioId);

    if (!scenario) {
      return NextResponse.json(
        {
          error: "scenario_not_found"
        },
        {
          status: 404
        }
      );
    }

    const baselineModel = resolveBaselineModelRuleset(
      scenario.modelVersion.rulesetJson,
      scenario.modelVersion.versionName
    );
    const scenarioParameters = parseFounderSafeScenarioParameters(scenario.parameterJson, {
      reward_global_factor: baselineModel.defaults.reward_global_factor,
      reward_pool_factor: baselineModel.defaults.reward_pool_factor
    });
    const guardrailIssues = evaluateFounderScenarioGuardrails(scenarioParameters, {
      reward_global_factor: baselineModel.defaults.reward_global_factor,
      reward_pool_factor: baselineModel.defaults.reward_pool_factor
    });

    if (guardrailIssues.some((issue) => issue.severity === "ERROR")) {
      return NextResponse.json(
        {
          error: "scenario_guardrail_failed",
          guardrailIssues
        },
        {
          status: 400
        }
      );
    }

    const resolvedSnapshotId = snapshotId ?? scenario.snapshotIdDefault ?? undefined;

    if (!resolvedSnapshotId) {
      return NextResponse.json(
        {
          error: "snapshot_required"
        },
        {
          status: 400
        }
      );
    }

    const snapshot = await getSnapshotById(resolvedSnapshotId);

    if (!snapshot) {
      return NextResponse.json(
        {
          error: "snapshot_not_found"
        },
        {
          status: 400
        }
      );
    }

    if (snapshot.validationStatus !== "APPROVED") {
      return NextResponse.json(
        {
          error: "snapshot_must_be_approved"
        },
        {
          status: 400
        }
      );
    }

    if (snapshot._count.memberMonthFacts === 0) {
      return NextResponse.json(
        {
          error: "snapshot_has_no_facts"
        },
        {
          status: 400
        }
      );
    }

    const seedHash = createHash("sha256")
      .update(
        JSON.stringify({
          snapshotId: snapshot.id,
          baselineModelVersionId: scenario.modelVersionId,
          scenarioId: scenario.id,
          parameters: scenarioParameters
        })
      )
      .digest("hex");

    const createRunResult = await createSimulationRunIfUnique({
      scenarioId: scenario.id,
      snapshotId: snapshot.id,
      modelVersionId: scenario.modelVersionId,
      createdBy: userId,
      engineVersion: process.env.SIMULATION_ENGINE_VERSION ?? "0.1.0",
      seedHash
    });

    if (createRunResult.duplicateOf) {
      return NextResponse.json(
        {
          error: "duplicate_run",
          existingRunId: createRunResult.duplicateOf.id
        },
        {
          status: 409
        }
      );
    }

    const run = createRunResult.run;

    if (!run) {
      throw new Error("run_creation_failed");
    }

    runId = run.id;

    if (shouldProcessInline) {
      inlineProcessingStarted = true;
      const completedRun = await processSimulationRun(run.id);

      return NextResponse.json(
        {
          id: run.id,
          run: completedRun
        },
        {
          status: 200
        }
      );
    }

    await enqueueJob("simulation.run", {
      runId: run.id
    });

    await writeAuditEvent({
      actorUserId: userId,
      entityType: "simulation_run",
      entityId: run.id,
      action: "run.queued",
      metadata: {
        scenarioId: scenario.id,
        snapshotId: snapshot.id,
        seedHash
      }
    });

    return NextResponse.json(
      {
        id: run.id,
        run
      },
      {
        status: 202
      }
    );
  } catch (error) {
    if (runId && !inlineProcessingStarted) {
      await markRunFailed(runId, error instanceof Error ? error.message : "run_failed");
    }

    return jsonError(error);
  }
}
