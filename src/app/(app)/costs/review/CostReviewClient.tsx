"use client";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import {
  approvalBadgeLabel,
  viewerCanApprove,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import type { MatterCostEntry } from "@/lib/cost-types";
import {
  DEFAULT_FIRM_THRESHOLDS,
  getFirmThresholds,
  type FirmApprovalThresholds,
} from "@/lib/firm-thresholds";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

type CostRow = MatterCostEntry & {
  matters?: ApprovalMatterContext & {
    id?: string;
    matter_number?: string;
    matter_name?: string;
  } | null;
  required_approver_role?: string | null;
};

export function CostReviewClient({ userId, role }: { userId: string; role: UserRole }) {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thresholds, setThresholds] = useState<FirmApprovalThresholds>(DEFAULT_FIRM_THRESHOLDS);

  async function load() {
    const supabase = createClient();
    const firmThresholds = await getFirmThresholds(supabase);
    setThresholds(firmThresholds);
    let q = supabase
      .from("matter_cost_entries")
      .select(
        "*, matters(id, matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), cost_categories(category_name), vendors(vendor_name), creator:profiles!matter_cost_entries_created_by_fkey(full_name)"
      )
      .order("cost_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    const { data } = await q;
    setRows((data || []) as CostRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function rowGate(row: CostRow) {
    return viewerCanApprove({
      kind: "cost",
      viewerRole: role,
      viewerId: userId,
      matter: row.matters,
      amount: Number(row.total_cost),
      preparerId: row.created_by,
      thresholds,
      stampedRequiredRole: row.required_approver_role,
    });
  }

  async function decide(row: CostRow, decision: "Approved" | "Rejected") {
    const gate = rowGate(row);
    if (!gate.allowed) {
      setError(gate.blockedReason || gate.decision.reason);
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
        description="Billing approves routine costs under threshold; Contingency / Personal Injury and high-value costs escalate to the Managing Partner. You cannot approve a cost you submitted."
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
                  const gate = rowGate(r);
                  const isOwnSubmission = r.created_by === userId;
                  return (
                    <tr key={r.id} className={r.self_approval_flag ? "bg-warning/5" : ""}>
                      <td className="text-sm">{formatDate(r.cost_date)}</td>
                      <td className="text-sm">{r.matters?.matter_number}</td>
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
                        {Number(r.total_cost) >= thresholds.routineExpenseCostMp && (
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
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={r.approval_status} />
                          {r.self_approval_flag && (
                            <span className="badge badge-warning badge-xs">Self</span>
                          )}
                          {r.approval_status === "Submitted" && (
                            <span className="badge badge-ghost badge-sm">
                              {approvalBadgeLabel(gate.decision)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {r.approval_status === "Submitted" && gate.allowed && (
                          <div className="flex flex-wrap gap-1 items-center">
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
