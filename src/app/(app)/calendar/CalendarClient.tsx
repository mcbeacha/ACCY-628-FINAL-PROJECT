"use client";

import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import {
  CALENDAR_EVENTS,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/workspace-mock";
import {
  AlarmClock,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Gavel,
  GraduationCap,
  MessageSquare,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

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
};

const EVENT_TYPES = Object.keys(EVENT_META) as CalendarEventType[];
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

/** Six full weeks starting on the Sunday before the first of the month. */
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

export function CalendarClient({
  events = CALENDAR_EVENTS,
}: {
  events?: CalendarEvent[];
}) {
  const [view, setView] = useState<ViewMode>("Month");
  const [offset, setOffset] = useState(0);
  const [hidden, setHidden] = useState<CalendarEventType[]>([]);

  const today = startOfToday();
  const todayIso = isoOf(today);

  const anchor = useMemo(() => {
    const base = startOfToday();
    if (view === "Month") return new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const shifted = new Date(base);
    shifted.setDate(shifted.getDate() + offset * 7);
    return shifted;
  }, [view, offset]);

  const visibleEvents = useMemo(
    () => events.filter((e) => !hidden.includes(e.type)),
    [events, hidden]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [visibleEvents]);

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

            <div className="flex items-center gap-2">
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
            </div>
          </div>

          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Filter event types</legend>
            {EVENT_TYPES.map((type) => {
              const { Icon, dot } = EVENT_META[type];
              const active = !hidden.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleType(type)}
                  className={`btn btn-xs gap-1.5 normal-case ${active ? "btn-outline" : "btn-ghost opacity-50"}`}
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
        <MonthView grid={monthGrid(anchor)} anchor={anchor} byDate={byDate} todayIso={todayIso} />
      )}
      {view === "Week" && <WeekView grid={weekGrid(anchor)} byDate={byDate} todayIso={todayIso} />}
      {view === "Agenda" && <AgendaView events={visibleEvents} todayIso={todayIso} />}
    </div>
  );
}

function EventChip({ event }: { event: CalendarEvent }) {
  const { Icon, dot } = EVENT_META[event.type];
  return (
    <div
      className="flex items-start gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-base-200"
      title={`${event.title} · ${event.startTime} · ${event.location}`}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{event.title}</span>
        <span className="flex items-center gap-1 opacity-60">
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {event.startTime}
        </span>
      </span>
    </div>
  );
}

function MonthView({
  grid,
  anchor,
  byDate,
  todayIso,
}: {
  grid: Date[];
  anchor: Date;
  byDate: Map<string, CalendarEvent[]>;
  todayIso: string;
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
                  iso === todayIso ? "font-bold text-primary" : outside ? "opacity-40" : "opacity-70"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 3).map((event) => (
                  <EventChip key={event.id} event={event} />
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
}: {
  grid: Date[];
  byDate: Map<string, CalendarEvent[]>;
  todayIso: string;
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
                      <EventChip event={event} />
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

function AgendaView({ events, todayIso }: { events: CalendarEvent[]; todayIso: string }) {
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  if (upcoming.length === 0) {
    return (
      <EmptyState
        title="Nothing scheduled"
        description="No upcoming events match the selected event types."
      />
    );
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
                    <li key={event.id} className="flex flex-wrap items-start gap-3 py-3">
                      <span className="w-24 shrink-0 text-sm opacity-70">{event.startTime}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{event.title}</span>
                        <span className="block text-xs opacity-60">
                          {event.location} · {event.matterRef}
                        </span>
                      </span>
                      <span className={`badge ${badge} badge-sm gap-1`}>
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {event.type}
                      </span>
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
