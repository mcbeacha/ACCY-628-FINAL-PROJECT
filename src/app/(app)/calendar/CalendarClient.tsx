"use client";

import { EmptyState } from "@/components/EmptyState";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import {
  calendarConfigForRole,
  eventsForRole,
  isMeetingEvent,
  isVirtualMeeting,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/calendar";
import {
  buildGoogleCalendarUrl,
  buildIcsCalendar,
  buildMeetingReminderMailto,
  buildTeamsOutlookCalendarUrl,
  downloadIcsFile,
} from "@/lib/calendar-export";
import { formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import {
  AlarmClock,
  Apple,
  Building2,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardSignature,
  CreditCard,
  Download,
  FileCheck2,
  FileUp,
  Flag,
  Gavel,
  GraduationCap,
  Mail,
  MessageSquare,
  Receipt,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type ViewMode = "Month" | "Week" | "Agenda";

const EVENT_META: Record<
  CalendarEventType,
  { badge: string; dot: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  Hearing: { badge: "badge-error", dot: "bg-error", Icon: Gavel },
  Deposition: { badge: "badge-warning", dot: "bg-warning", Icon: MessageSquare },
  "Client Meeting": { badge: "badge-info", dot: "bg-info", Icon: Users },
  "Filing Deadline": { badge: "badge-error", dot: "bg-error", Icon: FileUp },
  "Statute Deadline": { badge: "badge-error", dot: "bg-error", Icon: AlarmClock },
  "Internal Meeting": { badge: "badge-ghost", dot: "bg-base-content/40", Icon: Building2 },
  CLE: { badge: "badge-accent", dot: "bg-accent", Icon: GraduationCap },
  "Document Due": { badge: "badge-warning", dot: "bg-warning", Icon: FileCheck2 },
  "Payment Due": { badge: "badge-secondary", dot: "bg-secondary", Icon: CreditCard },
  "Invoice Review": { badge: "badge-primary", dot: "bg-primary", Icon: Receipt },
  "Billing Cutoff": { badge: "badge-error", dot: "bg-error", Icon: AlarmClock },
  "Retainer Alert": { badge: "badge-warning", dot: "bg-warning", Icon: Wallet },
  "Signature Needed": { badge: "badge-accent", dot: "bg-accent", Icon: ClipboardSignature },
  Milestone: { badge: "badge-info", dot: "bg-info", Icon: Flag },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoOf(date: Date): string {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local.toISOString().slice(0, 10);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function weekGrid(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export function CalendarClient({ role: fallbackRole }: { role: UserRole }) {
  const demo = useDemoRole();
  const role = (demo?.activeIdentity.role ?? fallbackRole) as UserRole;
  const config = calendarConfigForRole(role);
  const roleEvents = eventsForRole(role);
  const filterTypes = config.filterTypes;

  const [view, setView] = useState<ViewMode>("Month");
  const [offset, setOffset] = useState(0);
  const [hidden, setHidden] = useState<CalendarEventType[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const activeHidden = hidden.filter((type) => filterTypes.includes(type));

  const today = startOfToday();
  const todayIso = isoOf(today);

  const base = startOfToday();
  const anchor =
    view === "Month"
      ? new Date(base.getFullYear(), base.getMonth() + offset, 1)
      : (() => {
          const shifted = new Date(base);
          shifted.setDate(shifted.getDate() + offset * 7);
          return shifted;
        })();

  const visibleEvents = roleEvents.filter((e) => !activeHidden.includes(e.type));

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of visibleEvents) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  function toggleType(type: CalendarEventType) {
    setHidden((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  }

  const periodLabel =
    view === "Month"
      ? anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "Week"
        ? `Week of ${formatDate(isoOf(weekGrid(anchor)[0]))}`
        : "Next 60 days";

  function exportAppleCalendar() {
    downloadIcsFile(
      `rebel-calendar-${role}.ics`,
      buildIcsCalendar(visibleEvents, config.title)
    );
  }

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="tabs tabs-box">
              {(["Month", "Week", "Agenda"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  role="tab"
                  type="button"
                  aria-selected={view === mode}
                  className={`tab ${view === mode ? "tab-active" : ""}`}
                  onClick={() => {
                    setView(mode);
                    setOffset(0);
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {view !== "Agenda" && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square"
                    onClick={() => setOffset((o) => o - 1)}
                    aria-label={`Previous ${view.toLowerCase()}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOffset(0)}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square"
                    onClick={() => setOffset((o) => o + 1)}
                    aria-label={`Next ${view.toLowerCase()}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <span className="font-display text-lg font-semibold ml-1">{periodLabel}</span>
              <CalendarExportMenu
                events={visibleEvents}
                calName={config.title}
                onApple={exportAppleCalendar}
              />
            </div>
          </div>

          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Filter event types</legend>
            {filterTypes.map((type) => {
              const { Icon, dot } = EVENT_META[type];
              const active = !activeHidden.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleType(type)}
                  className={`btn btn-xs gap-1.5 normal-case ${
                    active ? "btn-outline" : "btn-ghost opacity-50"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {type}
                </button>
              );
            })}
          </fieldset>
        </div>
      </div>

      {view === "Month" && (
        <MonthView
          grid={monthGrid(anchor)}
          anchor={anchor}
          byDate={byDate}
          todayIso={todayIso}
          onSelect={setSelected}
        />
      )}
      {view === "Week" && (
        <WeekView grid={weekGrid(anchor)} byDate={byDate} todayIso={todayIso} onSelect={setSelected} />
      )}
      {view === "Agenda" && (
        <AgendaView events={visibleEvents} todayIso={todayIso} onSelect={setSelected} />
      )}

      {selected && (
        <EventDetailDialog event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CalendarExportMenu({
  events,
  calName,
  onApple,
}: {
  events: CalendarEvent[];
  calName: string;
  onApple: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function exportFirstToGoogle() {
    if (events[0]) window.open(buildGoogleCalendarUrl(events[0]), "_blank", "noopener,noreferrer");
  }

  function exportFirstToTeams() {
    if (events[0])
      window.open(buildTeamsOutlookCalendarUrl(events[0]), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="dropdown dropdown-end" ref={menuRef}>
      <button
        type="button"
        className="btn btn-outline btn-sm gap-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarPlus className="h-4 w-4" />
        Export
      </button>
      {open && (
        <ul
          role="menu"
          className="menu dropdown-content z-30 mt-2 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        >
          <li className="menu-title px-2 pt-1">
            <span>Add visible events</span>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onApple();
                setOpen(false);
              }}
            >
              <Apple className="h-4 w-4" />
              Apple Calendar (.ics)
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                downloadIcsFile(
                  `rebel-calendar.ics`,
                  buildIcsCalendar(events, calName)
                );
                setOpen(false);
              }}
            >
              <Download className="h-4 w-4" />
              Download .ics (Google / Teams import)
            </button>
          </li>
          <li className="menu-title px-2 pt-2">
            <span>Quick-add next event</span>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={!events.length}
              onClick={() => {
                exportFirstToGoogle();
                setOpen(false);
              }}
            >
              Google Calendar
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={!events.length}
              onClick={() => {
                exportFirstToTeams();
                setOpen(false);
              }}
            >
              Teams / Outlook Calendar
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function EventDetailDialog({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const titleId = useId();
  const meeting = isMeetingEvent(event);
  const virtual = isVirtualMeeting(event);
  const [includeTeams, setIncludeTeams] = useState(Boolean(event.teamsLink) && virtual);
  const { badge, Icon } = EVENT_META[event.type];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function sendReminder() {
    window.location.href = buildMeetingReminderMailto(event, {
      includeTeamsLink: includeTeams && Boolean(event.teamsLink),
    });
  }

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-box max-w-lg space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`badge ${badge} badge-sm gap-1 mb-2`}>
              <Icon className="h-3 w-3" />
              {event.type}
            </p>
            <h2 id={titleId} className="font-display text-xl font-semibold leading-snug">
              {event.title}
            </h2>
            <p className="text-sm opacity-70 mt-1">
              {formatDate(event.date)} · {event.startTime}–{event.endTime}
            </p>
            <p className="text-sm opacity-70">
              {event.location}
              {event.matterRef !== "—" ? ` · ${event.matterRef}` : ""}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {virtual && event.teamsLink && (
          <a
            href={event.teamsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm gap-2 w-full justify-start"
          >
            <Video className="h-4 w-4" />
            Join Teams meeting
          </a>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-2">
            Add to calendar
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={buildGoogleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              Google
            </a>
            <a
              href={buildTeamsOutlookCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              Teams / Outlook
            </a>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1"
              onClick={() =>
                downloadIcsFile(
                  `${event.id}.ics`,
                  buildIcsCalendar([event], event.title)
                )
              }
            >
              <Apple className="h-3.5 w-3.5" />
              Apple (.ics)
            </button>
          </div>
        </div>

        {meeting && (
          <div className="rounded-box border border-base-300 bg-base-200/40 p-3 space-y-3">
            <p className="text-sm font-medium">Email reminder</p>
            {virtual && event.teamsLink && (
              <label className="label cursor-pointer justify-start gap-3 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={includeTeams}
                  onChange={(e) => setIncludeTeams(e.target.checked)}
                />
                <span className="label-text text-sm">Include Teams join link</span>
              </label>
            )}
            <button type="button" className="btn btn-primary btn-sm gap-2" onClick={sendReminder}>
              <Mail className="h-4 w-4" />
              Send email reminder
            </button>
            {event.reminderEmails?.length ? (
              <p className="text-xs opacity-60">To: {event.reminderEmails.join(", ")}</p>
            ) : (
              <p className="text-xs opacity-60">Opens your mail app with a draft reminder.</p>
            )}
          </div>
        )}

        <div className="modal-action mt-0">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop bg-base-content/40" aria-label="Close" onClick={onClose} />
    </div>
  );
}

function EventChip({
  event,
  onSelect,
}: {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
}) {
  const { Icon, dot } = EVENT_META[event.type];
  return (
    <button
      type="button"
      className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-base-200"
      title={`${event.title} · ${event.startTime} · ${event.location}`}
      onClick={() => onSelect(event)}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{event.title}</span>
        <span className="flex items-center gap-1 opacity-60">
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {event.startTime}
          {isVirtualMeeting(event) && <Video className="h-3 w-3" aria-label="Virtual" />}
        </span>
      </span>
    </button>
  );
}

function MonthView({
  grid,
  anchor,
  byDate,
  todayIso,
  onSelect,
}: {
  grid: Date[];
  anchor: Date;
  byDate: Map<string, CalendarEvent[]>;
  todayIso: string;
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-base-300 bg-base-200/60">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase opacity-60">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day) => {
          const iso = isoOf(day);
          const events = byDate.get(iso) ?? [];
          const outside = day.getMonth() !== anchor.getMonth();
          return (
            <div
              key={iso}
              className={`min-h-24 border-b border-r border-base-200 p-1.5 ${
                outside ? "bg-base-200/40" : ""
              } ${iso === todayIso ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}
            >
              <div
                className={`mb-1 text-xs ${
                  iso === todayIso
                    ? "font-bold text-primary"
                    : outside
                      ? "opacity-40"
                      : "opacity-70"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 3).map((event) => (
                  <EventChip key={event.id} event={event} onSelect={onSelect} />
                ))}
                {events.length > 3 && (
                  <p className="px-1.5 text-xs opacity-60">+{events.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  grid,
  byDate,
  todayIso,
  onSelect,
}: {
  grid: Date[];
  byDate: Map<string, CalendarEvent[]>;
  todayIso: string;
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {grid.map((day) => {
        const iso = isoOf(day);
        const events = byDate.get(iso) ?? [];
        return (
          <div
            key={iso}
            className={`card bg-base-100 border shadow-sm ${
              iso === todayIso ? "border-primary/50" : "border-base-300"
            }`}
          >
            <div className="card-body p-3 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p className={`font-display text-xl ${iso === todayIso ? "text-primary" : ""}`}>
                {day.getDate()}
              </p>
              {events.length === 0 ? (
                <p className="text-xs opacity-50">No events</p>
              ) : (
                <ul className="space-y-1.5">
                  {events.map((event) => (
                    <li key={event.id}>
                      <EventChip event={event} onSelect={onSelect} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaView({
  events,
  todayIso,
  onSelect,
}: {
  events: CalendarEvent[];
  todayIso: string;
  onSelect: (event: CalendarEvent) => void;
}) {
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  if (upcoming.length === 0) {
    return <EmptyState title="Nothing scheduled" />;
  }

  const days = [...new Set(upcoming.map((e) => e.date))];

  return (
    <div className="space-y-4">
      {days.map((date) => (
        <div key={date} className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4">
            <h2 className="font-display text-lg font-semibold">
              {formatDate(date)}
              {date === todayIso && <span className="badge badge-primary badge-sm ml-2">Today</span>}
            </h2>
            <ul className="divide-y divide-base-200">
              {upcoming
                .filter((e) => e.date === date)
                .map((event) => {
                  const { badge, Icon } = EVENT_META[event.type];
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-start gap-3 py-3 text-left hover:bg-base-200/60 rounded"
                        onClick={() => onSelect(event)}
                      >
                        <span className="w-24 shrink-0 text-sm opacity-70">{event.startTime}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{event.title}</span>
                          <span className="block text-xs opacity-60">
                            {event.location} · {event.matterRef}
                            {isVirtualMeeting(event) ? " · Virtual" : ""}
                          </span>
                        </span>
                        <span className={`badge ${badge} badge-sm gap-1`}>
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {event.type}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
