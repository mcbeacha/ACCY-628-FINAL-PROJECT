"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { relativeTime } from "@/lib/workspace-mock";

type ThreadMessage = {
  id: string;
  from: string;
  body: string;
  minutesAgo: number;
};

type Thread = {
  id: string;
  correspondent: string;
  role: string;
  matterRef: string;
  subject: string;
  preview: string;
  minutesAgo: number;
  unread: boolean;
  messages: ThreadMessage[];
};

const INITIAL_THREADS: Thread[] = [
  {
    id: "msg-1",
    correspondent: "Nadia Vale",
    role: "Client contact",
    matterRef: "2026-0108",
    subject: "Settlement posture",
    preview: "Can you confirm whether we should leave the last offer open through Friday?",
    minutesAgo: 55,
    unread: true,
    messages: [
      {
        id: "m1-1",
        from: "Nadia Vale",
        body: "Following up on yesterday's call — the board wants a clearer read on settlement posture before the deposition.",
        minutesAgo: 180,
      },
      {
        id: "m1-2",
        from: "You",
        body: "Understood. I am reviewing the latest demand letter and will send a recommendation this afternoon.",
        minutesAgo: 120,
      },
      {
        id: "m1-3",
        from: "Nadia Vale",
        body: "Can you confirm whether we should leave the last offer open through Friday?",
        minutesAgo: 55,
      },
    ],
  },
  {
    id: "msg-2",
    correspondent: "Marcus Hale",
    role: "Opposing counsel",
    matterRef: "2026-0114",
    subject: "Summary judgment briefing schedule",
    preview: "We can agree to a short extension if your reply is filed by Monday noon.",
    minutesAgo: 140,
    unread: true,
    messages: [
      {
        id: "m2-1",
        from: "Marcus Hale",
        body: "Confirming receipt of your draft stipulation. Happy to discuss a brief extension if needed.",
        minutesAgo: 400,
      },
      {
        id: "m2-2",
        from: "You",
        body: "Thank you. We may need two additional business days to finalize the response.",
        minutesAgo: 260,
      },
      {
        id: "m2-3",
        from: "Marcus Hale",
        body: "We can agree to a short extension if your reply is filed by Monday noon.",
        minutesAgo: 140,
      },
    ],
  },
  {
    id: "msg-3",
    correspondent: "Clerk Rivera",
    role: "Court clerk",
    matterRef: "2026-0114",
    subject: "Hearing courtroom change",
    preview: "The Northvale motion hearing has been moved to Courtroom 2.",
    minutesAgo: 320,
    unread: true,
    messages: [
      {
        id: "m3-1",
        from: "Clerk Rivera",
        body: "Please note that the Northvale motion hearing has been moved to Courtroom 2. Counsel should check in 15 minutes early.",
        minutesAgo: 320,
      },
    ],
  },
  {
    id: "msg-4",
    correspondent: "Casey Brook",
    role: "Client contact",
    matterRef: "2026-0131",
    subject: "MSA revision comments",
    preview: "Legal reviewed section 8 and still has questions on the indemnity carve-outs.",
    minutesAgo: 780,
    unread: false,
    messages: [
      {
        id: "m4-1",
        from: "Casey Brook",
        body: "Attached are internal comments on the MSA v4. Please prioritize the indemnity language.",
        minutesAgo: 1_200,
      },
      {
        id: "m4-2",
        from: "You",
        body: "Received. I will circulate a redline with proposed revisions by end of day tomorrow.",
        minutesAgo: 960,
      },
      {
        id: "m4-3",
        from: "Casey Brook",
        body: "Legal reviewed section 8 and still has questions on the indemnity carve-outs.",
        minutesAgo: 780,
      },
    ],
  },
  {
    id: "msg-5",
    correspondent: "Dana Whitfield",
    role: "Client contact",
    matterRef: "2026-0127",
    subject: "Zoning memo delivery",
    preview: "Does next Tuesday still work for the compliance memorandum walkthrough?",
    minutesAgo: 1_440,
    unread: false,
    messages: [
      {
        id: "m5-1",
        from: "You",
        body: "The zoning compliance memorandum is nearly final. I can walk the planning team through it early next week.",
        minutesAgo: 1_800,
      },
      {
        id: "m5-2",
        from: "Dana Whitfield",
        body: "Does next Tuesday still work for the compliance memorandum walkthrough?",
        minutesAgo: 1_440,
      },
    ],
  },
  {
    id: "msg-6",
    correspondent: "Elena Cruz",
    role: "Legal assistant",
    matterRef: "2026-0108",
    subject: "Deposition logistics",
    preview: "Conference Room A is confirmed and the court reporter is booked.",
    minutesAgo: 2_100,
    unread: false,
    messages: [
      {
        id: "m6-1",
        from: "Elena Cruz",
        body: "Conference Room A is confirmed and the court reporter is booked for the Alvarez deposition.",
        minutesAgo: 2_100,
      },
      {
        id: "m6-2",
        from: "You",
        body: "Perfect — please send the calendar invite to opposing counsel as well.",
        minutesAgo: 2_040,
      },
    ],
  },
  {
    id: "msg-7",
    correspondent: "Samuel Boyd",
    role: "Opposing counsel",
    matterRef: "2026-0096",
    subject: "Expert disclosure timing",
    preview: "We propose exchanging expert reports on a staggered schedule.",
    minutesAgo: 3_200,
    unread: false,
    messages: [
      {
        id: "m7-1",
        from: "Samuel Boyd",
        body: "We propose exchanging expert reports on a staggered schedule beginning the week of the 22nd.",
        minutesAgo: 3_200,
      },
    ],
  },
];

