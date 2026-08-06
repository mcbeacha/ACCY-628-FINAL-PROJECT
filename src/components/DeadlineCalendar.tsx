import type { CalendarEvent, CalendarEventType } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export type DeadlineKind = "task" | "court" | "filing" | "meeting" | "billing";

export type DeadlineItem = {
  id: string;
  date: string;
  kind: DeadlineKind;
  /** Chip label; defaults from kind when omitted. */
  kindLabel?: string;
  title: string;
  href: string;
  matterLabel: string;
  status?: string | null;
  priority?: string | null;
  overdue?: boolean;
};

const KIND_SHORT: Record<DeadlineKind, string> = {
  task: "Task",
  court: "Court",
  filing: "Filing",
  meeting: "Meeting",
  billing: "Billing",
};

function chipLabel(item: DeadlineItem) {
  return item.kindLabel || KIND_SHORT[item.kind];
}

/** Map calendar event types onto Coming Up chip categories. */
export function deadlineKindFromCalendarType(type: CalendarEventType): DeadlineKind {
  switch (type) {
    case "Hearing":
    case "Deposition":
      return "court";
    case "Filing Deadline":
    case "Statute Deadline":
    case "Document Due":
    case "Signature Needed":
      return "filing";
    case "Client Meeting":
    case "Internal Meeting":
    case "CLE":
    case "Milestone":
      return "meeting";
    case "Payment Due":
    case "Invoice Review":
    case "Billing Cutoff":
    case "Retainer Alert":
      return "billing";
    default:
      return "task";
  }
}

