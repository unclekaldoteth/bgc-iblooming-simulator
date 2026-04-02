import type PgBoss from "pg-boss";

import { processSimulationRun } from "@bgc-alpha/db";

type SimulationJobData = {
  runId?: string;
};

export async function registerSimulationJob(boss: PgBoss) {
  await boss.createQueue("simulation.run");
  await boss.work<SimulationJobData>("simulation.run", async (jobs) => {
    const job = jobs[0];

    if (!job) {
      return { ok: false, reason: "No job payload received." };
    }

    const jobData = job.data ?? {};
    const runId = String(jobData.runId ?? "");

    if (!runId) {
      return { ok: false, reason: "runId is required." };
    }
    const persistedRun = await processSimulationRun(runId);

    console.log("[worker] run simulation", {
      runId,
      status: persistedRun?.status
    });

    return persistedRun;
  });
}
