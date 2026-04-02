import { PrismaClient } from "@prisma/client";

import { resolveDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

resolveDatabaseUrl("prisma", "Prisma Client");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