type FilterMode = "all" | "unread";

export function MessagesClient() {
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_THREADS[0]?.id ?? null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [reply, setReply] = useState("");

  const filteredThreads = useMemo(() => {
    if (filter === "unread") return threads.filter((t) => t.unread);
    return threads;
  }, [threads, filter]);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  function selectThread(id: string) {
    setSelectedId(id);
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, unread: false } : t))
    );
    setReply("");
  }

  function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const body = reply.trim();
    if (!body || !selectedId) return;

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== selectedId) return t;
        const nextMessage: ThreadMessage = {
          id: `reply-${Date.now()}`,
          from: "You",
          body,
          minutesAgo: 0,
        };
        return {
          ...t,
          preview: body,
          minutesAgo: 0,
          unread: false,
          messages: [...t.messages, nextMessage],
        };
      })
    );
    setReply("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filter === "unread" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFilter("unread")}
        >
          Unread
        </button>
        <p className="text-sm opacity-60 ml-auto">
          Messaging is not connected to a backend yet.
        </p>
      </div>

      {filteredThreads.length === 0 ? (
        <EmptyState
          title="No conversations match this filter."
          description={
            filter === "unread"
              ? "You are caught up — there are no unread threads."
              : "Start a new conversation once messaging is connected."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
            <ul className="divide-y divide-base-300">
              {filteredThreads.map((thread) => {
                const isActive = thread.id === selectedId;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => selectThread(thread.id)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-base-200 ${
                        isActive ? "bg-base-200" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {thread.correspondent}
                            {thread.unread && (
                              <span className="badge badge-primary badge-xs ml-2 align-middle">
                                New
                              </span>
                            )}
                          </p>
                          <p className="text-xs opacity-60 truncate">{thread.role}</p>
                        </div>
                        <span className="text-xs opacity-50 shrink-0">
                          {relativeTime(thread.minutesAgo)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{thread.subject}</p>
                      <p className="text-sm opacity-70 truncate">{thread.preview}</p>
                      <p className="text-xs opacity-50 mt-1">Matter {thread.matterRef}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-2 card bg-base-100 border border-base-300 shadow-sm">
            {selected ? (
              <div className="card-body gap-4 min-h-[28rem]">
                <div className="border-b border-base-300 pb-3">
                  <h2 className="font-display text-xl font-semibold">{selected.subject}</h2>
                  <p className="text-sm opacity-70 mt-1">
                    {selected.correspondent} · {selected.role} · Matter {selected.matterRef}
                  </p>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto max-h-[22rem] pr-1">
                  {selected.messages.map((message) => {
                    const isYou = message.from === "You";
                    return (
                      <div
                        key={message.id}
                        className={`chat ${isYou ? "chat-end" : "chat-start"}`}
                      >
                        <div className="chat-header opacity-70 text-xs mb-1">
                          {message.from}
                          <time className="ml-2 opacity-50">
                            {relativeTime(message.minutesAgo)}
                          </time>
                        </div>
                        <div
                          className={`chat-bubble ${
                            isYou ? "chat-bubble-primary" : "chat-bubble-secondary"
                          }`}
                        >
                          {message.body}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={sendReply} className="space-y-2 border-t border-base-300 pt-3">
                  <label className="form-control w-full">
                    <span className="label-text text-sm font-medium">Reply</span>
                    <textarea
                      className="textarea textarea-bordered min-h-[5rem]"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply…"
                      aria-label="Reply message"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs opacity-60">
                      Replies stay in this session only — messaging is not connected to a backend.
                    </p>
                    <button type="submit" className="btn btn-primary" disabled={!reply.trim()}>
                      Send
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="card-body">
                <EmptyState title="Select a conversation" description="Choose a thread from the list to read and reply." />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
