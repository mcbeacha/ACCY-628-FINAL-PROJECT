"use client";

import {
  DeadlineCalendar,
  buildDeadlineWindowFromCalendar,
} from "@/components/DeadlineCalendar";
import { eventsForRole } from "@/lib/calendar";
import {
  mergeCalendarEvents,
  readUserCalendarEvents,
} from "@/lib/calendar-user-events";
import type { UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

/** Home-page Coming Up grid — same event source as /calendar for this role. */
export function ComingUpCalendar({
  role,
  days = 14,
  title = "Coming up",
}: {
  role: UserRole;
  days?: number;
  title?: string;
}) {
  const [events, setEvents] = useState(() => eventsForRole(role));

  useEffect(() => {
    setEvents(
      mergeCalendarEvents(eventsForRole(role), readUserCalendarEvents(), role)
    );
  }, [role]);

  const { items, today, end } = buildDeadlineWindowFromCalendar(events, days);

  return (
    <DeadlineCalendar
      items={items}
      today={today}
      end={end}
      title={title}
      emptyTitle="Nothing on your calendar in this window."
    />
  );
}
