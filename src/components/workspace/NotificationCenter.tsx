"use client";

import {
  NOTIFICATIONS,
  relativeTime,
  type NotificationKind,
} from "@/lib/workspace-mock";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  Gavel,
  Megaphone,
  MessageSquare,
  Timer,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

const ICONS: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  deadline: CalendarClock,
  overdue_task: Timer,
  client_message: MessageSquare,
  document_review: FileSearch,
  matter_assignment: UserPlus,
  court_update: Gavel,
  time_reminder: Timer,
  announcement: Megaphone,
};

export function NotificationCenter() {
  const [readIds, setReadIds] = useState<string[]>([]);

  const items = NOTIFICATIONS.map((n) => ({
    ...n,
    unread: n.unread && !readIds.includes(n.id),
  }));
  const unreadCount = items.filter((n) => n.unread).length;

  function markRead(id: string) {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function markAllRead() {
    setReadIds(NOTIFICATIONS.map((n) => n.id));
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-square btn-sm"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      >
        <div className="indicator">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="badge badge-error badge-xs indicator-item">{unreadCount}</span>
          )}
        </div>
      </div>

      <div
        tabIndex={0}
        className="dropdown-content z-50 mt-3 w-80 sm:w-96 rounded-box border border-base-300 bg-base-100 shadow"
      >
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-2.5">
          <p className="font-semibold text-sm">Notifications</p>
          <button
            type="button"
            className="btn btn-ghost btn-xs gap-1"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>

        <ul className="max-h-96 overflow-y-auto divide-y divide-base-200">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => markRead(item.id)}
                  className={`interactive-row flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                    item.unread ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-base-content/60">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      {item.unread && (
                        <span className="badge badge-primary badge-xs shrink-0">New</span>
                      )}
                    </span>
                    <span className="block text-xs opacity-70 mt-0.5">{item.detail}</span>
                    <span className="block text-xs opacity-50 mt-0.5">
                      {relativeTime(item.minutesAgo)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
