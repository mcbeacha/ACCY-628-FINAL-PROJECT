"use client";

import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import type { MessagingPerson } from "@/lib/messaging";
import {
  conversationKind,
  conversationLabel,
  conversationsFor,
  getMessageSnapshot,
  getServerMessageSnapshot,
  isUnread,
  lastMessage,
  personLabel,
  readStore,
  resolveMessagingViewer,
  subscribeToMessages,
} from "@/lib/messaging-store";
import { relativeTime } from "@/lib/workspace-mock";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

const PREVIEW_LIMIT = 5;

export function MessagesIndicator({ viewer: fallbackViewer }: { viewer: MessagingPerson }) {
  const demo = useDemoRole();
  const viewer = resolveMessagingViewer(
    fallbackViewer,
    demo?.activeIdentity.profileId ?? null
  );
  const rawStore = useSyncExternalStore(
    subscribeToMessages,
    getMessageSnapshot,
    getServerMessageSnapshot
  );

  const conversations = useMemo(
    () => conversationsFor(readStore(rawStore), viewer.id),
    [rawStore, viewer.id]
  );

  const unreadCount = conversations.filter((conversation) =>
    isUnread(conversation, viewer.id)
  ).length;
  const preview = conversations.slice(0, PREVIEW_LIMIT);

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-square btn-sm"
        suppressHydrationWarning
        aria-label={`Messages for ${viewer.name}${
          unreadCount ? `, ${unreadCount} unread` : ""
        }`}
      >
        <div className="indicator">
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="badge badge-primary badge-xs indicator-item">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      <div
        tabIndex={0}
        className="dropdown-content z-50 mt-3 w-80 sm:w-96 rounded-box border border-base-300 bg-base-100 shadow"
      >
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Messages</p>
            <p className="truncate text-xs opacity-60">{viewer.name}</p>
          </div>
          <Link href="/messages" className="btn btn-ghost btn-xs">
            Open inbox
          </Link>
        </div>

        {preview.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm opacity-60">
            No conversations yet.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-base-200 overflow-y-auto">
            {preview.map((conversation) => {
              const latest = lastMessage(conversation);
              const unread = isUnread(conversation, viewer.id);
              return (
                <li key={conversation.id}>
                  <Link
                    href="/messages"
                    className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-base-200 ${
                      unread ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {conversationLabel(conversation, viewer)}
                        </span>
                        {unread && (
                          <span className="badge badge-primary badge-xs shrink-0">New</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs opacity-70">
                        {conversation.subject}
                      </span>
                      <span className="mt-0.5 block truncate text-xs opacity-60">
                        {personLabel(latest.senderId, viewer)}: {latest.body}
                      </span>
                      <span className="mt-0.5 block text-xs opacity-50">
                        {conversationKind(conversation, viewer)} ·{" "}
                        {relativeTime(latest.minutesAgo)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-base-300 px-4 py-2.5">
          <Link href="/messages" className="btn btn-primary btn-sm w-full">
            Go to Messages
          </Link>
        </div>
      </div>
    </div>
  );
}
