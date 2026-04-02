import PgBoss from "pg-boss";

import { resolveDatabaseUrl } from "@bgc-alpha/db/database-url";

const globalForBoss = globalThis as unknown as {
  bossPromise?: Promise<PgBoss>;
};

async function createQueueClient() {
  const connectionString = resolveDatabaseUrl("postgres", "queued run orchestration");

  const boss = new PgBoss({
    connectionString
  });

  await boss.start();
  return boss;
}

export async function getQueueClient() {
  if (!globalForBoss.bossPromise) {
    globalForBoss.bossPromise = createQueueClient();
  }

  return globalForBoss.bossPromise;
}

export async function enqueueJob<T extends object>(name: string, data: T) {
  const boss = await getQueueClient();
  await boss.createQueue(name);
  return boss.send(name, data);
}
