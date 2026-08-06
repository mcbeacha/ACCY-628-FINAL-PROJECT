/**
 * Demo calendar events created from Quick Actions (browser localStorage).
 * Merged with static mock events so scheduled items show on /calendar and badges.
 */
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar";
import type { UserRole } from "@/lib/types";

export const USER_CALENDAR_STORAGE_KEY = "rebel-law-user-calendar-events-v1";

export type UserCalendarEventInput = {
  title: string;
  date: string;
  matterRef?: string;
  type?: CalendarEventType;
  startTime?: string;
  endTime?: string;
  location?: string;
  roles?: UserRole[];
};

function safeParse(raw: string | null): CalendarEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CalendarEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.id === "string" && typeof e.date === "string");
  } catch {
    return [];
  }
}

export function readUserCalendarEvents(): CalendarEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(USER_CALENDAR_STORAGE_KEY));
}

export function addUserCalendarEvent(input: UserCalendarEventInput): CalendarEvent {
  const event: CalendarEvent = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    type: input.type || "Internal Meeting",
    date: input.date,
    startTime: input.startTime || "9:00 AM",
    endTime: input.endTime || "10:00 AM",
    location: input.location || "Office",
    matterRef: input.matterRef?.trim() || "—",
    roles: input.roles || [
      "managing_partner",
      "attorney",
      "paralegal",
      "billing_staff",
      "client",
    ],
  };
  const next = [...readUserCalendarEvents(), event];
  localStorage.setItem(USER_CALENDAR_STORAGE_KEY, JSON.stringify(next));
  return event;
}

export function mergeCalendarEvents(
  base: CalendarEvent[],
  userEvents: CalendarEvent[],
  role?: UserRole
): CalendarEvent[] {
  const extra = role
    ? userEvents.filter((e) => e.roles.includes(role))
    : userEvents;
  return [...base, ...extra].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );
}
