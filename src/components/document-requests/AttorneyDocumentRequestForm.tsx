"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clientDisplayName } from "@/lib/format";
import {
  createDocumentRequestId,
  nowIso,
  type DocumentRequestPriority,
  upsertDocumentRequest,
} from "@/lib/document-requests";
import type { Client, Matter, MatterAssignment, Profile } from "@/lib/types";

type MatterOption = Matter & { clients?: Client | null };

type Props = {
  profile: Profile;
  /** Compact card for dashboard vs full page. */
  compact?: boolean;
};

export function AttorneyDocumentRequestForm({ profile, compact = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [matters, setMatters] = useState<MatterOption[]>([]);
  const [paralegalsByMatter, setParalegalsByMatter] = useState<
    Record<string, { id: string; name: string }[]>
  >({});
  const [matterId, setMatterId] = useState("");
  const [paralegalId, setParalegalId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState<DocumentRequestPriority>("Normal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: matterData, error: matterErr } = await supabase
        .from("matters")
        .select("*, clients(*)")
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (matterErr) {
        setError(matterErr.message);
        setLoading(false);
        return;
      }
      const rows = (matterData || []) as MatterOption[];
      setMatters(rows);

      const ids = rows.map((m) => m.id);
      if (ids.length) {
        const { data: assigns } = await supabase
          .from("matter_assignments")
          .select("*, profiles(*)")
          .in("matter_id", ids)
          .eq("active_status", true);
        const map: Record<string, { id: string; name: string }[]> = {};
        for (const a of (assigns || []) as MatterAssignment[]) {
          const role = (a.assignment_role || "").toLowerCase();
          const isParalegal =
            role.includes("paralegal") || role.includes("legal assistant");
          if (!isParalegal || !a.user_id) continue;
          const name = a.profiles?.full_name || "Paralegal";
          if (!map[a.matter_id]) map[a.matter_id] = [];
          if (!map[a.matter_id].some((p) => p.id === a.user_id)) {
            map[a.matter_id].push({ id: a.user_id, name });
          }
        }
        // Fallback: any active paralegal profile if matter has none assigned
        if (Object.keys(map).length === 0 || rows.some((m) => !map[m.id]?.length)) {
          const { data: staff } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("role", "paralegal")
            .eq("active_status", true);
          const fallback = ((staff || []) as Profile[]).map((p) => ({
            id: p.id,
            name: p.full_name,
          }));
          for (const m of rows) {
            if (!map[m.id]?.length && fallback.length) {
              map[m.id] = fallback;
            }
          }
        }
        if (!cancelled) setParalegalsByMatter(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const paralegals = matterId ? paralegalsByMatter[matterId] || [] : [];

  useEffect(() => {
    if (!matterId) {
      setParalegalId("");
      return;
    }
    const list = paralegalsByMatter[matterId] || [];
    setParalegalId(list[0]?.id || "");
  }, [matterId, paralegalsByMatter]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const matter = matters.find((m) => m.id === matterId);
    const paralegal = paralegals.find((p) => p.id === paralegalId);
    if (!matter || !paralegal) {
      setError("Select a matter and an assigned paralegal.");
      return;
    }
    if (!instructions.trim()) {
      setError("Describe the documents or information you need from the client.");
      return;
    }
    setSaving(true);
    const client = matter.clients as Client | null | undefined;
    const created = upsertDocumentRequest({
      id: createDocumentRequestId(),
      matterId: matter.id,
      matterNumber: matter.matter_number,
      matterName: matter.matter_name,
      clientId: matter.client_id,
      clientName: clientDisplayName(client),
      attorneyId: profile.id,
      attorneyName: profile.full_name,
      paralegalId: paralegal.id,
      paralegalName: paralegal.name,
      attorneyInstructions: instructions.trim(),
      clientInstructions: instructions.trim(),
      priority,
      status: "pending_paralegal",
      clientDueDate: null,
      clientResponseText: "",
      attachments: [],
      paralegalNotes: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sentToClientAt: null,
      clientSubmittedAt: null,
    });
    setSaving(false);
    setInstructions("");
    setPriority("Normal");
    setMessage(
      `Request sent to ${created.paralegalName} for ${created.clientName} (${created.matterNumber}).`
    );
  }

  return (
    <div className={`card bg-base-100 border border-base-300 shadow-sm ${compact ? "" : ""}`}>
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title text-base">Request documents from a client</h2>
          <p className="text-sm opacity-70">
            Describe what you need. Your request is routed to the matter&apos;s assigned paralegal
            to prepare and send to the client.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm opacity-70">
            <span className="loading loading-spinner loading-sm" /> Loading matters…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="form-grid">
              <label className="label-cell" htmlFor="doc-matter">
                Matter / client
              </label>
              <div className="field-cell">
                <select
                  id="doc-matter"
                  className="select select-bordered w-full"
                  value={matterId}
                  onChange={(e) => setMatterId(e.target.value)}
                  required
                >
                  <option value="">Select a matter…</option>
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.matter_number} · {m.matter_name} —{" "}
                      {clientDisplayName(m.clients as Client)}
                    </option>
                  ))}
                </select>
              </div>

              <label className="label-cell" htmlFor="doc-paralegal">
                Assigned paralegal
              </label>
              <div className="field-cell">
                <select
                  id="doc-paralegal"
                  className="select select-bordered w-full"
                  value={paralegalId}
                  onChange={(e) => setParalegalId(e.target.value)}
                  required
                  disabled={!matterId || paralegals.length === 0}
                >
                  {paralegals.length === 0 ? (
                    <option value="">No paralegal available for this matter</option>
                  ) : (
                    paralegals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <label className="label-cell" htmlFor="doc-priority">
                Priority
              </label>
              <div className="field-cell">
                <select
                  id="doc-priority"
                  className="select select-bordered w-full max-w-xs"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as DocumentRequestPriority)}
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>

              <label className="label-cell" htmlFor="doc-instructions">
                What do you need from the client?
              </label>
              <div className="field-cell">
                <textarea
                  id="doc-instructions"
                  className="textarea textarea-bordered w-full min-h-28"
                  placeholder="Example: Please provide the signed engagement letter, last three bank statements, and a list of known creditors."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-error text-sm">
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="alert alert-success text-sm">
                <span>{message}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving || !matters.length}>
              {saving ? (
                <>
                  <span className="loading loading-spinner loading-sm" /> Sending…
                </>
              ) : (
                "Send to paralegal"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
