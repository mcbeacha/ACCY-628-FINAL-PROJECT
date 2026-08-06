"use client";

import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import {
  conversationLabel,
  getMessageSnapshot,
  getServerMessageSnapshot,
  lastMessage,
  readStore,
  resolveMessagingViewer,
  subscribeToMessages,
  unreadConversationsFor,
} from "@/lib/messaging-store";
import type { MessagingPerson } from "@/lib/messaging";
import { createClient } from "@/lib/supabase/client";
import { evaluationDisplayName } from "@/lib/case-evaluations";
import { notificationsForRole, type PersonNotification } from "@/lib/notifications";
import { relativeTime, type NotificationKind } from "@/lib/workspace-mock";
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
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

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

function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(1, Math.round(ms / 60_000));
}

export function NotificationCenter({ viewer: fallbackViewer }: { viewer: MessagingPerson }) {
  const demo = useDemoRole();
  const viewer = resolveMessagingViewer(
    fallbackViewer,
    demo?.activeIdentity.profileId ?? null
  );
  // Read state is tracked per person so switching identities does not carry
  // one person's dismissed alerts into another person's bell.
  const [readByViewer, setReadByViewer] = useState<Record<string, string[]>>({});
  const [intakeAlerts, setIntakeAlerts] = useState<PersonNotification[]>([]);
  const rawStore = useSyncExternalStore(
    subscribeToMessages,
    getMessageSnapshot,
    getServerMessageSnapshot
  );

  useEffect(() => {
    if (viewer.role !== "paralegal") {
      setIntakeAlerts([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function loadIntakeAlerts() {
      const { data } = await supabase
        .from("case_evaluations")
        .select("id, reference_number, first_name, last_name, practice_area, urgency_level, submitted_at")
        .eq("evaluation_status", "New")
        .order("submitted_at", { ascending: false })
        .limit(8);

      if (cancelled) return;

      const rows = data || [];
      setIntakeAlerts(
        rows.map((row) => ({
          id: `intake-${row.id}`,
          kind: "matter_assignment" as const,
          title: "New prospective client request",
          detail: `${evaluationDisplayName(row)} submitted ${row.reference_number} (${row.practice_area}, ${row.urgency_level})`,
          minutesAgo: minutesSince(row.submitted_at),
          unread: true,
          href: `/case-evaluations/${row.id}`,
        }))
      );
    }

    void loadIntakeAlerts();
    const timer = window.setInterval(() => {
      void loadIntakeAlerts();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [viewer.role]);

  const notifications = useMemo(() => {
    const store = readStore(rawStore);
    const messageAlerts: PersonNotification[] = unreadConversationsFor(
      store,
      viewer.id
    ).map((conversation) => {
      const latest = lastMessage(conversation);
      return {
        id: `msg-${conversation.id}-${latest.id}`,
        kind: "client_message",
        title: `New message from ${conversationLabel(conversation, viewer)}`,
        detail: `${conversation.subject} — ${latest.body}`,
        minutesAgo: latest.minutesAgo,
        unread: true,
        href: "/messages",
      };
    });

    return [...intakeAlerts, ...messageAlerts, ...notificationsForRole(viewer.role)].sort(
      (a, b) => a.minutesAgo - b.minutesAgo
    );
  }, [rawStore, viewer, intakeAlerts]);

  const readIds = readByViewer[viewer.id] ?? [];
  const items = notifications.map((notification) => ({
    ...notification,
    unread: notification.unread && !readIds.includes(notification.id),
  }));
  const unreadCount = items.filter((item) => item.unread).length;

  function markRead(id: string) {
    setReadByViewer((current) => {
      const existing = current[viewer.id] ?? [];
      if (existing.includes(id)) return current;
      return { ...current, [viewer.id]: [...existing, id] };
    });
  }

  function markAllRead() {
    setReadByViewer((current) => ({
      ...current,
      [viewer.id]: notifications.map((notification) => notification.id),
    }));
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-square btn-sm"
        aria-label={`Notifications for ${viewer.name}${
          unreadCount ? `, ${unreadCount} unread` : ""
        }`}
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
          <div className="min-w-0">
            <p className="font-semibold text-sm">Notifications</p>
            <p className="truncate text-xs opacity-60">{viewer.name}</p>
          </div>
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
                <Link
                  href={item.href}
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
                    <span className="block text-xs opacity-70 mt-0.5 line-clamp-2">
                      {item.detail}
                    </span>
                    <span className="block text-xs opacity-50 mt-0.5" suppressHydrationWarning>
                      {relativeTime(item.minutesAgo)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
