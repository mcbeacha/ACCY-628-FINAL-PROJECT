"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import {
  approvalBadgeLabel,
  viewerCanApprove,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExpenseEntry } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

type ExpenseRow = ExpenseEntry & {
  matters?: ApprovalMatterContext & {
    id?: string;
    matter_number?: string;
    matter_name?: string;
  } | null;
  creator?: { full_name?: string } | null;
};

export function ExpenseReviewClient({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    let q = supabase
      .from("expense_entries")
      .select(
        "*, matters(id, matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), creator:profiles!expense_entries_created_by_fkey(full_name)"
      )
      .order("expense_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    const { data } = await q;
    setRows((data || []) as ExpenseRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function rowGate(row: ExpenseRow) {
    return viewerCanApprove({
      kind: "expense",
      viewerRole: role,
      viewerId: userId,
      matter: row.matters,
      amount: Number(row.amount),
      preparerId: row.created_by,
    });
  }

  async function decide(row: ExpenseRow, decision: "Approved" | "Rejected") {
    const gate = rowGate(row);
    if (!gate.allowed) {
      setError(gate.blockedReason || gate.decision.reason);
      return;
    }

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
        description="Billing approves routine expenses under threshold; Contingency / Personal Injury and high-value items escalate to the Managing Partner."
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
                {rows.map((r) => {
                  const gate = rowGate(r);
                  return (
                    <tr key={r.id}>
                      <td className="text-sm">{formatDate(r.expense_date)}</td>
                      <td className="text-sm">{r.creator?.full_name || "—"}</td>
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
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={r.approval_status} />
                          {r.approval_status === "Submitted" && (
                            <span className="badge badge-ghost badge-sm">
                              {approvalBadgeLabel(gate.decision)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm max-w-[12rem]">
                        {r.description}
                        {!r.receipt_reference && Number(r.amount) >= 75 && (
                          <div className="text-xs text-warning">Missing receipt ref</div>
                        )}
                      </td>
                      <td>
                        {r.approval_status === "Submitted" && gate.allowed && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn btn-success btn-xs"
                              disabled={busy}
                              onClick={() => decide(r, "Approved")}
                            >
                              Approve
                            </button>
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
                        {r.approval_status === "Submitted" && !gate.allowed && (
                          <span className="text-xs opacity-60 max-w-[9rem] inline-block">
                            {gate.blockedReason}
                          </span>
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
