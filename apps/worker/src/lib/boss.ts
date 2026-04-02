import PgBoss from "pg-boss";

import { resolveDatabaseUrl } from "@bgc-alpha/db/database-url";

export async function createBoss() {
  const connectionString = resolveDatabaseUrl("postgres", "the worker");

  const boss = new PgBoss({
    connectionString
  });

  await boss.start();
  return boss;
}
