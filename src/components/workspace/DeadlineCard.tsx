import { PriorityBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { daysUntil, type WorkspaceDeadline } from "@/lib/workspace-mock";
import { CalendarClock } from "lucide-react";
import Link from "next/link";

/** Deadlines inside this window are visually emphasized. */
const URGENT_WINDOW_DAYS = 3;

export function DeadlineCard({ deadline }: { deadline: WorkspaceDeadline }) {
  const days = daysUntil(deadline.dueDate);
  const urgent = days <= URGENT_WINDOW_DAYS;
  const remaining =
    days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `${days} days remaining`;

  return (
    <li
      className={`rounded-box border p-3 transition-colors hover:bg-base-200/60 ${
        urgent ? "border-error/50 bg-error/5" : "border-base-300 bg-base-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{deadline.title}</p>
          <p className="text-xs opacity-70 mt-1 truncate">
            {deadline.matterRef} · {deadline.matterName}
          </p>
        </div>
        <PriorityBadge priority={deadline.priority} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="badge badge-ghost badge-sm">{deadline.deadlineType}</span>
        <span className="inline-flex items-center gap-1 opacity-70">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDate(deadline.dueDate)}
        </span>
        <span className={urgent ? "font-semibold text-error" : "opacity-70"}>{remaining}</span>
        <Link href="/calendar" className="link link-hover ml-auto">
          Open
        </Link>
      </div>
    </li>
  );
}
