"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getDecisionGovernanceStatusLabel } from "@/lib/common-language";

type DecisionLogGovernanceControlProps = {
  runId: string;
  decisionKey: string;
  initialStatus: "draft" | "proposed" | "accepted" | "rejected" | "deferred" | null;
  initialOwner: string;
  initialResolutionNote: string | null;
  canWrite: boolean;
};

type RecommendedBaselineControlsProps = {
  scenarioId: string;
  runId: string;
  isAdoptedBaseline: boolean;
  canWrite: boolean;
};

const governanceStatuses = [
  "draft",
  "proposed",
  "accepted",
  "rejected",
  "deferred"
] as const;

export function DecisionLogGovernanceControl({
  runId,
  decisionKey,
  initialStatus,
  initialOwner,
  initialResolutionNote,
  canWrite
}: DecisionLogGovernanceControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof governanceStatuses)[number]>(initialStatus ?? "draft");
  const [owner, setOwner] = useState(initialOwner);
  const [resolutionNote, setResolutionNote] = useState(initialResolutionNote ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveResolution() {
    setMessage(null);

    const response = await fetch(`/api/runs/${runId}/decision-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        decisionKey,
        status,
        owner: owner.trim() || undefined,
        resolutionNote: resolutionNote.trim() || null
      })
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(
        payload?.error === "decision_log_item_not_found"
          ? "Decision item no longer exists."
          : "Could not update decision governance state."
      );
      return;
    }

    setMessage("Saved.");
    setIsEditing(false);
    router.refresh();
  }

  if (!canWrite) {
    return message ? <small className="muted">{message}</small> : null;
  }

  return (
    <div className="decision-log-editor">
      {!isEditing ? (
        <button
          className="ghost-button decision-log-editor__toggle"
          data-active="true"
          disabled={isPending}
          onClick={() => {
            setMessage(null);
            setIsEditing(true);
          }}
          type="button"
        >
          Update
        </button>
      ) : (
        <div className="decision-log-editor__form">
          <div className="decision-log-editor__grid">
            <label className="decision-log-editor__field">
              <span>Governance State</span>
              <select
                disabled={isPending}
                onChange={(event) => setStatus(event.target.value as (typeof governanceStatuses)[number])}
                value={status}
              >
                {governanceStatuses.map((item) => (
                  <option key={item} value={item}>
                    {getDecisionGovernanceStatusLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="decision-log-editor__field">
              <span>Owner</span>
              <input
                disabled={isPending}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Owner"
                value={owner}
              />
            </label>
          </div>
          <label className="decision-log-editor__field">
            <span>Resolution Note</span>
            <input
              disabled={isPending}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Resolution note (optional)"
              value={resolutionNote}
            />
          </label>
          <div className="decision-log-editor__actions">
            <button
              className="ghost-button"
              disabled={isPending}
              onClick={() => {
                setMessage(null);
                setIsEditing(false);
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={isPending}
              onClick={() => startTransition(saveResolution)}
              type="button"
            >
              {isPending ? "Saving..." : "Save Update"}
            </button>
          </div>
        </div>
      )}
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}

export function RecommendedBaselineControls({
  scenarioId,
  runId,
  isAdoptedBaseline,
  canWrite
}: RecommendedBaselineControlsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function adoptBaseline() {
    setMessage(null);
    const response = await fetch(`/api/scenarios/${scenarioId}/adopt-baseline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        runId,
        note: note.trim() || null
      })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(
        payload?.error === "recommended_setup_not_found"
          ? "This run does not have a structured recommended setup yet."
          : "Could not adopt this run as the current pilot baseline."
      );
      return;
    }

    setMessage("Current pilot baseline updated.");
    router.refresh();
  }

  async function clearBaseline() {
    setMessage(null);
    const response = await fetch(`/api/scenarios/${scenarioId}/adopt-baseline`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(payload?.error ? "Could not clear the current pilot baseline." : "Could not clear the current pilot baseline.");
      return;
    }

    setMessage("Current pilot baseline cleared.");
    router.refresh();
  }

  return (
    <div className="decision-baseline-control">
      {!isAdoptedBaseline ? (
        <input
          className="decision-baseline-control__input"
          disabled={!canWrite || isPending}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Adoption note (optional)"
          value={note}
        />
      ) : null}
      <div className="decision-baseline-control__actions">
        {isAdoptedBaseline ? (
          <button
            className="ghost-button"
            disabled={!canWrite || isPending}
            onClick={() => startTransition(clearBaseline)}
            type="button"
          >
            {isPending ? "Clearing..." : "Clear Baseline"}
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={!canWrite || isPending}
            onClick={() => startTransition(adoptBaseline)}
            type="button"
          >
            {isPending ? "Adopting..." : "Adopt as Current Pilot Baseline"}
          </button>
        )}
      </div>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}
