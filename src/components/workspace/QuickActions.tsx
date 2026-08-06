"use client";

import {
  CalendarPlus,
  Clock,
  FilePlus2,
  ListPlus,
  ShieldCheck,
  StickyNote,
  Upload,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type ModalKey = "task" | "document" | "event" | "note" | "conflict";

type QuickAction = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  href?: string;
  modal?: ModalKey;
};

const ACTIONS: QuickAction[] = [
  { label: "New Matter", Icon: FilePlus2, href: "/matters/new" },
  { label: "New Client", Icon: UserPlus, href: "/clients/new" },
  { label: "Add Task", Icon: ListPlus, modal: "task" },
  { label: "Log Time", Icon: Clock, href: "/time/new" },
  { label: "Upload Document", Icon: Upload, modal: "document" },
  { label: "Schedule Event", Icon: CalendarPlus, modal: "event" },
  { label: "Add Note", Icon: StickyNote, modal: "note" },
  { label: "Run Conflict Check", Icon: ShieldCheck, modal: "conflict" },
];

const MODAL_COPY: Record<ModalKey, { title: string; submit: string; success: string }> = {
  task: {
    title: "Add task",
    submit: "Create task",
    success: "Task captured. Connect the tasks API to persist it.",
  },
  document: {
    title: "Upload document",
    submit: "Upload",
    success: "Upload recorded. Connect document storage to persist the file.",
  },
  event: {
    title: "Schedule event",
    submit: "Schedule",
    success: "Event captured. Connect the calendar API to persist it.",
  },
  note: {
    title: "Add note",
    submit: "Save note",
    success: "Note captured. Connect the notes API to persist it.",
  },
  conflict: {
    title: "Run conflict check",
    submit: "Run check",
    success: "No conflicts found in the fictional demonstration data set.",
  },
};

export function QuickActions() {
  const [open, setOpen] = useState<ModalKey | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!open) return;
    setResult(MODAL_COPY[open].success);
    setOpen(null);
  }

  return (
    <>
      {result && (
        <div className="alert alert-success text-sm mb-3">
          <span>{result}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map(({ label, Icon, href, modal }) => {
          const className =
            "flex items-center gap-2.5 rounded-md border border-base-content/10 bg-base-100 px-3 py-2.5 text-sm font-medium text-base-content/80 shadow-[0_1px_2px_oklch(22%_0.03_255_/_0.04)] transition-colors hover:border-primary/30 hover:text-primary";
          return href ? (
            <Link key={label} href={href} className={className}>
              <Icon className="h-4 w-4 shrink-0 opacity-55" />
              <span className="truncate">{label}</span>
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              className={className}
              onClick={() => {
                setResult(null);
                setOpen(modal ?? null);
              }}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-55" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <dialog className="modal modal-open" aria-label={MODAL_COPY[open].title}>
          <div className="modal-box">
            <h3 className="font-display text-lg font-semibold">{MODAL_COPY[open].title}</h3>
            <p className="text-sm opacity-70 mt-1">
              Fictional academic data. Submitting records the action in this session only.
            </p>

            <form className="mt-4 space-y-3" onSubmit={submit}>
              <label className="form-control">
                <span className="label-text text-sm font-medium">
                  {open === "conflict" ? "Party or organization name" : "Title"}
                </span>
                <input className="input input-bordered w-full mt-1" required autoFocus />
              </label>

              <label className="form-control">
                <span className="label-text text-sm font-medium">Related matter</span>
                <input
                  className="input input-bordered w-full mt-1"
                  placeholder="e.g. 2026-0114"
                />
              </label>

              {(open === "task" || open === "event") && (
                <label className="form-control">
                  <span className="label-text text-sm font-medium">Date</span>
                  <input type="date" className="input input-bordered w-full mt-1" />
                </label>
              )}

              {open === "note" && (
                <label className="form-control">
                  <span className="label-text text-sm font-medium">Note</span>
                  <textarea className="textarea textarea-bordered w-full mt-1" rows={3} />
                </label>
              )}

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {MODAL_COPY[open].submit}
                </button>
              </div>
            </form>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => setOpen(null)}
            aria-label="Close dialog"
          />
        </dialog>
      )}
    </>
  );
}
