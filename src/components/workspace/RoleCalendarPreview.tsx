import { eventsForRole } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

/** Compact upcoming agenda for role dashboards — links to the full calendar. */
export function RoleCalendarPreview({
  role,
  limit = 5,
}: {
  role: UserRole;
  limit?: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = eventsForRole(role)
    .filter((event) => event.date >= todayIso)
    .slice(0, limit);

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 opacity-70" aria-hidden />
            <h2 className="card-title text-base">Calendar</h2>
          </div>
          <Link href="/calendar" className="btn btn-outline btn-sm">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm opacity-60">Nothing upcoming.</p>
        ) : (
          <ul className="divide-y divide-base-200">
            {upcoming.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs opacity-60">
                    {formatDate(event.date)} · {event.startTime}
                    {event.matterRef !== "—" && event.matterRef !== "Firm" && event.matterRef !== "AR"
                      ? ` · ${event.matterRef}`
                      : ""}
                  </p>
                </div>
                <span className="badge badge-ghost badge-sm shrink-0">{event.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
