"use client";

import { StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { Star } from "lucide-react";
import Link from "next/link";

/**
 * View model for a matter card. Built from Supabase rows on the server so the
 * card never has to know about the database shape.
 */
export type MatterCardData = {
  id: string;
  matterNumber: string;
  matterName: string;
  clientName: string;
  practiceArea: string;
  status: string;
  responsibleAttorney: string;
  nextDeadline: string | null;
  lastActivity: string | null;
  /** Completion percentage for the progress indicator. */
  stage: number;
};

export function MatterCard({
  matter,
  pinned,
  onTogglePin,
}: {
  matter: MatterCardData;
  pinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm transition-shadow hover:shadow-md">
      <div className="card-body p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/matters/${matter.id}`} className="link link-hover font-medium">
              {matter.matterNumber}
            </Link>
            <p className="text-sm opacity-80 leading-snug">{matter.matterName}</p>
          </div>
          <button
            type="button"
            className={`btn btn-ghost btn-xs btn-square ${pinned ? "text-warning" : "opacity-50"}`}
            onClick={() => onTogglePin(matter.id)}
            aria-pressed={pinned}
            aria-label={pinned ? `Unpin ${matter.matterNumber}` : `Pin ${matter.matterNumber}`}
            title={pinned ? "Unpin matter" : "Pin matter"}
          >
            <Star className={`h-4 w-4 ${pinned ? "fill-current" : ""}`} />
          </button>
        </div>

        <p className="text-xs opacity-70 truncate">{matter.clientName}</p>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={matter.status} />
          <span className="badge badge-ghost badge-sm">{matter.practiceArea}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1">
          <div className="col-span-2">
            <dt className="inline opacity-60">Responsible: </dt>
            <dd className="inline">{matter.responsibleAttorney}</dd>
          </div>
          <div>
            <dt className="opacity-60">Next deadline</dt>
            <dd>{matter.nextDeadline ? formatDate(matter.nextDeadline) : "None scheduled"}</dd>
          </div>
          <div>
            <dt className="opacity-60">Last activity</dt>
            <dd>{matter.lastActivity ? formatDate(matter.lastActivity) : "—"}</dd>
          </div>
        </dl>

        <div className="mt-2">
          <div className="flex items-center justify-between text-xs opacity-60 mb-1">
            <span>Progress</span>
            <span>{matter.stage}%</span>
          </div>
          <progress
            className="progress progress-primary w-full"
            value={matter.stage}
            max={100}
            aria-label={`${matter.matterNumber} progress`}
          />
        </div>
      </div>
    </div>
  );
}
