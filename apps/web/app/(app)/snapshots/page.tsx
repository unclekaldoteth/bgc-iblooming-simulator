import {
  buildSnapshotManifest,
  getSnapshotCanonicalGapAudit,
  getSnapshotStorageCleanupReport,
  getSnapshotTruthCoverage,
  listSnapshots
} from "@bgc-alpha/db";
import { hasDatabaseUrl } from "@bgc-alpha/db/database-url";
import { hasBlobReadWriteToken } from "@bgc-alpha/db/snapshot-storage";
import { PageHeader } from "@bgc-alpha/ui";

import { SnapshotConsole } from "@/components/snapshot-console";
import { requirePageUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export default async function SnapshotsPage() {
  const databaseConfigured = hasDatabaseUrl();
  const user = await requirePageUser(["snapshots.read"]);
  const [snapshots, cleanupReport] = databaseConfigured
    ? await Promise.all([
        listSnapshots({ includeArchived: true }),
        getSnapshotStorageCleanupReport()
      ])
    : [[], null];
  const snapshotProfiles = databaseConfigured
    ? await Promise.all(
        snapshots.map(async (snapshot) => {
          const truthCoverage = await getSnapshotTruthCoverage(snapshot.id);
          const canonicalGapAudit = await getSnapshotCanonicalGapAudit(snapshot.id);

          return {
            snapshotId: snapshot.id,
            truthCoverage,
            manifest: buildSnapshotManifest(snapshot, truthCoverage),
            canonicalGapAudit
          };
        })
      )
    : [];
  const snapshotProfileById = new Map(snapshotProfiles.map((profile) => [profile.snapshotId, profile] as const));

  return (
    <>
      <PageHeader
        step={{ current: 1, total: 4, label: "Source Data" }}
        title="Snapshots"
        description="Upload past business data, check it, and approve it for simulations."
      />

      {!databaseConfigured ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>Database setup required</h3>
          <p className="muted">
            Set DATABASE_URL before adding snapshots.
          </p>
        </div>
      ) : null}

      <SnapshotConsole
        snapshots={snapshots.map((snapshot) => ({
          ...snapshot,
          sourceSystems: Array.isArray(snapshot.sourceSystems)
            ? snapshot.sourceSystems.map((value) => String(value))
            : [],
          manifest: snapshotProfileById.get(snapshot.id)?.manifest ?? null,
          truthCoverage: snapshotProfileById.get(snapshot.id)?.truthCoverage ?? null,
          canonicalGapAudit: snapshotProfileById.get(snapshot.id)?.canonicalGapAudit ?? null,
          latestImportRun: snapshot.importRuns[0]
            ? {
                ...snapshot.importRuns[0],
                startedAt: snapshot.importRuns[0].startedAt?.toISOString() ?? null,
                completedAt: snapshot.importRuns[0].completedAt?.toISOString() ?? null
              }
            : null,
          importedFactCount: snapshot._count.memberMonthFacts,
          scenarioRefCount: snapshot._count.scenarios,
          runRefCount: snapshot._count.runs,
          dateFrom: snapshot.dateFrom.toISOString(),
          dateTo: snapshot.dateTo.toISOString(),
          approvedAt: snapshot.approvedAt?.toISOString() ?? null,
          archivedAt: snapshot.archivedAt?.toISOString() ?? null,
          truthNotes: snapshot.truthNotes ?? null,
          sourceType: snapshot.sourceType,
          validatedVia: snapshot.validatedVia,
          canonicalSourceSnapshotKey: snapshot.canonicalSourceSnapshotKey ?? null,
          supersededBySnapshotId: snapshot.supersededBySnapshotId ?? null,
          supersededBySnapshot: snapshot.supersededBySnapshot
            ? {
                id: snapshot.supersededBySnapshot.id,
                name: snapshot.supersededBySnapshot.name
              }
            : null
        }))}
        blobUploadsEnabled={hasBlobReadWriteToken()}
        cleanupReport={cleanupReport}
        user={user}
      />
    </>
  );
}
