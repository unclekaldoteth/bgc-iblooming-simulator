"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { AppSessionUser } from "@/lib/auth-session";
import {
  getCanonicalGapStatusLabel,
  getDataSetStatusLabel,
  getHistoricalTruthCoverageLabel,
  getImportStatusLabel,
  getRiskSeverityLabel,
  getSnapshotFounderReadinessLabel,
  getSnapshotSourceTypeLabel,
  getSnapshotValidationBasisLabel
} from "@/lib/common-language";
import {
  createSnapshotUploadPathname,
  isSnapshotDataFilename,
  maxSnapshotUploadBytes
} from "@/lib/snapshot-upload";

type SnapshotRecord = {
  id: string;
  name: string;
  sourceSystems: string[];
  canonicalSourceSnapshotKey?: string | null;
  sourceType: string;
  validatedVia: string;
  truthNotes: string | null;
  supersededBySnapshotId: string | null;
  supersededBySnapshot: { id: string; name: string } | null;
  dateFrom: string;
  dateTo: string;
  fileUri: string;
  recordCount: number | null;
  dataFingerprint: unknown | null;
  validationStatus: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  notes: string | null;
  importedFactCount: number;
  scenarioRefCount: number;
  runRefCount: number;
  archivedAt: string | null;
  manifest: {
    sourceType: "compatibility_csv" | "canonical_csv" | "canonical_json" | "canonical_bundle" | "hybrid_verified";
    validatedVia: "monthly_facts" | "canonical_events" | "hybrid_validation";
    truthLevel: "strong" | "partial" | "weak";
    founderReadiness: "founder_safe" | "needs_canonical_closure";
    summary: string;
    truthNotes?: string | null;
    supersededBySnapshotId?: string | null;
  } | null;
  truthCoverage: {
    status: "strong" | "partial" | "weak";
    summary: string;
    rows: Array<{
      key: string;
      label: string;
      status: "available" | "partial" | "missing";
      detail: string;
    }>;
  } | null;
  canonicalGapAudit: {
    readiness: "strong" | "partial" | "weak";
    summary: string;
    rows: Array<{
      key: string;
      label: string;
      status: "covered" | "partial" | "missing";
      detail: string;
    }>;
  } | null;
  latestImportRun: {
    id: string;
    status: string;
    rowCountRaw: number | null;
    rowCountImported: number | null;
    startedAt: string | null;
    completedAt: string | null;
    notes: string | null;
    issues: Array<{
      id: string;
      severity: string;
      issueType: string;
      message: string;
      rowRef: string | null;
    }>;
  } | null;
  validationIssues: Array<{
    id: string;
    severity: string;
    issueType: string;
    message: string;
  }>;
};

type SnapshotCleanupReport = {
  totals: {
    archivedSnapshots: number;
    lockedSnapshots: number;
    unreferencedArchivedSnapshots: number;
    rawFileCleanupCandidates: number;
    failedImportCandidates: number;
    supersedeCandidates: number;
  };
  rawFileCleanupCandidates: Array<{
    id: string;
    name: string;
    archivedAt: string | null;
    scenarioRefs: number;
    runRefs: number;
  }>;
  failedImportCandidates: Array<{
    id: string;
    snapshotId: string;
    snapshotName: string;
    completedAt: string | null;
  }>;
  supersedeCandidates: Array<{
    id: string;
    name: string;
    canonicalSourceSnapshotKey: string | null;
    createdAt: string;
    scenarioRefs: number;
    runRefs: number;
  }>;
};

type SnapshotConsoleProps = {
  snapshots: SnapshotRecord[];
  blobUploadsEnabled: boolean;
  cleanupReport: SnapshotCleanupReport | null;
  user: AppSessionUser;
};

type SnapshotArchiveResponse = {
  error?: string;
};

type SnapshotScope = "active" | "archived" | "all";

type ImportResponse = {
  error?: string;
  importRun?: {
    status: string;
    rowCountImported: number | null;
  };
};

const defaultFormState = {
  name: "",
  sourceSystems: "bgc, iblooming",
  sourceType: "compatibility_csv",
  validatedVia: "monthly_facts",
  truthNotes: "",
  supersededBySnapshotId: "",
  dateFrom: "",
  dateTo: "",
  fileUri: "",
  recordCount: "",
  notes: ""
};

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "APPROVED": return "badge--candidate";
    case "VALID": return "badge--info";
    case "INVALID": return "badge--rejected";
    case "VALIDATING": return "badge--info";
    case "ARCHIVED": return "badge--neutral";
    default: return "badge--neutral";
  }
}

