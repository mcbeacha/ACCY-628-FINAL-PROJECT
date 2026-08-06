import type { CalendarEvent } from "@/lib/calendar";

/** Parse display times like "2:00 PM" into 24h components. */
export function parseDisplayTime(time: string): { hours: number; minutes: number } {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 9, minutes: 0 };
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local wall-clock → ICS floating datetime (YYYYMMDDTHHMMSS). */
export function toIcsLocalDateTime(dateIso: string, time: string): string {
  const { hours, minutes } = parseDisplayTime(time);
  const [y, m, d] = dateIso.split("-");
  return `${y}${m}${d}T${pad(hours)}${pad(minutes)}00`;
}

/** Google Calendar template dates param (start/end). */
export function toGoogleDates(event: CalendarEvent): string {
  return `${toIcsLocalDateTime(event.date, event.startTime)}/${toIcsLocalDateTime(event.date, event.endTime)}`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function eventDescription(event: CalendarEvent): string {
  const lines = [
    event.title,
    `Type: ${event.type}`,
    event.matterRef && event.matterRef !== "—" ? `Matter: ${event.matterRef}` : null,
    event.teamsLink ? `Teams: ${event.teamsLink}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: toGoogleDates(event),
    details: eventDescription(event),
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook / Microsoft 365 / Teams calendar compose deeplink. */
export function buildTeamsOutlookCalendarUrl(event: CalendarEvent): string {
  const start = parseDisplayTime(event.startTime);
  const end = parseDisplayTime(event.endTime);
  const startdt = `${event.date}T${pad(start.hours)}:${pad(start.minutes)}:00`;
  const enddt = `${event.date}T${pad(end.hours)}:${pad(end.minutes)}:00`;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: eventDescription(event),
    location: event.location,
    startdt,
    enddt,
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function buildIcsEvent(event: CalendarEvent): string {
  const uid = `${event.id}@rebellaw.demo`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsLocalDateTime(event.date, event.startTime)}`,
    `DTEND:${toIcsLocalDateTime(event.date, event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(eventDescription(event))}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    "END:VEVENT",
  ];
  return lines.join("\r\n");
}

export function buildIcsCalendar(events: CalendarEvent[], calName = "Rebel Law Group"): string {
  const body = events.map(buildIcsEvent).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rebel Law Group//Demo Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    body,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcsFile(filename: string, icsBody: string) {
  const blob = new Blob([icsBody], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildMeetingReminderMailto(
  event: CalendarEvent,
  opts: { includeTeamsLink: boolean; to?: string[] }
): string {
  const to = (opts.to?.length ? opts.to : event.reminderEmails) ?? [];
  const when = `${event.date} · ${event.startTime}–${event.endTime}`;
  const lines = [
    `Reminder: ${event.title}`,
    "",
    `When: ${when}`,
    `Where: ${event.location}`,
    event.matterRef && event.matterRef !== "—" ? `Matter: ${event.matterRef}` : null,
    "",
  ].filter((line) => line !== null) as string[];

  if (opts.includeTeamsLink && event.teamsLink) {
    lines.push("Join Microsoft Teams meeting:", event.teamsLink, "");
  }

  lines.push("— Rebel Law Group (demo reminder)");

  const params = new URLSearchParams({
    subject: `Reminder: ${event.title} — ${when}`,
    body: lines.join("\n"),
  });
  const recipients = to.join(",");
  return `mailto:${recipients}?${params.toString()}`;
}
