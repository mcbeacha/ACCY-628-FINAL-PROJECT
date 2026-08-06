"use client";

import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import { addUserCalendarEvent } from "@/lib/calendar-user-events";
import { createClient } from "@/lib/supabase/client";
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
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type ModalKey = "task" | "document" | "event" | "note" | "conflict";

type QuickAction = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  href?: string;
  modal?: ModalKey;
};

type MatterOpt = { id: string; matter_number: string; matter_name: string };

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

const MODAL_COPY: Record<ModalKey, { title: string; submit: string }> = {
  task: { title: "Add task", submit: "Create task" },
  document: { title: "Upload document", submit: "Record upload" },
  event: { title: "Schedule event", submit: "Schedule" },
  note: { title: "Add note", submit: "Save note" },
  conflict: { title: "Run conflict check", submit: "Run check" },
};

export function QuickActions() {
  const router = useRouter();
  const demo = useDemoRole();
  const userId = demo?.activeDemoProfileId;
  const [open, setOpen] = useState<ModalKey | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [title, setTitle] = useState("");
  const [matterId, setMatterId] = useState("");
  const [date, setDate] = useState("");
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("matters")
        .select("id, matter_number, matter_name")
        .neq("matter_status", "Canceled")
        .order("matter_number");
      setMatters((data || []) as MatterOpt[]);
    })();
  }, [open]);

  function resetForm() {
    setTitle("");
    setMatterId("");
    setDate("");
    setNoteBody("");
    setError(null);
  }

  function openModal(key: ModalKey) {
    resetForm();
    setResult(null);
    setDate(new Date().toISOString().slice(0, 10));
    setOpen(key);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!open) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const selected = matters.find((m) => m.id === matterId);
      const matterLabel = selected
        ? `${selected.matter_number} · ${selected.matter_name}`
        : title.trim();

      if (open === "task") {
        if (!userId) throw new Error("Demo user not ready. Try again.");
        if (!matterId) throw new Error("Select a related matter.");
        if (!title.trim()) throw new Error("Task title is required.");
        const { error: insErr } = await supabase.from("matter_tasks").insert({
          matter_id: matterId,
          task_title: title.trim(),
          task_description: noteBody.trim() || null,
          assigned_to: userId,
          task_status: "Not Started",
          priority: "Normal",
          due_date: date || null,
          client_visible: false,
          created_by: userId,
        });
        if (insErr) throw new Error(insErr.message);
        setResult(`Task created on ${selected?.matter_number}. It appears on My Tasks and the matter.`);
        setOpen(null);
        router.refresh();
        return;
      }

      if (open === "event") {
        if (!title.trim() || !date) throw new Error("Title and date are required.");
        addUserCalendarEvent({
          title: title.trim(),
          date,
          matterRef: selected?.matter_number || "—",
          type: "Internal Meeting",
        });
        setResult(`Event scheduled for ${date}. Open Calendar to see it.`);
        setOpen(null);
        router.refresh();
        return;
      }

      if (open === "note") {
        if (!userId) throw new Error("Demo user not ready. Try again.");
        if (!matterId) throw new Error("Select a related matter.");
        if (!title.trim() && !noteBody.trim()) throw new Error("Enter a note title or body.");
        const { data: matter } = await supabase
          .from("matters")
          .select("client_id")
          .eq("id", matterId)
          .maybeSingle();
        const { error: insErr } = await supabase.from("matter_activity").insert({
          matter_id: matterId,
          client_id: matter?.client_id || null,
          action_type: "note",
          action_description: `${title.trim() || "Note"}${noteBody.trim() ? `: ${noteBody.trim()}` : ""}`,
          performed_by: userId,
        });
        if (insErr) throw new Error(insErr.message);
        setResult(`Note saved on ${selected?.matter_number}. Check the matter Activity tab.`);
        setOpen(null);
        router.refresh();
        return;
      }

      if (open === "document") {
        if (!userId) throw new Error("Demo user not ready. Try again.");
        if (!matterId) throw new Error("Select a related matter.");
        if (!title.trim()) throw new Error("Document title is required.");
        const { data: matter } = await supabase
          .from("matters")
          .select("client_id")
          .eq("id", matterId)
          .maybeSingle();
        const { error: insErr } = await supabase.from("matter_activity").insert({
          matter_id: matterId,
          client_id: matter?.client_id || null,
          action_type: "document_upload",
          action_description: `Document recorded: ${title.trim()} (demo metadata — file storage not connected).`,
          performed_by: userId,
        });
        if (insErr) throw new Error(insErr.message);
        setResult(`Document recorded on ${selected?.matter_number}. See matter Activity.`);
        setOpen(null);
        router.refresh();
        return;
      }

      if (open === "conflict") {
        const party = title.trim();
        if (!party) throw new Error("Enter a party or organization name.");
        const { data: clients } = await supabase
          .from("clients")
          .select("client_name, client_number")
          .ilike("client_name", `%${party}%`)
          .limit(5);
        const { data: matterHits } = await supabase
          .from("matters")
          .select("matter_number, matter_name")
          .or(`matter_name.ilike.%${party}%,matter_number.ilike.%${party}%`)
          .limit(5);
        const hits = [
          ...(clients || []).map((c) => `Client ${c.client_number}: ${c.client_name}`),
          ...(matterHits || []).map((m) => `Matter ${m.matter_number}: ${m.matter_name}`),
        ];
        if (hits.length) {
          setResult(
            `Possible matches for “${party}”: ${hits.join("; ")}. Review before intake.`
          );
        } else {
          setResult(
            `No conflicts found for “${party}” in the fictional demo client/matter set.`
          );
        }
        setOpen(null);
        return;
      }

      void matterLabel;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
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
            "interactive-tile group flex items-center gap-2.5 rounded-md border border-base-content/10 bg-base-100 px-3 py-2.5 text-sm font-medium text-base-content/80 shadow-[0_1px_2px_oklch(22%_0.03_255_/_0.04)] transition-colors hover:border-primary/30 hover:text-primary";
          return href ? (
            <Link key={label} href={href} className={className}>
              <Icon className="interactive-tile-icon h-4 w-4 shrink-0 opacity-55" />
              <span className="truncate">{label}</span>
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              className={className}
              onClick={() => openModal(modal!)}
            >
              <Icon className="interactive-tile-icon h-4 w-4 shrink-0 opacity-55" />
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
              {open === "event"
                ? "Events are saved to your browser calendar for this demo."
                : open === "conflict"
                  ? "Searches fictional demo clients and matters."
                  : "Saves to the live demo database for this role."}
            </p>

            <form className="mt-4 space-y-3" onSubmit={submit}>
              {error && (
                <div className="alert alert-error text-sm py-2">
                  <span>{error}</span>
                </div>
              )}

              <label className="form-control">
                <span className="label-text text-sm font-medium">
                  {open === "conflict"
                    ? "Party or organization name"
                    : open === "document"
                      ? "Document title"
                      : "Title"}
                </span>
                <input
                  className="input input-bordered w-full mt-1"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              {open !== "conflict" && (
                <label className="form-control">
                  <span className="label-text text-sm font-medium">
                    Related matter{open === "event" ? " (optional)" : " *"}
                  </span>
                  <select
                    className="select select-bordered w-full mt-1"
                    required={open !== "event"}
                    value={matterId}
                    onChange={(e) => setMatterId(e.target.value)}
                  >
                    <option value="">{open === "event" ? "No matter" : "Select matter"}</option>
                    {matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.matter_number} · {m.matter_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {(open === "task" || open === "event") && (
                <label className="form-control">
                  <span className="label-text text-sm font-medium">
                    {open === "task" ? "Due date" : "Event date"}
                  </span>
                  <input
                    type="date"
                    className="input input-bordered w-full mt-1"
                    required={open === "event"}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}

              {(open === "note" || open === "task") && (
                <label className="form-control">
                  <span className="label-text text-sm font-medium">
                    {open === "note" ? "Note" : "Description"}
                  </span>
                  <textarea
                    className="textarea textarea-bordered w-full mt-1"
                    rows={3}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                  />
                </label>
              )}

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOpen(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Saving…" : MODAL_COPY[open].submit}
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
