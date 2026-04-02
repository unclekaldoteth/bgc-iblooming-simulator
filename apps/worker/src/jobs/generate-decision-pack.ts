import type PgBoss from "pg-boss";

import { generateDecisionPackForRun, getRunById } from "@bgc-alpha/db";
import {
  type MilestoneEvaluation,
  type StrategicObjectiveScorecard
} from "@bgc-alpha/schemas";

export async function registerDecisionPackJob(boss: PgBoss) {
  await boss.createQueue("decision-pack.generate");
  await boss.work<{
    runId?: string;
    strategicObjectives?: StrategicObjectiveScorecard[];
    milestoneEvaluations?: MilestoneEvaluation[];
  }>(
    "decision-pack.generate",
    async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    const runId = String(job.data?.runId ?? "");

    if (!runId) {
      return { ok: false, reason: "runId is required." };
    }

    const run = await getRunById(runId);

    if (!run) {
      return { ok: false, reason: `Run ${runId} was not found.` };
    }

    const savedPack = await generateDecisionPackForRun(
      runId,
      job.data?.strategicObjectives ?? [],
      job.data?.milestoneEvaluations ?? []
    );

    console.log("[worker] generate decision pack", {
      runId,
      decisionPackId: savedPack.id
    });

    return { ok: true, decisionPackId: savedPack.id };
    }
  );
}
