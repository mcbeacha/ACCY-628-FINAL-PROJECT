"use client";

import { EmptyState } from "@/components/EmptyState";
import { DeadlineCard } from "@/components/workspace/DeadlineCard";
import {
  eventsForRole,
  isDeadlineLikeEvent,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  mergeCalendarEvents,
  readUserCalendarEvents,
} from "@/lib/calendar-user-events";
import type { UserRole } from "@/lib/types";
import type { Priority, WorkspaceDeadline } from "@/lib/workspace-mock";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

function priorityForEvent(type: CalendarEvent["type"]): Priority {
  if (
    type === "Hearing" ||
    type === "Filing Deadline" ||
    type === "Statute Deadline" ||
    type === "Billing Cutoff"
  ) {
    return "Critical";
  }
  if (
    type === "Deposition" ||
    type === "Document Due" ||
    type === "Payment Due" ||
    type === "Signature Needed" ||
    type === "Retainer Alert"
  ) {
    return "High";
  }
  return "Medium";
}

function deadlineTypeForEvent(
  type: CalendarEvent["type"]
): WorkspaceDeadline["deadlineType"] {
  switch (type) {
    case "Hearing":
    case "Deposition":
      return "Hearing";
    case "Filing Deadline":
      return "Court Filing";
    case "Statute Deadline":
      return "Statute of Limitations";
    case "Document Due":
    case "Signature Needed":
      return "Client Deliverable";
    default:
      return "Internal Review";
  }
}

function toWorkspaceDeadline(event: CalendarEvent): WorkspaceDeadline {
  return {
    id: event.id,
    title: event.title,
    matterRef: event.matterRef,
    matterName: event.location,
    deadlineType: deadlineTypeForEvent(event.type),
    dueDate: event.date,
    priority: priorityForEvent(event.type),
  };
}

/** Deadline list drawn from the same calendar events as /calendar. */
export function UpcomingCalendarDeadlines({
  role,
  limit = 10,
}: {
  role: UserRole;
  limit?: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const [deadlines, setDeadlines] = useState(() =>
    eventsForRole(role)
      .filter((e) => isDeadlineLikeEvent(e) && e.date >= todayIso)
      .slice(0, limit)
      .map(toWorkspaceDeadline)
  );

  useEffect(() => {
    const merged = mergeCalendarEvents(
      eventsForRole(role),
      readUserCalendarEvents(),
      role
    );
    setDeadlines(
      merged
        .filter((e) => isDeadlineLikeEvent(e) && e.date >= todayIso)
        .slice(0, limit)
        .map(toWorkspaceDeadline)
    );
  }, [role, todayIso, limit]);

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Upcoming deadlines
        </h2>
        {deadlines.length === 0 ? (
          <EmptyState title="No upcoming deadlines on your calendar" />
        ) : (
          <ul className="space-y-2 mt-2">
            {deadlines.map((deadline) => (
              <DeadlineCard key={deadline.id} deadline={deadline} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
