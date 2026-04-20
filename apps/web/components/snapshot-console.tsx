"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { AppSessionUser } from "@/lib/auth-session";
import {
  getDataSetStatusLabel,
  getImportStatusLabel,
  getRiskSeverityLabel
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
  dateFrom: string;
  dateTo: string;
  fileUri: string;
  recordCount: number | null;
  validationStatus: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  notes: string | null;
  importedFactCount: number;
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

type SnapshotConsoleProps = {
  snapshots: SnapshotRecord[];
  blobUploadsEnabled: boolean;
  user: AppSessionUser;
};

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

function getProgressSteps(snapshot: SnapshotRecord) {
  const created = true;
  const imported = snapshot.importedFactCount > 0 || snapshot.latestImportRun?.status === "COMPLETED";
  const importing = isActiveImportStatus(snapshot.latestImportRun?.status);
  const validated = ["VALID", "APPROVED"].includes(snapshot.validationStatus);
  const validating = snapshot.validationStatus === "VALIDATING";
  const approved = snapshot.validationStatus === "APPROVED";

  return [
    { label: "Created", done: created, active: false },
    { label: "Imported", done: imported, active: importing },
    { label: "Validated", done: validated, active: validating },
    { label: "Approved", done: approved, active: false },
  ];
}

function getSnapshotValidationErrorMessage(errorCode: string | undefined, snapshotName: string) {
  switch (errorCode) {
    case "snapshot_import_in_progress":
      return `${snapshotName} is still importing. Wait for the import to finish first.`;
    case "snapshot_has_no_imported_rows":
      return `Import rows into ${snapshotName} before validating it.`;
    default:
      return `Validation failed for ${snapshotName}.`;
  }
}

function getSnapshotApprovalErrorMessage(errorCode: string | undefined, snapshotName: string) {
  switch (errorCode) {
    case "snapshot_import_in_progress":
      return `${snapshotName} is still importing. Wait for the import to finish first.`;
    case "snapshot_has_no_imported_rows":
      return `Import rows into ${snapshotName} before approving it.`;
    case "snapshot_not_approvable":
      return `Validate ${snapshotName} successfully before approving it.`;
    default:
      return `Approval failed for ${snapshotName}.`;
  }
}

function getSnapshotImportErrorMessage(errorCode: string | undefined, snapshotName: string) {
  switch (errorCode) {
    case "snapshot_import_already_running":
      return `${snapshotName} is already importing.`;
    default:
      return `Import failed for ${snapshotName}.`;
  }
}

export function SnapshotConsole({ snapshots, blobUploadsEnabled, user }: SnapshotConsoleProps) {
  const router = useRouter();
  const [formState, setFormState] = useState(defaultFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canWrite = user.capabilities.includes("snapshots.write");
  const canValidate = user.capabilities.includes("snapshots.validate");
  const canApprove = user.capabilities.includes("snapshots.approve");
  const hasActiveImport = snapshots.some((snapshot) =>
    isActiveImportStatus(snapshot.latestImportRun?.status)
  );

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
            Enter dataset details, then import and validate after creation.
          </p>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              startTransition(async () => {
                const manualFileUri = formState.fileUri.trim();
                if (!selectedFile && !manualFileUri) {
                  setMessage("Upload a canonical JSON/CSV file or enter a file path.");
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
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, name: e.target.value }))} placeholder="2025 H1 historical import" required value={formState.name} />
              </label>
              <label className="field">
                <span>Source systems</span>
                <input disabled={!canWrite || isPending} onChange={(e) => setFormState((c) => ({ ...c, sourceSystems: e.target.value }))} value={formState.sourceSystems} />
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
            {message ? <p className="muted" style={{ fontSize: "0.82rem" }}>{message}</p> : null}
            <button className="primary-button" disabled={!canWrite || isPending} type="submit" style={{ alignSelf: "flex-start" }}>
              {isPending ? "Saving..." : "Create Snapshot"}
            </button>
          </form>
        </div>
      ) : null}

      {message && !showForm ? <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.75rem" }}>{message}</p> : null}

      {/* Snapshot Cards */}
      {snapshots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3>No snapshots yet</h3>
          <p>Click &quot;Add Snapshot&quot; to upload your first historical dataset.</p>
        </div>
      ) : (
        <div className="snapshot-card-list">
          {snapshots.map((snapshot) => {
            const steps = getProgressSteps(snapshot);
            const hasIssues = (snapshot.latestImportRun?.issues.length ?? 0) > 0 || snapshot.validationIssues.length > 0;
            const issuesExpanded = expandedIssues.has(snapshot.id);

            return (
              <div className="snapshot-card" key={snapshot.id}>
                <div className="snapshot-card-header">
                  <h4 className="snapshot-card-title">{snapshot.name}</h4>
                  <span className={`badge ${getStatusBadgeClass(snapshot.validationStatus)}`}>
                    {getDataSetStatusLabel(snapshot.validationStatus)}
                  </span>
                </div>

                <div className="snapshot-card-meta">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    {snapshot.dateFrom.slice(0, 10)} → {snapshot.dateTo.slice(0, 10)}
                  </span>
                  <span>{snapshot.sourceSystems.join(", ")}</span>
                  <span>{snapshot.importedFactCount.toLocaleString()} rows imported</span>
                </div>

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
                    {" "}({snapshot.latestImportRun.rowCountImported ?? 0}/{snapshot.latestImportRun.rowCountRaw ?? 0} rows)
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
                    disabled={!canWrite || isPending || isActiveImportStatus(snapshot.latestImportRun?.status)}
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
                      snapshot.importedFactCount === 0 ||
                      isActiveImportStatus(snapshot.latestImportRun?.status)
                    }
                    onClick={() => {
                      startTransition(async () => {
                        const response = await fetch(`/api/snapshots/${snapshot.id}/validate`, { method: "POST" });
                        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                        setMessage(
                          response.ok
                            ? `Validated ${snapshot.name}.`
                            : getSnapshotValidationErrorMessage(payload?.error, snapshot.name)
                        );
                        router.refresh();
                      });
                    }}
                    type="button"
                  >
                    Validate
                  </button>
                  <button
                    className="ghost-button"
                    disabled={
                      !canApprove ||
                      isPending ||
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
                </div>

                {/* Export Action */}
                {snapshot.importedFactCount > 0 ? (
                  <div className="snapshot-card-export">
                    <button
                      className="ghost-button snapshot-export-btn"
                      disabled={isPending}
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `/api/snapshots/${snapshot.id}/export`;
                        link.download = "";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setMessage(`Exporting data for ${snapshot.name}...`);
                      }}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export Data
                    </button>
                    <button
                      className="ghost-button snapshot-export-btn"
                      disabled={isPending}
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `/api/snapshots/${snapshot.id}/export?format=canonical`;
                        link.download = "";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setMessage(`Exporting canonical data for ${snapshot.name}...`);
                      }}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export Canonical
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
