"use client";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { HIGH_VALUE_COST_THRESHOLD, type MatterCostEntry } from "@/lib/cost-types";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

export function CostReviewClient({ userId }: { userId: string; role: UserRole }) {
  const [rows, setRows] = useState<MatterCostEntry[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    let q = supabase
      .from("matter_cost_entries")
      .select(
        "*, matters(id, matter_number, matter_name), cost_categories(category_name), vendors(vendor_name), creator:profiles!matter_cost_entries_created_by_fkey(full_name)"
      )
      .order("cost_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    const { data } = await q;
    setRows((data || []) as MatterCostEntry[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function decide(row: MatterCostEntry, decision: "Approved" | "Rejected") {
    if (decision === "Approved" && row.created_by === userId) {
      setError(
        "You cannot approve a cost you submitted. Another reviewer must approve it."
      );
      setMessage(null);
      return;
    }

    let notes: string | null = null;
    if (decision === "Rejected") {
      notes = window.prompt("Rejection reason (required):");
      if (!notes?.trim()) {
        setError("A rejection reason is required.");
        return;
      }
    } else {
      notes = window.prompt("Approval notes (optional):") ?? "";
      if (!window.confirm("Approve this cost entry?")) return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("matter_cost_entries")
      .update({
        approval_status: decision,
        approved_by: decision === "Approved" ? userId : null,
        approved_at: decision === "Approved" ? new Date().toISOString() : null,
        approval_notes: decision === "Approved" ? notes || null : null,
        rejection_reason: decision === "Rejected" ? notes : null,
        self_approval_flag: false,
      })
      .eq("id", row.id);

    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: decision === "Approved" ? "cost_approved" : "cost_rejected",
      record_type: "matter_cost_entry",
      record_id: row.id,
      matter_id: row.matter_id,
      client_id: row.client_id,
      action_description:
        decision === "Approved"
          ? `Cost approved for ${formatCurrency(Number(row.total_cost))}.`
          : `Cost rejected: ${notes}`,
      performed_by: userId,
    });

    setMessage(`Cost entry ${decision.toLowerCase()}.`);
    setBusy(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Cost Approval"
        description="Review submitted matter cost entries. You cannot approve a cost you submitted; another Billing Staff or Managing Partner must approve it."
      />

      <select
        className="select select-bordered select-sm w-fit"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        {["Submitted", "Approved", "Rejected", "Draft", ""].map((s) => (
          <option key={s || "all"} value={s}>
            {s || "All"}
          </option>
        ))}
      </select>

      {message && (
        <div className="alert alert-success text-sm">
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No cost entries for this filter." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Matter</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Reimb.</th>
                  <th>Entered by</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOwnSubmission = r.created_by === userId;
                  return (
                    <tr key={r.id} className={r.self_approval_flag ? "bg-warning/5" : ""}>
                      <td className="text-sm">{formatDate(r.cost_date)}</td>
                      <td className="text-sm">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(r as any).matters?.matter_number}
                      </td>
                      <td className="text-sm">{r.cost_source}</td>
                      <td className="text-sm">{r.cost_categories?.category_name || "—"}</td>
                      <td className="text-sm max-w-[12rem]">
                        {r.description}
                        {r.vendors?.vendor_name && (
                          <div className="text-xs opacity-60">{r.vendors.vendor_name}</div>
                        )}
                        {r.is_closing_adjustment && (
                          <span className="badge badge-outline badge-xs ml-1">Closing adj.</span>
                        )}
                      </td>
                      <td>
                        {formatCurrency(Number(r.total_cost))}
                        {Number(r.total_cost) >= HIGH_VALUE_COST_THRESHOLD && (
                          <span className="badge badge-warning badge-sm ml-1">High value</span>
                        )}
                      </td>
                      <td className="text-sm">{r.client_reimbursable ? "Yes" : "No"}</td>
                      <td className="text-sm">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(r as any).creator?.full_name || "—"}
                        {r.approval_status === "Submitted" && isOwnSubmission && (
                          <div className="text-xs text-warning">Awaiting another approver</div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.approval_status} />
                        {r.self_approval_flag && (
                          <span className="badge badge-warning badge-xs ml-1">Self</span>
                        )}
                      </td>
                      <td>
                        {r.approval_status === "Submitted" && (
                          <div className="flex flex-wrap gap-1 items-center">
                            {!isOwnSubmission && (
                              <button
                                type="button"
                                className="btn btn-success btn-xs"
                                disabled={busy}
                                onClick={() => decide(r, "Approved")}
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-error btn-xs"
                              disabled={busy}
                              onClick={() => decide(r, "Rejected")}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
