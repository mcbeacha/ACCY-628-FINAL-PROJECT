"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import {
  documentRequestTone,
  isOpenDocumentRequest,
  nowIso,
  readFileAsAttachment,
  type DocumentAttachmentMeta,
  upsertDocumentRequest,
} from "@/lib/document-requests";
import { useDocumentRequests } from "@/hooks/useDocumentRequests";
import type { Profile } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";

type Props = {
  profile: Profile;
  /** Limit to requests for these client IDs (portal user link). */
  clientIds?: string[];
};

export function ClientDocumentTasks({ profile, clientIds }: Props) {
  const { requests, ready } = useDocumentRequests();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [files, setFiles] = useState<DocumentAttachmentMeta[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mine = useMemo(() => {
    return requests
      .filter((r) => {
        if (clientIds !== undefined) {
          if (!clientIds.length) return false;
          return clientIds.includes(r.clientId);
        }
        return r.status === "awaiting_client" || r.status === "client_submitted";
      })
      .filter((r) => isOpenDocumentRequest(r.status) || r.status === "closed")
      .sort((a, b) => {
        const ad = a.clientDueDate || "9999";
        const bd = b.clientDueDate || "9999";
        return ad.localeCompare(bd);
      });
  }, [requests, clientIds]);

  const openForClient = mine.filter((r) => r.status === "awaiting_client");

  async function onFilesSelected(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    try {
      const next: DocumentAttachmentMeta[] = [];
      for (const file of Array.from(list)) {
        next.push(await readFileAsAttachment(file));
      }
      setFiles((prev) => [...prev, ...next]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read file.");
    }
  }

  function startRespond(id: string) {
    setActiveId(id);
    setResponseText("");
    setFiles([]);
    setError(null);
    setMessage(null);
  }

  function submitResponse(reqId: string) {
    const req = requests.find((r) => r.id === reqId);
    if (!req) return;
    if (!responseText.trim() && files.length === 0) {
      setError("Upload a document or enter the requested information before submitting.");
      return;
    }
    setSaving(true);
    upsertDocumentRequest({
      ...req,
      status: "client_submitted",
      clientResponseText: responseText.trim(),
      attachments: [...req.attachments, ...files],
      clientSubmittedAt: nowIso(),
      updatedAt: nowIso(),
    });
    setSaving(false);
    setActiveId(null);
    setMessage("Thank you — your response was sent to the firm.");
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <span className="loading loading-spinner loading-sm" /> Loading your document tasks…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Document requests</h2>
        <p className="text-sm opacity-70">
          Start here if anything is waiting on you. Open a teal, amber, or red card, then upload
          files or enter the information requested. Green means already submitted.
        </p>
      </div>

      {message && (
        <div className="alert alert-success text-sm">
          <span>{message}</span>
        </div>
      )}

      {mine.length === 0 ? (
        <EmptyState title="You have no document requests right now." />
      ) : (
        <ul className="space-y-3">
          {mine.map((req) => {
            const tone = documentRequestTone(req);
            const editing = activeId === req.id;
            return (
              <li
                key={req.id}
                className={`rounded-lg border-2 p-4 transition-colors ${tone.border} ${tone.bg}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{req.matterName}</div>
                    <div className="text-xs opacity-60">
                      {req.matterNumber} · From {req.paralegalName || req.attorneyName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`badge ${tone.badge}`}>{tone.label}</span>
                    {req.clientDueDate && (
                      <span className="badge badge-outline">
                        Due {formatDate(req.clientDueDate)}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm mt-3 whitespace-pre-wrap">{req.clientInstructions}</p>

                {req.status === "awaiting_client" && !editing && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mt-3"
                    onClick={() => startRespond(req.id)}
                  >
                    Complete this request
                  </button>
                )}

                {req.status === "awaiting_client" && editing && (
                  <div className="mt-4 space-y-3 rounded-md bg-base-100 border border-base-300 p-3">
                    <label className="form-control w-full">
                      <span className="label-text font-medium">
                        Enter information (if requested)
                      </span>
                      <textarea
                        className="textarea textarea-bordered w-full min-h-24"
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Type answers, explanations, or notes here…"
                      />
                    </label>
                    <label className="form-control w-full">
                      <span className="label-text font-medium">Upload documents</span>
                      <input
                        type="file"
                        className="file-input file-input-bordered w-full"
                        multiple
                        onChange={(e) => onFilesSelected(e.target.files)}
                      />
                      <span className="label-text-alt opacity-60">
                        Academic demo: small files are stored in this browser only.
                      </span>
                    </label>
                    {files.length > 0 && (
                      <ul className="text-xs space-y-1">
                        {files.map((f) => (
                          <li key={f.fileName + f.fileSize}>
                            📎 {f.fileName} ({Math.round(f.fileSize / 1024)} KB)
                            {!f.dataUrl && " · name recorded only (file too large to embed)"}
                          </li>
                        ))}
                      </ul>
                    )}
                    {error && (
                      <div className="alert alert-error text-sm">
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={saving}
                        onClick={() => submitResponse(req.id)}
                      >
                        {saving ? "Submitting…" : "Submit to firm"}
                      </button>
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

                {req.status !== "awaiting_client" && req.clientSubmittedAt && (
                  <p className="text-sm mt-2 opacity-70">
                    Submitted {formatDate(req.clientSubmittedAt)}
                    {req.attachments.length
                      ? ` · ${req.attachments.length} file(s)`
                      : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {openForClient.length > 0 && (
        <p className="text-xs opacity-60">
          Signed in as {profile.full_name} · {openForClient.length} open task
          {openForClient.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