function isActiveImportStatus(status: string | null | undefined) {
  return status === "QUEUED" || status === "RUNNING";
}

function formatImportRowSummary(snapshot: SnapshotRecord) {
  const run = snapshot.latestImportRun;
  if (!run) return null;

  const sourceRows = run.rowCountRaw ?? 0;
  const simulationRows = run.rowCountImported ?? snapshot.importedFactCount;

  return `Source rows read: ${sourceRows.toLocaleString()} · Simulation rows created: ${simulationRows.toLocaleString()}`;
}

function getProgressSteps(snapshot: SnapshotRecord) {
  const created = true;
  const imported = snapshot.importedFactCount > 0 || snapshot.latestImportRun?.status === "COMPLETED";
  const importing = isActiveImportStatus(snapshot.latestImportRun?.status);
  const integrity = Boolean(snapshot.dataFingerprint);
  const validated = ["VALID", "APPROVED"].includes(snapshot.validationStatus);
  const validating = snapshot.validationStatus === "VALIDATING";
  const approved = snapshot.validationStatus === "APPROVED";

  return [
    { label: "Created", done: created, active: false },
    { label: "Imported", done: imported, active: importing },
    { label: "Data Check", done: integrity, active: false },
    { label: "Checked", done: validated, active: validating },
    { label: "Approved", done: approved, active: false },
  ];
}

function getSnapshotValidationErrorMessage(errorCode: string | undefined, snapshotName: string) {
  switch (errorCode) {
    case "snapshot_import_in_progress":
      return `${snapshotName} is still importing. Wait for the import to finish first.`;
    case "snapshot_archived":
      return `${snapshotName} is archived. Unarchive it before checking it.`;
    case "snapshot_has_no_imported_rows":
      return `Import rows into ${snapshotName} before checking it.`;
    default:
      return `Data check failed for ${snapshotName}.`;
  }
}

function getSnapshotApprovalErrorMessage(errorCode: string | undefined, snapshotName: string) {
  switch (errorCode) {
    case "snapshot_import_in_progress":
      return `${snapshotName} is still importing. Wait for the import to finish first.`;
    case "snapshot_archived":
      return `${snapshotName} is archived. Unarchive it before approving.`;
    case "snapshot_has_no_imported_rows":
      return `Import rows into ${snapshotName} before approving it.`;
    case "snapshot_missing_data_fingerprint":
      return `Re-import ${snapshotName} before approving it; P0 data fingerprint is missing.`;
    case "snapshot_not_approvable":
      return `Check ${snapshotName} successfully before approving it.`;
    default:
      return `Approval failed for ${snapshotName}.`;
  }
}

function getSnapshotImportErrorMessage(errorCode: string | undefined, snapshotName: string) {
  switch (errorCode) {
    case "snapshot_import_already_running":
      return `${snapshotName} is already importing.`;
    case "snapshot_archived":
      return `${snapshotName} is archived. Unarchive it before importing.`;
    case "snapshot_approved_immutable":
      return `${snapshotName} is already approved with a P0 data fingerprint. Archive or supersede it instead of re-importing.`;
    default:
      return `Import failed for ${snapshotName}.`;
  }
}

function formatSnapshotNote(note: string) {
  return note
    .replaceAll(
      "Business-rule source of truth remains understanding_doc_fixed.",
      "Business rules still come from the approved understanding document."
    )
    .replaceAll(
      "This accepted hybrid snapshot keeps source-backed rows plus DATA_AGG monthly override rows that are founder-relevant.",
      "This approved hybrid data keeps rows backed by source files, plus DATA_AGG monthly override rows used for founder review."
    )
    .replaceAll(
      "Pure params_monthly_topup rows without DATA_AGG backing are quarantined from founder-facing truth.",
      "Rows without DATA_AGG support are kept out of founder review."
    )
    .replaceAll("Normalized from bgc-source-bundle-canonical sheet.", "Prepared from the BGC source bundle sheet.")
    .replaceAll("data lineage is spreadsheet_source_bundle.", "Data comes from the spreadsheet source bundle.")
    .replaceAll(
      "Contains source-backed rows plus aggregate/model-assisted rows",
      "It includes rows backed by source files plus monthly aggregate rows"
    )
    .replaceAll("Do not label as pure canonical_json.", "Do not describe it as a full-detail JSON source.")
    .replaceAll("canonical_json", "full-detail JSON")
    .replaceAll("canonical", "full-detail")
    .replaceAll("founder-facing", "founder review")
    .replaceAll("truth", "data basis");
}

function formatCleanupDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toISOString().slice(0, 10);
}

function getDownloadFilename(response: Response, fallback: string) {
  const contentDisposition = response.headers.get("content-disposition");
  const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/i);

  return filenameMatch?.[1] ?? fallback;
}

export function SnapshotConsole({ snapshots, blobUploadsEnabled, cleanupReport, user }: SnapshotConsoleProps) {
  const router = useRouter();
  const [formState, setFormState] = useState(defaultFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [snapshotScope, setSnapshotScope] = useState<SnapshotScope>("active");
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [expandedCleanupSections, setExpandedCleanupSections] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canWrite = user.capabilities.includes("snapshots.write");
  const canValidate = user.capabilities.includes("snapshots.validate");
  const canApprove = user.capabilities.includes("snapshots.approve");
  const hasActiveImport = snapshots.some((snapshot) =>
    isActiveImportStatus(snapshot.latestImportRun?.status)
  );
  const activeSnapshotCount = snapshots.filter((snapshot) => !snapshot.archivedAt).length;
  const archivedSnapshotCount = snapshots.filter((snapshot) => Boolean(snapshot.archivedAt)).length;
  const visibleSnapshots = snapshots.filter((snapshot) => {
    switch (snapshotScope) {
      case "archived":
        return Boolean(snapshot.archivedAt);
      case "all":
        return true;
      default:
        return !snapshot.archivedAt;
    }
  });
  const cleanupSections = cleanupReport
    ? [
        {
          key: "raw-files",
          title: "Raw File Cleanup Candidates",
          count: cleanupReport.totals.rawFileCleanupCandidates,
          summary: "Archived snapshots with no scenario or run dependency.",
          rows: cleanupReport.rawFileCleanupCandidates.map((candidate) => (
            <li key={candidate.id}>
              <strong>{candidate.name}</strong> · archived {formatCleanupDate(candidate.archivedAt)} · {candidate.scenarioRefs} scenario links · {candidate.runRefs} run links
            </li>
          )),
        },
        {
          key: "failed-imports",
          title: "Failed Import Logs",
          count: cleanupReport.totals.failedImportCandidates,
          summary: "Old failed import logs that can be removed without changing approved data.",
          rows: cleanupReport.failedImportCandidates.map((candidate) => (
            <li key={candidate.id}>
              <strong>{candidate.snapshotName}</strong> · failed run logged {formatCleanupDate(candidate.completedAt)}
            </li>
          )),
        },
        {
          key: "duplicates",
          title: "Duplicate Source Snapshot Candidates",
          count: cleanupReport.totals.supersedeCandidates,
          summary: "Later superseded snapshots that still duplicate the same source key.",
          rows: cleanupReport.supersedeCandidates.map((candidate) => (
            <li key={candidate.id}>
              <strong>{candidate.name}</strong> · source ID {candidate.canonicalSourceSnapshotKey ?? "none"} · {candidate.scenarioRefs} scenario links · {candidate.runRefs} run links
            </li>
          )),
        },
      ]
    : [];
  const cleanupCandidateCount = cleanupSections.reduce((total, section) => total + section.count, 0);

  useEffect(() => {
    if (!hasActiveImport) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasActiveImport, router]);

  function toggleIssues(id: string) {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCleanupSection(id: string) {
    setExpandedCleanupSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleSnapshotArchive(snapshot: SnapshotRecord) {
    setMessage(null);

    const response = await fetch(`/api/snapshots/${snapshot.id}/archive`, {
      method: snapshot.archivedAt ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reason: snapshot.archivedAt ? null : "Archived from snapshot list"
      })
    });
    const payload = (await response.json().catch(() => null)) as SnapshotArchiveResponse | null;

    if (!response.ok) {
      setMessage(
        payload?.error === "snapshot_import_in_progress"
          ? `${snapshot.name} is still importing. Wait for import completion before archiving.`
          : payload?.error === "snapshot_not_found"
            ? `${snapshot.name} no longer exists.`
            : "Snapshot update failed."
      );
      return;
    }

    setMessage(
      snapshot.archivedAt
        ? `${snapshot.name} returned to the active snapshot list.`
        : `${snapshot.name} archived from the default snapshot list.`
    );
    router.refresh();
  }

  async function downloadSnapshotExport(
    snapshot: SnapshotRecord,
    exportFormat: "monthly_csv" | "full_detail_csv"
  ) {
    setMessage(null);

    const url =
      exportFormat === "full_detail_csv"
        ? `/api/snapshots/${snapshot.id}/export?format=full_detail_csv`
        : `/api/snapshots/${snapshot.id}/export`;
    const response = await fetch(url);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      const fallbackMessage =
        exportFormat === "full_detail_csv"
          ? `${snapshot.name} has no full-detail source rows yet. Use Monthly CSV, or re-import a Full Detail CSV source.`
          : `${snapshot.name} has no monthly rows to export.`;

      setMessage(payload?.message ?? fallbackMessage);
      return;
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = getDownloadFilename(
      response,
      exportFormat === "full_detail_csv" ? `${snapshot.name}-full-detail.csv` : `${snapshot.name}-monthly.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);

    setMessage(
      exportFormat === "full_detail_csv"
        ? `Full-detail CSV export started for ${snapshot.name}.`
        : `Monthly CSV export started for ${snapshot.name}.`
    );
  }

  return (
    <section>
      {/* Add Snapshot Button / Form Toggle */}
      {!showForm ? (
        <div style={{ marginBottom: "1.25rem" }}>
          <button
            className="primary-button"
            disabled={!canWrite}
            onClick={() => setShowForm(true)}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Snapshot
          </button>
        </div>
      ) : null}

      {/* Add Snapshot Form */}
      {showForm ? (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>New Snapshot</h3>
            <button className="ghost-button" onClick={() => setShowForm(false)} type="button" style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}>
              Cancel
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.82rem", marginTop: "-0.3rem", marginBottom: "0.5rem" }}>
            Enter data details, then import and check the data after creation.
          </p>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              startTransition(async () => {
                const manualFileUri = formState.fileUri.trim();
                if (!selectedFile && !manualFileUri) {
                  setMessage("Upload a CSV or JSON file, or enter a file path.");
                  return;
                }
                let resolvedFileUri = manualFileUri;
                if (selectedFile) {
                  if (!isSnapshotDataFilename(selectedFile.name)) {
                    setMessage("Only .csv or .json files are supported.");
                    return;
                  }

                  if (selectedFile.size > maxSnapshotUploadBytes) {
                    setMessage("Snapshot upload exceeds the 10 MB limit.");
                    return;
                  }

                  try {
                    if (blobUploadsEnabled) {
                      const uploadedBlob = await upload(
                        createSnapshotUploadPathname(selectedFile.name),
                        selectedFile,
                        {
                          access: "public",
                          handleUploadUrl: "/api/snapshots/upload",
                          clientPayload: JSON.stringify({
                            originalName: selectedFile.name,
                            size: selectedFile.size
                          })
                        }
                      );
                      resolvedFileUri = uploadedBlob.url;
                    } else {
                      const uploadBody = new FormData();
                      uploadBody.append("file", selectedFile);
                      const uploadResponse = await fetch("/api/snapshots/upload", {
                        method: "POST",
                        body: uploadBody
                      });
                      if (!uploadResponse.ok) {
                        const errorPayload = (await uploadResponse
                          .json()
                          .catch(() => null)) as { error?: string } | null;
                        setMessage(
                          errorPayload?.error
                            ? `Upload failed: ${errorPayload.error}`
                            : "Upload failed."
                        );
                        return;
                      }
                      const uploadPayload = (await uploadResponse.json()) as { fileUri: string };
                      resolvedFileUri = uploadPayload.fileUri;
                    }
                  } catch (error) {
                    setMessage(
                      error instanceof Error ? `Upload failed: ${error.message}` : "Upload failed."
                    );
                    return;
                  }
                }
                const response = await fetch("/api/snapshots", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: formState.name,
                    sourceSystems: formState.sourceSystems.split(",").map((s) => s.trim()).filter(Boolean),
                    sourceType: formState.sourceType,
                    validatedVia: formState.validatedVia,
                    truthNotes: formState.truthNotes || null,
                    supersededBySnapshotId: formState.supersededBySnapshotId || null,
                    dateFrom: new Date(`${formState.dateFrom}T00:00:00.000Z`).toISOString(),
                    dateTo: new Date(`${formState.dateTo}T23:59:59.999Z`).toISOString(),
                    fileUri: resolvedFileUri,
                    recordCount: formState.recordCount ? Number(formState.recordCount) : null,
                    notes: formState.notes || null
                  })
                });
                if (!response.ok) { setMessage("Could not add snapshot."); return; }
                setFormState(defaultFormState);
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                setMessage("Snapshot created.");
                setShowForm(false);
                router.refresh();
              });
            }}
          >
            <div className="inline-fields">
              <label className="field">
                <span>Name</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, name: e.target.value }))} placeholder="2025 H1 business data" required value={formState.name} />
              </label>
              <label className="field">
                <span>Source systems</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, sourceSystems: e.target.value }))} value={formState.sourceSystems} />
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                <span>File type</span>
                <select
                  disabled={!canWrite || isPending}
                  onChange={(e) =>
                    setFormState((current) => ({
                      ...current,
                      sourceType: e.target.value,
                      validatedVia:
                        e.target.value === "canonical_csv" || e.target.value === "canonical_json"
                          ? "canonical_events"
                          : current.validatedVia
                    }))
                  }
                  value={formState.sourceType}
                >
                  <option value="compatibility_csv">Monthly CSV</option>
                  <option value="canonical_csv">Full Detail CSV</option>
                  <option value="canonical_json">Full detail JSON</option>
                  <option value="canonical_bundle">Full detail bundle</option>
                  <option value="hybrid_verified">Hybrid data</option>
                </select>
              </label>
              <label className="field">
                <span>Check method</span>
                <select
                  disabled={!canWrite || isPending}
                  onChange={(e) => setFormState((c) => ({ ...c, validatedVia: e.target.value }))}
                  value={formState.validatedVia}
                >
                  <option value="monthly_facts">Monthly data</option>
                  <option value="canonical_events">Event data</option>
                  <option value="hybrid_validation">Hybrid check</option>
                </select>
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                <span>Start date</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, dateFrom: e.target.value }))} required type="date" value={formState.dateFrom} />
              </label>
              <label className="field">
                <span>End date</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, dateTo: e.target.value }))} required type="date" value={formState.dateTo} />
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                <span>Snapshot file</span>
                <input accept=".csv,.json,text/csv,application/json,text/json" disabled={!canWrite || isPending} onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} ref={fileInputRef} type="file" />
              </label>
              <label className="field">
                <span>File path (optional)</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, fileUri: e.target.value }))} placeholder="https://... or file://..." value={formState.fileUri} />
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                <span>Expected rows</span>
                <input disabled={!canWrite || isPending} min="0" onChange={(e) => setFormState((c) => ({ ...c, recordCount: e.target.value }))} step="1" type="number" value={formState.recordCount} />
              </label>
              <label className="field">
                <span>Notes</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, notes: e.target.value }))} value={formState.notes} />
              </label>
            </div>
            <label className="field">
              <span>Data notes</span>
              <input
                disabled={!canWrite || isPending}
                onChange={(e) => setFormState((c) => ({ ...c, truthNotes: e.target.value }))}
                placeholder="Optional notes about data strength or import caveats"
                value={formState.truthNotes}
              />
            </label>
            {message ? <p className="muted" style={{ fontSize: "0.82rem" }}>{message}</p> : null}
            <button className="primary-button" disabled={!canWrite || isPending} type="submit" style={{ alignSelf: "flex-start" }}>
              {isPending ? "Saving..." : "Create Snapshot"}
            </button>
          </form>
        </div>
      ) : null}

      {message && !showForm ? <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.75rem" }}>{message}</p> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button
          className="ghost-button"
          data-active={snapshotScope === "active"}
          onClick={() => setSnapshotScope("active")}
          style={{ fontSize: "0.74rem", padding: "0.3rem 0.65rem" }}
          type="button"
        >
          Active ({activeSnapshotCount})
        </button>
        <button
          className="ghost-button"
          data-active={snapshotScope === "archived"}
          onClick={() => setSnapshotScope("archived")}
          style={{ fontSize: "0.74rem", padding: "0.3rem 0.65rem" }}
          type="button"
        >
          Archived ({archivedSnapshotCount})
        </button>
        <button
          className="ghost-button"
          data-active={snapshotScope === "all"}
          onClick={() => setSnapshotScope("all")}
          style={{ fontSize: "0.74rem", padding: "0.3rem 0.65rem" }}
          type="button"
        >
          All ({snapshots.length})
        </button>
      </div>

      {visibleSnapshots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3>No snapshots in this view</h3>
          <p>Add a snapshot or switch the filter.</p>
        </div>
      ) : (
        <div className="snapshot-card-list">
          {visibleSnapshots.map((snapshot) => {
            const steps = getProgressSteps(snapshot);
            const hasIssues = (snapshot.latestImportRun?.issues.length ?? 0) > 0 || snapshot.validationIssues.length > 0;
            const issuesExpanded = expandedIssues.has(snapshot.id);

            return (
              <div className="snapshot-card" key={snapshot.id}>
                <div className="snapshot-card-header">
                  <h4 className="snapshot-card-title">{snapshot.name}</h4>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span className={`badge ${getStatusBadgeClass(snapshot.validationStatus)}`}>
                      {getDataSetStatusLabel(snapshot.validationStatus)}
                    </span>
                    <span className={`badge ${snapshot.dataFingerprint ? "badge--info" : "badge--rejected"}`}>
                      {snapshot.dataFingerprint ? "Data Check OK" : "Data Check Missing"}
                    </span>
                    {snapshot.archivedAt ? <span className="badge badge--neutral">Archived</span> : null}
                  </div>
                </div>

                <div className="snapshot-card-meta">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    {snapshot.dateFrom.slice(0, 10)} → {snapshot.dateTo.slice(0, 10)}
                  </span>
                  <span>{snapshot.sourceSystems.join(", ")}</span>
                  <span>{snapshot.importedFactCount.toLocaleString()} simulation rows</span>
                  <span>{snapshot.scenarioRefCount} scenario links · {snapshot.runRefCount} run links</span>
                </div>

                {snapshot.manifest ? (
                  <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.6rem" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      <span className="badge badge--neutral">
                        {getSnapshotSourceTypeLabel(snapshot.manifest.sourceType)}
                      </span>
                      <span className="badge badge--neutral">
                        {getSnapshotValidationBasisLabel(snapshot.manifest.validatedVia)}
                      </span>
                      <span
                        className={`badge ${
                          snapshot.manifest.truthLevel === "strong"
                            ? "badge--candidate"
                            : snapshot.manifest.truthLevel === "partial"
                              ? "badge--risky"
                              : "badge--rejected"
                        }`}
                      >
                        Data Quality: {getHistoricalTruthCoverageLabel(snapshot.manifest.truthLevel)}
                      </span>
                      <span
                        className={`badge ${
                          snapshot.manifest.founderReadiness === "founder_safe"
                            ? "badge--candidate"
                            : "badge--risky"
                        }`}
                      >
                        {getSnapshotFounderReadinessLabel(snapshot.manifest.founderReadiness)}
                      </span>
                      {snapshot.canonicalGapAudit ? (
                        <span
                          className={`badge ${
                            snapshot.canonicalGapAudit.readiness === "strong"
                              ? "badge--candidate"
                              : snapshot.canonicalGapAudit.readiness === "partial"
                                ? "badge--risky"
                                : "badge--rejected"
                          }`}
                        >
                          Source Detail: {getCanonicalGapStatusLabel(snapshot.canonicalGapAudit.readiness)}
                        </span>
                      ) : null}
                    </div>
                    <p className="muted" style={{ fontSize: "0.75rem", margin: 0 }}>
                      {snapshot.manifest.summary}
                    </p>
                    {snapshot.truthNotes ? (
                      <p className="muted" style={{ fontSize: "0.75rem", margin: 0 }}>
                        Data notes: {formatSnapshotNote(snapshot.truthNotes)}
                      </p>
                    ) : null}
                    {snapshot.supersededBySnapshot ? (
                      <p className="muted" style={{ fontSize: "0.75rem", margin: 0 }}>
                        Supersedes: {snapshot.supersededBySnapshot.name}
                      </p>
                    ) : null}
                    {snapshot.canonicalGapAudit ? (
                      <div className="table-wrap" style={{ marginTop: "0.2rem" }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Source Detail</th>
                              <th>Status</th>
                              <th>Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.canonicalGapAudit.rows.map((row) => (
                              <tr key={`${snapshot.id}-${row.key}`}>
                                <td><strong>{row.label}</strong></td>
                                <td>
                                  <span
                                    className={`badge ${
                                      row.status === "covered"
                                        ? "badge--candidate"
                                        : row.status === "partial"
                                          ? "badge--risky"
                                          : "badge--rejected"
                                    }`}
                                  >
                                    {getCanonicalGapStatusLabel(row.status)}
                                  </span>
                                </td>
                                <td>{row.detail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Progress Stepper */}
                <div className="snapshot-progress" style={{ "--step-count": steps.length } as React.CSSProperties}>
                  {steps.map((step, i) => (
                    <div
                      className="snapshot-progress-step"
                      key={step.label}
                      data-line-done={i > 0 && steps[i - 1].done}
                    >
                      <div
                        className="snapshot-progress-dot"
                        data-done={step.done}
                        data-active={step.active}
                        title={step.label}
                      >
                        {step.done ? "✓" : step.active ? "·" : (i + 1)}
                      </div>
                      <span className="snapshot-progress-label">{step.label}</span>
                    </div>
                  ))}
                </div>

                {/* Import Info */}
                {snapshot.latestImportRun ? (
                  <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
                    Import: <span className={`badge ${snapshot.latestImportRun.status === "COMPLETED" ? "badge--candidate" : snapshot.latestImportRun.status === "FAILED" ? "badge--rejected" : "badge--info"}`} style={{ fontSize: "0.65rem" }}>{getImportStatusLabel(snapshot.latestImportRun.status)}</span>
                    {" "}{formatImportRowSummary(snapshot)}
                  </p>
                ) : null}

                {/* Expandable Issues */}
                {hasIssues ? (
                  <div style={{ marginTop: "0.35rem" }}>
                    <button
                      className="ghost-button"
                      onClick={() => toggleIssues(snapshot.id)}
                      type="button"
                      style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                    >
                      {issuesExpanded ? "Hide" : "Show"} {(snapshot.latestImportRun?.issues.length ?? 0) + snapshot.validationIssues.length} issue(s)
                    </button>
                    {issuesExpanded ? (
                      <div style={{ marginTop: "0.35rem" }}>
                        {(snapshot.latestImportRun?.issues ?? []).map((issue) => (
                          <div className="flag-item" data-severity={issue.severity === "ERROR" ? "critical" : "warning"} key={issue.id} style={{ marginBottom: "0.25rem", fontSize: "0.78rem" }}>
                            <span className="flag-label">{getRiskSeverityLabel(issue.severity)}</span>: {issue.message}
                            {issue.rowRef ? ` (${issue.rowRef})` : ""}
                          </div>
                        ))}
                        {snapshot.validationIssues.map((issue) => (
                          <div className="flag-item" data-severity={issue.severity === "ERROR" ? "critical" : "warning"} key={issue.id} style={{ marginBottom: "0.25rem", fontSize: "0.78rem" }}>
                            <span className="flag-label">{getRiskSeverityLabel(issue.severity)}</span>: {issue.message}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Workflow Actions */}
                <div className="snapshot-card-actions">
                  <button
                    className="ghost-button"
                    disabled={!canWrite || isPending || isActiveImportStatus(snapshot.latestImportRun?.status) || Boolean(snapshot.archivedAt)}
                    onClick={() => {
                      startTransition(async () => {
                        const response = await fetch(`/api/snapshots/${snapshot.id}/import`, { method: "POST" });
                        const payload = (await response.json().catch(() => null)) as ImportResponse | null;
                        if (!response.ok) {
                          setMessage(getSnapshotImportErrorMessage(payload?.error, snapshot.name));
                          router.refresh();
                          return;
                        }

                        setMessage(
                          payload?.importRun?.status === "COMPLETED"
                            ? `Imported ${snapshot.name}.`
                            : `Import queued for ${snapshot.name}.`
                        );
                        router.refresh();
                      });
                    }}
                    type="button"
                  >
                    Import
                  </button>
                  <button
                    className="ghost-button"
                    disabled={
                      !canValidate ||
                      isPending ||
                      Boolean(snapshot.archivedAt) ||
                      snapshot.importedFactCount === 0 ||
                      isActiveImportStatus(snapshot.latestImportRun?.status)
                    }
                    onClick={() => {
                      startTransition(async () => {
                        const response = await fetch(`/api/snapshots/${snapshot.id}/validate`, { method: "POST" });
                        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                        setMessage(
                          response.ok
                            ? `Checked ${snapshot.name}.`
                            : getSnapshotValidationErrorMessage(payload?.error, snapshot.name)
                        );
                        router.refresh();
                      });
                    }}
                    type="button"
                  >
                    Check Data
                  </button>
                  <button
                    className="ghost-button"
                    disabled={
                      !canApprove ||
                      isPending ||
                      Boolean(snapshot.archivedAt) ||
                      snapshot.importedFactCount === 0 ||
                      isActiveImportStatus(snapshot.latestImportRun?.status) ||
                      !["VALID", "APPROVED"].includes(snapshot.validationStatus)
                    }
                    onClick={() => {
                      startTransition(async () => {
                        const response = await fetch(`/api/snapshots/${snapshot.id}/approve`, { method: "POST" });
                        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                        setMessage(
                          response.ok
                            ? `${snapshot.name} approved.`
                            : getSnapshotApprovalErrorMessage(payload?.error, snapshot.name)
                        );
                        router.refresh();
                      });
                    }}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="ghost-button"
                    disabled={!canWrite || isPending || isActiveImportStatus(snapshot.latestImportRun?.status)}
                    onClick={() => {
                      startTransition(async () => {
                        await toggleSnapshotArchive(snapshot);
                      });
                    }}
                    type="button"
                  >
                    {snapshot.archivedAt ? "Unarchive" : "Archive"}
                  </button>
                </div>

                {/* Export Action */}
                {snapshot.importedFactCount > 0 ? (
                  <div className="snapshot-card-export">
                    <button
                      className="ghost-button snapshot-export-btn"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await downloadSnapshotExport(snapshot, "monthly_csv");
                        });
                      }}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export Monthly CSV
                    </button>
                    <button
                      className="ghost-button snapshot-export-btn"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await downloadSnapshotExport(snapshot, "full_detail_csv");
                        });
                      }}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export Full Detail CSV
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {cleanupReport ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div className="snapshot-cleanup-header">
              <div>
                <h3 style={{ marginBottom: "0.2rem" }}>Storage Cleanup Policy</h3>
                <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                  Archive keeps the list clean. Cleanup is maintenance; it does not change approved business data.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                <span className="badge badge--neutral">{cleanupReport.totals.archivedSnapshots} archived</span>
                <span className="badge badge--neutral">{cleanupReport.totals.lockedSnapshots} locked</span>
                <span className="badge badge--neutral">{cleanupCandidateCount} candidates</span>
              </div>
            </div>

            <div className="snapshot-cleanup-grid">
              <div className="card" style={{ background: "var(--surface-subtle)", padding: "0.85rem" }}>
                <p className="metric" style={{ fontSize: "1.4rem" }}>{cleanupReport.totals.rawFileCleanupCandidates}</p>
                <p className="metric-sub">raw file cleanup candidates</p>
              </div>
              <div className="card" style={{ background: "var(--surface-subtle)", padding: "0.85rem" }}>
                <p className="metric" style={{ fontSize: "1.4rem" }}>{cleanupReport.totals.failedImportCandidates}</p>
                <p className="metric-sub">failed import logs older than 30 days</p>
              </div>
              <div className="card" style={{ background: "var(--surface-subtle)", padding: "0.85rem" }}>
                <p className="metric" style={{ fontSize: "1.4rem" }}>{cleanupReport.totals.supersedeCandidates}</p>
                <p className="metric-sub">duplicate source snapshot candidates</p>
              </div>
            </div>

            {cleanupCandidateCount > 0 ? (
              <div style={{ display: "grid", gap: "0.65rem" }}>
                {cleanupSections
                  .filter((section) => section.count > 0)
                  .map((section) => {
                    const isOpen = expandedCleanupSections.has(section.key);
                    return (
                      <div className="accordion-section" data-open={isOpen} key={section.key}>
                        <button
                          className="accordion-header"
                          onClick={() => toggleCleanupSection(section.key)}
                          type="button"
                        >
                          <span>{section.title}</span>
                          <span className="accordion-summary">
                            {section.count} candidate{section.count === 1 ? "" : "s"} · {section.summary}
                          </span>
                          <svg className="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {isOpen ? (
                          <div className="accordion-body">
                            <ul className="issue-list">
                              {section.rows}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
                No cleanup candidates are currently suggested. The archive layer is present, but there is no immediate storage-reduction action to review.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
