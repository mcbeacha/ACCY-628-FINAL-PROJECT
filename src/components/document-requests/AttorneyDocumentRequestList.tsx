"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import {
  documentRequestTone,
  isOpenDocumentRequest,
  nowIso,
  upsertDocumentRequest,
} from "@/lib/document-requests";
import { useDocumentRequests } from "@/hooks/useDocumentRequests";
import type { Profile } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";

type Props = {
  profile: Profile;
};

/** Attorney view of requests they originated, including items ready for review. */
export function AttorneyDocumentRequestList({ profile }: Props) {
  const { requests, ready } = useDocumentRequests();

  const mine = useMemo(() => {
    return requests
      .filter((r) => r.attorneyId === profile.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [requests, profile.id]);

  const readyForMe = mine.filter((r) => r.status === "ready_for_attorney");

  function closeRequest(id: string) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    upsertDocumentRequest({
      ...req,
      status: "closed",
      updatedAt: nowIso(),
    });
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <span className="loading loading-spinner loading-sm" /> Loading…
      </div>
    );
  }

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">Your document requests</h2>
          <Link href="/document-requests" className="link text-sm">
            View all
          </Link>
        </div>
        {mine.length === 0 ? (
          <EmptyState title="You have not sent any document requests yet." />
        ) : (
          <ul className="space-y-3">
            {mine.slice(0, 8).map((req) => {
              const tone = documentRequestTone(req);
              return (
                <li
                  key={req.id}
                  className={`rounded-lg border-2 p-3 text-sm ${tone.border} ${tone.bg}`}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {req.matterNumber} · {req.clientName}
                    </span>
                    <span className={`badge ${tone.badge}`}>{tone.label}</span>
                  </div>
                  <p className="opacity-80 mt-1 line-clamp-2">{req.attorneyInstructions}</p>
                  <p className="text-xs opacity-60 mt-1">
                    Paralegal: {req.paralegalName}
                    {req.clientDueDate ? ` · Client due ${formatDate(req.clientDueDate)}` : ""}
                    {" · "}
                    Updated {formatDate(req.updatedAt)}
                  </p>
                  {req.status === "ready_for_attorney" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {req.attachments.length > 0 && (
                        <span className="text-xs">
                          {req.attachments.length} file(s) collected
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => closeRequest(req.id)}
                      >
                        Mark closed
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {readyForMe.length > 0 && (
          <p className="text-xs text-success">
            {readyForMe.length} request{readyForMe.length === 1 ? "" : "s"} organized and ready for
            you.
          </p>
        )}
        <p className="text-xs opacity-50">
          Open requests: {mine.filter((r) => isOpenDocumentRequest(r.status)).length}
        </p>
      </div>
    </div>
  );
}
