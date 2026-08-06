import { eventsForRole } from "@/lib/calendar";
import type { UserRole } from "@/lib/types";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

/** Compact calendar icon for dashboards — opens the full calendar page. */
export function RoleCalendarPreview({ role }: { role: UserRole }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const upcomingCount = eventsForRole(role).filter((event) => event.date >= todayIso).length;

  return (
    <Link
      href="/calendar"
      className="btn btn-outline btn-sm btn-square relative"
      aria-label={
        upcomingCount > 0
          ? `Open calendar, ${upcomingCount} upcoming`
          : "Open calendar"
      }
      title="Calendar"
    >
      <CalendarDays className="h-4 w-4" aria-hidden />
      {upcomingCount > 0 && (
        <span className="badge badge-primary badge-xs absolute -right-1.5 -top-1.5 min-w-4 px-1">
          {upcomingCount > 99 ? "99+" : upcomingCount}
        </span>
      )}
    </Link>
  );
}
