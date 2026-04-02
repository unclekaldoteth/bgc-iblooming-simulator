const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "0.0.0.0", "::1", "localhost"]);

type DatabaseUrlMode = "prisma" | "postgres";

const fallbackEnvKeysByMode: Record<DatabaseUrlMode, readonly string[]> = {
  prisma: [
    "POSTGRES_PRISMA_DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING"
  ],
  postgres: [
    "POSTGRES_DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_DATABASE_URL",
    "POSTGRES_PRISMA_URL"
  ]
};

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string";
}

function parseHostname(connectionString: string) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return null;
  }
}

function isLocalDatabaseUrl(connectionString: string) {
  const hostname = parseHostname(connectionString);
  return hostname ? LOCAL_DATABASE_HOSTS.has(hostname) : false;
}

function shouldRejectConfiguredUrl(connectionString: string) {
  return isVercelRuntime() && isLocalDatabaseUrl(connectionString);
}

function getFallbackDatabaseUrl(mode: DatabaseUrlMode) {
  for (const envKey of fallbackEnvKeysByMode[mode]) {
    const value = normalizeEnvValue(process.env[envKey]);

    if (!value || shouldRejectConfiguredUrl(value)) {
      continue;
    }

    return { envKey, value };
  }

  return null;
}

export function resolveDatabaseUrl(mode: DatabaseUrlMode, consumer: string) {
  const configuredUrl = normalizeEnvValue(process.env.DATABASE_URL);

  if (configuredUrl && !shouldRejectConfiguredUrl(configuredUrl)) {
    return configuredUrl;
  }

  const fallback = getFallbackDatabaseUrl(mode);
  if (fallback) {
    process.env.DATABASE_URL = fallback.value;
    return fallback.value;
  }

  if (!configuredUrl) {
    throw new Error(`DATABASE_URL is required for ${consumer}.`);
  }

  const hostname = parseHostname(configuredUrl) ?? "localhost";
  throw new Error(
    `DATABASE_URL points to ${hostname} in a Vercel deployment. Local database URLs such as 127.0.0.1:5433 only work on your machine. Set DATABASE_URL to a hosted Postgres connection string, or provide Vercel Postgres variables such as POSTGRES_PRISMA_DATABASE_URL, POSTGRES_DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL.`
  );
}

export function hasDatabaseUrl() {
  try {
    resolveDatabaseUrl("prisma", "the application");
    return true;
  } catch {
    return false;
  }
}
