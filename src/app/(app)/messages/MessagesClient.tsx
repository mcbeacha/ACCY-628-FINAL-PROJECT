"use client";

import { EmptyState } from "@/components/EmptyState";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import {
  peopleAvailableTo,
  personById,
  type Conversation,
  type MessagingPerson,
} from "@/lib/messaging";
import {
  clearStore,
  conversationKind,
  conversationLabel,
  conversationsFor,
  getMessageSnapshot,
  getServerMessageSnapshot,
  isUnread,
  lastMessage,
  otherParticipants,
  readStore,
  resolveMessagingViewer,
  saveStore,
  subscribeToMessages,
} from "@/lib/messaging-store";
import { relativeTime } from "@/lib/workspace-mock";
import { MessageSquarePlus, RotateCcw, Search, Send, Users } from "lucide-react";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

type FilterMode = "all" | "unread" | "staff" | "client";

export function MessagesClient({ viewer: fallbackViewer }: { viewer: MessagingPerson }) {
  const demo = useDemoRole();
  const viewer = resolveMessagingViewer(
    fallbackViewer,
    demo?.activeIdentity.profileId ?? null
  );
  const idPrefix = useId().replaceAll(":", "");
  const idCounter = useRef(0);
  const rawStore = useSyncExternalStore(
    subscribeToMessages,
    getMessageSnapshot,
    getServerMessageSnapshot
  );
  const store = useMemo(() => readStore(rawStore), [rawStore]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [composing, setComposing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const conversations = useMemo(
    () => conversationsFor(store, viewer.id),
    [store, viewer.id]
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const unread = isUnread(conversation, viewer.id);
      const kind = conversationKind(conversation, viewer).toLowerCase();
      if (filter === "unread" && !unread) return false;
      if (filter === "staff" && kind !== "internal" && kind !== "legal team") return false;
      if (filter === "client" && kind !== "client") return false;
      if (!normalizedQuery) return true;
      const participantText = otherParticipants(conversation, viewer)
        .map((person) => `${person.name} ${person.title}`)
        .join(" ");
      return `${participantText} ${conversation.subject} ${conversation.matterRef ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [conversations, filter, query, viewer]);

  const selected =
    conversations.find((conversation) => conversation.id === selectedId) ??
    filteredConversations[0] ??
    null;
  const unreadCount = conversations.filter((conversation) =>
    isUnread(conversation, viewer.id)
  ).length;
  const availablePeople = peopleAvailableTo(viewer);

  function updateConversations(
    update: (conversations: Conversation[]) => Conversation[]
  ) {
    saveStore({ ...store, conversations: update(store.conversations) });
  }

  function nextId(kind: "conversation" | "message" | "reply") {
    idCounter.current += 1;
    return `${idPrefix}-${kind}-${idCounter.current}`;
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setReply("");
    updateConversations((all) =>
      all.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.readBy.includes(viewer.id)
                  ? message
                  : { ...message, readBy: [...message.readBy, viewer.id] }
              ),
            }
          : conversation
      )
    );
  }

  function sendReply(event: React.FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || !selected) return;
    updateConversations((all) =>
      all.map((conversation) =>
        conversation.id === selected.id
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: nextId("reply"),
                  senderId: viewer.id,
                  body,
                  minutesAgo: 0,
                  readBy: [viewer.id],
                },
              ],
            }
          : conversation
      )
    );
    setReply("");
  }

  function startConversation(event: React.FormEvent) {
    event.preventDefault();
    const recipient = availablePeople.find((person) => person.id === recipientId);
    const body = newMessage.trim();
    if (!recipient || !subject.trim() || !body) return;

    const id = nextId("conversation");
    const conversation: Conversation = {
      id,
      participantIds: [viewer.id, recipient.id],
      subject: subject.trim(),
      matterRef: matterRef.trim() || undefined,
      messages: [
        {
          id: nextId("message"),
          senderId: viewer.id,
          body,
          minutesAgo: 0,
          readBy: [viewer.id],
        },
      ],
    };
    updateConversations((all) => [conversation, ...all]);
    setSelectedId(id);
    setRecipientId("");
    setSubject("");
    setMatterRef("");
    setNewMessage("");
    setComposing(false);
  }

  function resetDemoMessages() {
    clearStore();
    setSelectedId(null);
    setReply("");
  }

  return (
    <div className="space-y-4">
      <div className="alert border border-info/30 bg-info/10 text-sm">
        <Users className="h-5 w-5 shrink-0" aria-hidden />
        <span>
          Viewing <strong>{viewer.name}&apos;s</strong> conversations. Messages between
          demo staff and clients are linked: send a reply, switch roles, and the recipient
          will see it.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm gap-2"
          onClick={() => setComposing((open) => !open)}
        >
          <MessageSquarePlus className="h-4 w-4" />
          New message
        </button>
        <div className="join">
          {(
            viewer.role === "client"
              ? ([
                  ["all", "All"],
                  ["unread", `Unread ${unreadCount}`],
                  ["staff", "Legal team"],
                ] as const)
              : ([
                  ["all", "All"],
                  ["unread", `Unread ${unreadCount}`],
                  ["staff", "Internal"],
                  ["client", "Clients"],
                ] as const)
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm join-item ${
                filter === value ? "btn-neutral" : "btn-outline"
              }`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="input input-bordered input-sm flex min-w-56 flex-1 items-center gap-2">
          <Search className="h-4 w-4 opacity-50" aria-hidden />
          <input
            type="search"
            className="grow"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
          />
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-2"
          onClick={resetDemoMessages}
          title="Restore the original demo conversations"
        >
          <RotateCcw className="h-4 w-4" />
          Reset demo
        </button>
      </div>

      {composing && (
        <form
          onSubmit={startConversation}
          className="card border border-primary/30 bg-base-100 shadow-sm"
        >
          <div className="card-body gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold">New conversation</h2>
              <p className="text-sm opacity-70">
                {viewer.role === "client"
                  ? "Contact your assigned attorney or billing coordinator."
                  : "Start a linked conversation with another staff member or the demo client."}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text text-sm font-medium">Recipient</span>
                <select
                  className="select select-bordered w-full"
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  required
                  aria-label="Message recipient"
                >
                  <option value="">Choose a person…</option>
                  {availablePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} — {person.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-sm font-medium">
                  Matter or record <span className="opacity-50">(optional)</span>
                </span>
                <input
                  className="input input-bordered"
                  value={matterRef}
                  onChange={(event) => setMatterRef(event.target.value)}
                  placeholder="MT-05001"
                />
              </label>
            </div>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Subject</span>
              <input
                className="input input-bordered"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What is this conversation about?"
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Message</span>
              <textarea
                className="textarea textarea-bordered min-h-24"
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Write your message…"
                required
              />
            </label>
            <div className="card-actions justify-end">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setComposing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary gap-2"
                disabled={!recipientId || !subject.trim() || !newMessage.trim()}
              >
                <Send className="h-4 w-4" />
                Send message
              </button>
            </div>
          </div>
        </form>
      )}

      {filteredConversations.length === 0 ? (
        <EmptyState
          title="No conversations match this view."
          description={
            filter === "unread"
              ? `${viewer.name} has no unread messages.`
              : "Try another filter or start a new conversation."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card overflow-hidden border border-base-300 bg-base-100 shadow-sm lg:col-span-1">
            <ul className="max-h-[42rem] divide-y divide-base-300 overflow-y-auto">
              {filteredConversations.map((conversation) => {
                const latest = lastMessage(conversation);
                const sender = personById(latest.senderId, viewer);
                const unread = isUnread(conversation, viewer.id);
                const active = conversation.id === selected?.id;
                const kind = conversationKind(conversation, viewer);
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-base-200 ${
                        active ? "bg-base-200" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold">
                          {conversationLabel(conversation, viewer)}
                          {unread && (
                            <span className="badge badge-primary badge-xs ml-2 align-middle">
                              New
                            </span>
                          )}
                        </p>
                        <span className="shrink-0 text-xs opacity-50">
                          {relativeTime(latest.minutesAgo)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`badge badge-sm ${
                            kind === "Client"
                              ? "badge-accent"
                              : kind === "Legal team"
                                ? "badge-info"
                                : "badge-ghost"
                          }`}
                        >
                          {kind}
                        </span>
                        {conversation.matterRef && (
                          <span className="text-xs opacity-60">
                            {conversation.matterRef}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">
                        {conversation.subject}
                      </p>
                      <p className="truncate text-sm opacity-70">
                        {sender.id === viewer.id ? "You" : sender.name}: {latest.body}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
            {selected ? (
              <div className="card-body min-h-[32rem] gap-4">
                <div className="border-b border-base-300 pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-xl font-semibold">
                        {selected.subject}
                      </h2>
                      <p className="mt-1 text-sm opacity-70">
                        {conversationLabel(selected, viewer)}
                        {selected.matterRef ? ` · ${selected.matterRef}` : ""}
                      </p>
                    </div>
                    <span className="badge badge-outline">
                      {conversationKind(selected, viewer)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {selected.messages.map((message) => {
                    const sender = personById(message.senderId, viewer);
                    const mine = message.senderId === viewer.id;
                    return (
                      <div
                        key={message.id}
                        className={`chat ${mine ? "chat-end" : "chat-start"}`}
                      >
                        <div className="chat-header mb-1 text-xs opacity-70">
                          {mine ? "You" : sender.name}
                          <span className="ml-2 opacity-60">{sender.title}</span>
                          <time className="ml-2 opacity-50">
                            {relativeTime(message.minutesAgo)}
                          </time>
                        </div>
                        <div
                          className={`chat-bubble ${
                            mine ? "chat-bubble-primary" : "chat-bubble-secondary"
                          }`}
                        >
                          {message.body}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={sendReply}
                  className="space-y-2 border-t border-base-300 pt-3"
                >
                  <label className="form-control w-full">
                    <span className="label-text text-sm font-medium">
                      Reply as {viewer.name}
                    </span>
                    <textarea
                      className="textarea textarea-bordered min-h-20"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder={`Reply to ${conversationLabel(selected, viewer)}…`}
                      aria-label="Reply message"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs opacity-60">
                      Demo only. The recipient sees this reply when you switch to their
                      account in this browser.
                    </p>
                    <button
                      type="submit"
                      className="btn btn-primary gap-2"
                      disabled={!reply.trim()}
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="card-body">
                <EmptyState
                  title="Select a conversation"
                  description="Choose a thread from the list to read and reply."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
