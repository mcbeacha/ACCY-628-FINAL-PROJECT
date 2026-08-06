"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import {
  documentRequestTone,
  isOpenDocumentRequest,
  nowIso,
  type DocumentRequest,
  upsertDocumentRequest,
} from "@/lib/document-requests";
import { useDocumentRequests } from "@/hooks/useDocumentRequests";
import type { Profile } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";

type Props = {
  profile: Profile;
  /** When true, only show this paralegal's queue. */
  mineOnly?: boolean;
};

export function ParalegalDocumentQueue({ profile, mineOnly = true }: Props) {
  const { requests, ready } = useDocumentRequests();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [clientInstructions, setClientInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mine = useMemo(() => {
    const list = mineOnly
      ? requests.filter((r) => r.paralegalId === profile.id)
      : requests;
    return list
      .filter((r) => isOpenDocumentRequest(r.status) || r.status === "closed")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [requests, profile.id, mineOnly]);

  const actionable = mine.filter((r) =>
    ["pending_paralegal", "paralegal_preparing", "client_submitted"].includes(r.status)
  );

  function openEdit(req: DocumentRequest) {
    setActiveId(req.id);
    setDueDate(req.clientDueDate || "");
    setClientInstructions(req.clientInstructions || req.attorneyInstructions);
    setNotes(req.paralegalNotes || "");
    setError(null);
    setMessage(null);
  }

  function savePreparing(req: DocumentRequest) {
    setError(null);
    upsertDocumentRequest({
      ...req,
      status: "paralegal_preparing",
      clientInstructions: clientInstructions.trim() || req.attorneyInstructions,
      paralegalNotes: notes.trim(),
      clientDueDate: dueDate || null,
      updatedAt: nowIso(),
    });
    setMessage("Draft saved. Continue when ready to send to the client.");
  }

  function sendToClient(req: DocumentRequest) {
    setError(null);
    if (!dueDate) {
      setError("Set the date the client needs to submit by before sending.");
      return;
    }
    if (!clientInstructions.trim()) {
      setError("Add clear client-facing instructions before sending.");
      return;
    }
    upsertDocumentRequest({
      ...req,
      status: "awaiting_client",
      clientInstructions: clientInstructions.trim(),
      paralegalNotes: notes.trim(),
      clientDueDate: dueDate,
      sentToClientAt: nowIso(),
      updatedAt: nowIso(),
    });
    setMessage("Request sent to the client portal.");
    setActiveId(null);
  }

  function markReady(req: DocumentRequest) {
    upsertDocumentRequest({
      ...req,
      status: "ready_for_attorney",
      paralegalNotes: notes.trim() || req.paralegalNotes,
      updatedAt: nowIso(),
    });
    setMessage("Marked ready for the attorney.");
    setActiveId(null);
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <span className="loading loading-spinner loading-sm" /> Loading document requests…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Document requests</h2>
        </div>
        <Link href="/document-requests" className="btn btn-sm btn-outline">
          View all
        </Link>
      </div>

      {message && (
        <div className="alert alert-success text-sm">
          <span>{message}</span>
        </div>
      )}

      {actionable.length === 0 && mine.length === 0 ? (
        <EmptyState title="No document requests assigned to you yet." />
      ) : (
        <ul className="space-y-3">
          {mine.map((req) => {
            const tone = documentRequestTone(req);
            const isEditing = activeId === req.id;
            return (
              <li
                key={req.id}
                className={`rounded-lg border-2 p-4 ${tone.border} ${tone.bg}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {req.matterNumber} · {req.clientName}
                    </div>
                    <div className="text-sm opacity-80">{req.matterName}</div>
                    <div className="text-xs opacity-60 mt-1">
                      From {req.attorneyName} · Priority {req.priority} · Updated{" "}
                      {formatDate(req.updatedAt)}
                    </div>
                  </div>
                  <span className={`badge ${tone.badge}`}>{tone.label}</span>
                </div>

                <p className="text-sm mt-3 whitespace-pre-wrap">
                  <span className="font-medium">Attorney instructions: </span>
                  {req.attorneyInstructions}
                </p>

                {req.status === "client_submitted" && (
                  <div className="mt-3 rounded-md bg-base-100/80 border border-base-300 p-3 text-sm">
                    <div className="font-medium mb-1">Client response</div>
                    <p className="whitespace-pre-wrap opacity-90">
                      {req.clientResponseText || "(No written response — see attachments.)"}
                    </p>
                    {req.attachments.length > 0 && (
                      <ul className="mt-2 text-xs space-y-1">
                        {req.attachments.map((a) => (
                          <li key={a.fileName + a.fileSize}>
                            📎 {a.fileName} ({Math.round(a.fileSize / 1024)} KB)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!isEditing ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["pending_paralegal", "paralegal_preparing"].includes(req.status) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => openEdit(req)}
                      >
                        Prepare / process request
                      </button>
                    )}
                    {req.status === "client_submitted" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          openEdit(req);
                        }}
                      >
                        Organize for attorney
                      </button>
                    )}
                    {req.status === "awaiting_client" && (
                      <span className="text-sm opacity-70 self-center">
                        Waiting on client · due {formatDate(req.clientDueDate)}
                      </span>
                    )}
                    {req.status === "ready_for_attorney" && (
                      <span className="text-sm opacity-70 self-center">
                        Organized and ready for attorney review
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 rounded-md bg-base-100 border border-base-300 p-3">
                    <label className="form-control w-full">
                      <span className="label-text font-medium">
                        Client-facing instructions (you may refine the attorney&apos;s request)
                      </span>
                      <textarea
                        className="textarea textarea-bordered w-full min-h-24"
                        value={clientInstructions}
                        onChange={(e) => setClientInstructions(e.target.value)}
                      />
                    </label>
                    <label className="form-control w-full max-w-xs">
                      <span className="label-text font-medium">
                        Date client needs to submit by
                      </span>
                      <input
                        type="date"
                        className="input input-bordered"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                      />
                    </label>
                    <label className="form-control w-full">
                      <span className="label-text font-medium">Internal paralegal notes</span>
                      <textarea
                        className="textarea textarea-bordered w-full min-h-16"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Collection steps, follow-ups, organization notes…"
                      />
                    </label>
                    {error && (
                      <div className="alert alert-error text-sm">
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {req.status !== "client_submitted" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => savePreparing(req)}
                          >
                            Save draft
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => sendToClient(req)}
                          >
                            Send to client portal
                          </button>
                        </>
                      )}
                      {req.status === "client_submitted" && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => markReady(req)}
                        >
                          Mark ready for attorney
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setActiveId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {actionable.length > 0 && (
        <p className="text-xs opacity-60">
          {actionable.length} assignment{actionable.length === 1 ? "" : "s"} need your attention ·
          Status colors: blue = staff work, amber/red = client due timing, green = returned
        </p>
      )}
    </div>
  );
}