/** Build a 14-day Coming Up window from the same events the Calendar page uses. */
export function buildDeadlineWindowFromCalendar(
  events: CalendarEvent[],
  days = 14
): { items: DeadlineItem[]; today: string; end: string } {
  const today = todayISO();
  const end = addDaysISO(today, days);
  const items: DeadlineItem[] = events
    .filter((e) => {
      const overdue = e.date < today;
      const inWindow = e.date >= today && e.date <= end;
      return overdue || inWindow;
    })
    .map((e) => ({
      id: e.id,
      date: e.date,
      kind: deadlineKindFromCalendarType(e.type),
      kindLabel: e.type,
      title: e.title,
      href: "/calendar",
      matterLabel: e.matterRef && e.matterRef !== "—" ? e.matterRef : e.location,
      overdue: e.date < today,
    }));

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
  });

  return { items, today, end };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDaysISO(fromISO: string, days: number) {
  const d = new Date(`${fromISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `iso` (local). */
function startOfWeekMonday(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Build a 14-day window list from tasks + matter court/filing dates. */
export function buildDeadlineWindow(input: {
  tasks: {
    id: string;
    task_title: string;
    due_date: string | null;
    task_status: string;
    priority?: string | null;
    matter_id: string;
    matters?: { id?: string; matter_number?: string; matter_name?: string } | null;
  }[];
  matters: {
    id: string;
    matter_number: string;
    matter_name: string;
    next_court_date?: string | null;
    next_filing_deadline?: string | null;
    matter_status?: string;
  }[];
  days?: number;
}): { items: DeadlineItem[]; today: string; end: string } {
  const days = input.days ?? 14;
  const today = todayISO();
  const end = addDaysISO(today, days);
  const items: DeadlineItem[] = [];

  for (const t of input.tasks) {
    if (!t.due_date) continue;
    if (["Completed", "Canceled"].includes(t.task_status)) continue;
    const overdue = t.due_date < today;
    const inWindow = t.due_date >= today && t.due_date <= end;
    if (!overdue && !inWindow) continue;
    const mid = t.matters?.id || t.matter_id;
    const mnum = t.matters?.matter_number || "—";
    const mname = t.matters?.matter_name || "";
    items.push({
      id: `task-${t.id}`,
      date: t.due_date,
      kind: looksLikeCourtOrFiling(t.task_title) ? "filing" : "task",
      title: t.task_title,
      href: `/matters/${mid}`,
      matterLabel: mname ? `${mnum} · ${mname}` : mnum,
      status: t.task_status,
      priority: t.priority,
      overdue,
    });
  }

  for (const m of input.matters) {
    if (m.matter_status && ["Closed", "Canceled"].includes(m.matter_status)) continue;
    if (m.next_court_date) {
      const overdue = m.next_court_date < today;
      const inWindow = m.next_court_date >= today && m.next_court_date <= end;
      if (overdue || inWindow) {
        items.push({
          id: `court-${m.id}-${m.next_court_date}`,
          date: m.next_court_date,
          kind: "court",
          title: "Court / hearing",
          href: `/matters/${m.id}`,
          matterLabel: `${m.matter_number} · ${m.matter_name}`,
          overdue,
        });
      }
    }
    if (m.next_filing_deadline) {
      const overdue = m.next_filing_deadline < today;
      const inWindow = m.next_filing_deadline >= today && m.next_filing_deadline <= end;
      if (overdue || inWindow) {
        items.push({
          id: `filing-${m.id}-${m.next_filing_deadline}`,
          date: m.next_filing_deadline,
          kind: "filing",
          title: "Filing deadline",
          href: `/matters/${m.id}`,
          matterLabel: `${m.matter_number} · ${m.matter_name}`,
          overdue,
        });
      }
    }
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
  });

  return { items, today, end };
}

function looksLikeCourtOrFiling(title: string) {
  return /\b(court|hearing|filing|file |motion|plead|serve|answer|complaint|deposition|trial)\b/i.test(
    title
  );
}

function eventChipClass(kind: DeadlineKind, overdue?: boolean) {
  if (overdue) return "bg-error/15 text-error border-error/30";
  if (kind === "court") return "bg-error/15 text-error border-error/25";
  if (kind === "filing") return "bg-warning/20 text-warning-content border-warning/40";
  if (kind === "meeting") return "bg-info/15 text-info border-info/30";
  if (kind === "billing") return "bg-secondary/15 text-secondary border-secondary/30";
  return "bg-base-200 text-base-content/80 border-base-300";
}

export function DeadlineCalendar({
  items,
  today,
  end,
  title = "Next 14 days",
}: {
  items: DeadlineItem[];
  today: string;
  end: string;
  title?: string;
  emptyTitle?: string;
}) {
  const gridStart = startOfWeekMonday(today);
  const gridDays = Array.from({ length: 14 }, (_, i) => addDaysISO(gridStart, i));
  const gridEnd = gridDays[gridDays.length - 1];

  const byDate = new Map<string, DeadlineItem[]>();
  for (const item of items) {
    const list = byDate.get(item.date) || [];
    list.push(item);
    byDate.set(item.date, list);
  }

  const overdueBeforeGrid = items.filter((i) => i.overdue && i.date < gridStart);

  const rangeLabel = (() => {
    const a = new Date(`${gridStart}T00:00:00`);
    const b = new Date(`${gridEnd}T00:00:00`);
    const sameMonth = a.getMonth() === b.getMonth();
    if (sameMonth) {
      return a.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-base">{title}</h2>
            <p className="text-xs opacity-60 -mt-0.5">
              {rangeLabel} · through {formatDate(end)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-error/70 border border-error" />
              Court
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-warning/70 border border-warning" />
              Filing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-info/70 border border-info" />
              Meeting
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-secondary/70 border border-secondary" />
              Billing
            </span>
            <Link href="/calendar" className="link link-hover ml-1">
              Open calendar
            </Link>
          </div>
        </div>

        {overdueBeforeGrid.length > 0 && (
          <div className="rounded-lg border border-error/25 bg-error/5 px-3 py-2">
            <p className="text-xs font-semibold text-error mb-1.5">
              Overdue before this week ({overdueBeforeGrid.length})
            </p>
            <ul className="flex flex-wrap gap-2">
              {overdueBeforeGrid.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 rounded-md border border-error/30 bg-base-100 px-2 py-1 text-xs hover:bg-error/10"
                    title={`${item.matterLabel} · ${formatDate(item.date)}`}
                  >
                    <span className="font-medium truncate max-w-[12rem]">{item.title}</span>
                    <span className="opacity-60 shrink-0">{formatDate(item.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Desktop / tablet: 2-week calendar grid */}
        <div className="hidden sm:block">
          <div className="rounded-lg border border-base-300 overflow-hidden">
            <div className="grid grid-cols-7 bg-base-200">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider opacity-70 border-b border-base-300"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((date, idx) => {
                const dayItems = (byDate.get(date) || []).filter(
                  (i) => !i.overdue || i.date >= gridStart
                );
                const isToday = date === today;
                const isPast = date < today;
                const isOutsideWindow = date > end;
                const dayNum = Number(date.slice(8, 10));
                const showMonth =
                  date.slice(8, 10) === "01" || date === gridStart
                    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })
                    : null;
                const col = idx % 7;
                const row = Math.floor(idx / 7);

                return (
                  <div
                    key={date}
                    className={[
                      "min-h-[8rem] p-1.5 flex flex-col gap-1 bg-base-100",
                      col < 6 ? "border-r border-base-300" : "",
                      row === 0 ? "border-b border-base-300" : "",
                      isPast && !isToday ? "bg-base-200/40" : "",
                      isOutsideWindow ? "opacity-40" : "",
                      isToday ? "relative z-[1] ring-2 ring-inset ring-primary bg-primary/5" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-center justify-between gap-1 px-0.5 mb-0.5">
                      <span
                        className={[
                          "leading-none tabular-nums",
                          isToday
                            ? "inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-content font-semibold text-xs"
                            : isPast
                              ? "text-sm opacity-45 font-medium"
                              : "text-sm font-semibold",
                        ].join(" ")}
                      >
                        {dayNum}
                      </span>
                      {showMonth && (
                        <span className="text-[10px] uppercase tracking-wide opacity-50">
                          {showMonth}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                      {dayItems.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          title={`${chipLabel(item)}: ${item.title} — ${item.matterLabel}`}
                          className={`block rounded border px-1 py-0.5 text-[10px] leading-snug hover:brightness-95 ${eventChipClass(item.kind, item.overdue)}`}
                        >
                          <span className="font-semibold">{chipLabel(item)}</span>
                          <span className="block truncate">{item.title}</span>
                        </Link>
                      ))}
                      {dayItems.length > 3 && (
                        <span className="text-[10px] opacity-60 px-0.5">
                          +{dayItems.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile: day-by-day cards */}
        <div className="sm:hidden space-y-2">
          {gridDays
            .filter((date) => date >= today && date <= end)
            .map((date) => {
              const dayItems = byDate.get(date) || [];
              const isToday = date === today;
              const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={date}
                  className={`rounded-lg border border-base-300 p-3 ${isToday ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm font-semibold">{label}</span>
                    {isToday && <span className="badge badge-primary badge-xs">Today</span>}
                  </div>
                  {dayItems.length === 0 ? (
                    <p className="text-xs opacity-50">Nothing scheduled</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {dayItems.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className={`block rounded border px-2 py-1.5 text-xs ${eventChipClass(item.kind, item.overdue)}`}
                          >
                            <span className="font-semibold">{chipLabel(item)}</span>
                            <span className="block font-medium mt-0.5">{item.title}</span>
                            <span className="block opacity-70 truncate">{item.matterLabel}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
