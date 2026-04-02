import { listSnapshots } from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { PageHeader } from "@bgc-alpha/ui";

import { SnapshotConsole } from "@/components/snapshot-console";
import { requirePageUser } from "@/lib/auth-session";

export default async function SnapshotsPage() {
  const databaseConfigured = hasDatabaseUrl();
  const user = await requirePageUser(["snapshots.read"]);
  const snapshots = databaseConfigured ? await listSnapshots() : [];

  return (
    <>
      <PageHeader
        step={{ current: 1, total: 3, label: "Historical Data" }}
        title="Snapshots"
        description="Upload historical business data, validate it, and approve datasets for simulation."
      />

      {!databaseConfigured ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>Database setup required</h3>
          <p className="muted">
            Configure DATABASE_URL before using snapshot registration.
          </p>
        </div>
      ) : null}

      <SnapshotConsole
        snapshots={snapshots.map((snapshot) => ({
          ...snapshot,
          sourceSystems: Array.isArray(snapshot.sourceSystems)
            ? snapshot.sourceSystems.map((value) => String(value))
            : [],
          latestImportRun: snapshot.importRuns[0]
            ? {
                ...snapshot.importRuns[0],
                startedAt: snapshot.importRuns[0].startedAt?.toISOString() ?? null,
                completedAt: snapshot.importRuns[0].completedAt?.toISOString() ?? null
              }
            : null,
          importedFactCount: snapshot._count.memberMonthFacts,
          dateFrom: snapshot.dateFrom.toISOString(),
          dateTo: snapshot.dateTo.toISOString(),
          approvedAt: snapshot.approvedAt?.toISOString() ?? null
        }))}
        user={user}
      />
    </>
  );
}
