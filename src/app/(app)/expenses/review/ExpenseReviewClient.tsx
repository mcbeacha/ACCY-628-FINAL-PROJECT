"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExpenseEntry } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function ExpenseReviewClient({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ExpenseEntry[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    let q = supabase
      .from("expense_entries")
      .select("*, matters(id, matter_number, matter_name), creator:profiles!expense_entries_created_by_fkey(full_name)")
      .order("expense_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    const { data } = await q;
    setRows((data || []) as ExpenseEntry[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function decide(row: ExpenseEntry, decision: "Approved" | "Rejected") {
    let reason: string | null = null;
    if (decision === "Rejected") {
      reason = window.prompt("Rejection reason (required):");
      if (!reason?.trim()) {
        setError("A rejection reason is required.");
        return;
      }
    } else if (!window.confirm("Approve this expense?")) {
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("expense_entries")
      .update({
        approval_status: decision,
        rejection_reason: reason,
      })
      .eq("id", row.id);

    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: decision === "Approved" ? "expense_approved" : "expense_rejected",
      record_type: "expense_entry",
      record_id: row.id,
      matter_id: row.matter_id,
      action_description:
        decision === "Approved"
          ? `Expense approved for ${formatCurrency(Number(row.amount))}.`
          : `Expense rejected: ${reason}`,
      performed_by: userId,
    });

    setMessage(`Expense ${decision.toLowerCase()}.`);
    setBusy(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Expense Review"
        description="Review submitted expenses, including high-value flags and reimbursable status."
      />
      <FilterToolbar hint={status ? `Showing ${status.toLowerCase()} · ${rows.length}` : `${rows.length} shown`}>
        <FilterField label="Status" className="w-full sm:w-44">
          <select
            className="select select-bordered select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["Submitted", "Approved", "Rejected", "Draft", ""].map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterToolbar>
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
        <EmptyState title="No expenses for this filter." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entered by</th>
                  <th>Matter</th>
                  <th>Type</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Reimb.</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-sm">{formatDate(r.expense_date)}</td>
                    <td className="text-sm">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(r as any).creator?.full_name || "—"}
                    </td>
                    <td className="text-sm">{r.matters?.matter_number}</td>
                    <td className="text-sm">{r.expense_type}</td>
                    <td className="text-sm">{r.vendor_name || "—"}</td>
                    <td>
                      {formatCurrency(Number(r.amount))}
                      {r.needs_extra_review && (
                        <span className="badge badge-warning badge-sm ml-1">High value</span>
                      )}
                    </td>
                    <td className="text-sm">{r.client_reimbursable ? "Yes" : "No"}</td>
                    <td>
                      <StatusBadge status={r.approval_status} />
                    </td>
                    <td className="text-sm max-w-[12rem]">
                      {r.description}
                      {!r.receipt_reference && Number(r.amount) >= 75 && (
                        <div className="text-xs text-warning">Missing receipt ref</div>
                      )}
                    </td>
                    <td>
                      {r.approval_status === "Submitted" && (
                        <div className="flex gap-1">
                          <button type="button" className="btn btn-success btn-xs" disabled={busy} onClick={() => decide(r, "Approved")}>
                            Approve
                          </button>
                          <button type="button" className="btn btn-error btn-xs" disabled={busy} onClick={() => decide(r, "Rejected")}>
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
