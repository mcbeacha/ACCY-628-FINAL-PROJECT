"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import {
  approvalBadgeLabel,
  expenseRequiredApproverRole,
  viewerCanApprove,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import {
  DEFAULT_FIRM_THRESHOLDS,
  getFirmThresholds,
  type FirmApprovalThresholds,
} from "@/lib/firm-thresholds";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExpenseEntry } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type ExpenseRow = ExpenseEntry & {
  matters?: ApprovalMatterContext & {
    id?: string;
    matter_number?: string;
    matter_name?: string;
  } | null;
  creator?: { full_name?: string } | null;
  required_approver_role?: string | null;
};

type ScopeFilter = "my_queue" | "firm_wide";

export function ExpenseReviewClient({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [scope, setScope] = useState<ScopeFilter>("my_queue");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thresholds, setThresholds] = useState<FirmApprovalThresholds>(DEFAULT_FIRM_THRESHOLDS);

  const isPartner = role === "managing_partner";
  const isBilling = role === "billing_staff";

  async function load() {
    const supabase = createClient();
    setError(null);
    const firmThresholds = await getFirmThresholds(supabase);
    setThresholds(firmThresholds);

    // Do not embed profiles via expense_entries_created_by_fkey — that FK points at
    // auth.users, not profiles, and PostgREST fails the whole select.
    let q = supabase
      .from("expense_entries")
      .select(
        "*, matters(id, matter_number, matter_name, billing_method, practice_area, responsible_attorney_id)"
      )
      .order("expense_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    const { data, error: loadErr } = await q;
    if (loadErr) {
      setError(loadErr.message);
      setRows([]);
      return;
    }

    const entries = (data || []) as ExpenseRow[];
    const creatorIds = [
      ...new Set(entries.map((e) => e.created_by).filter(Boolean) as string[]),
    ];
    const nameById = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);
      for (const p of profiles || []) {
        nameById.set(p.id, p.full_name || "—");
      }
    }

    setRows(
      entries.map((e) => ({
        ...e,
        creator: e.created_by
          ? { full_name: nameById.get(e.created_by) || "—" }
          : null,
      }))
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const visibleRows = useMemo(() => {
    if (scope === "firm_wide") return rows;
    return rows.filter((row) => {
      const required = expenseRequiredApproverRole({
        matter: row.matters,
        amount: Number(row.amount),
        thresholds,
        stampedRequiredRole: row.required_approver_role,
      });
      if (isPartner) return required === "managing_partner";
      if (isBilling) {
        // Billing queue: billing-routed items they did not submit themselves
        return required === "billing_staff" && row.created_by !== userId;
      }
      return true;
    });
  }, [rows, scope, thresholds, isPartner, isBilling, userId]);

  function rowGate(row: ExpenseRow) {
    return viewerCanApprove({
      kind: "expense",
      viewerRole: role,
      viewerId: userId,
      matter: row.matters,
      amount: Number(row.amount),
      preparerId: row.created_by,
      thresholds,
      stampedRequiredRole: row.required_approver_role,
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

  const queueLabel = isPartner
    ? "Requires Managing Partner"
    : isBilling
      ? "Billing queue"
      : "My queue";

  const hintParts = [
    status ? status.toLowerCase() : "all statuses",
    scope === "firm_wide" ? "firm-wide" : queueLabel.toLowerCase(),
    `${visibleRows.length} shown`,
  ];

  return (
    <>
      <PageHeader
        title="Expense Review"
        description={
          isPartner
            ? "Default view is expenses that require Managing Partner approval. Switch to Firm-wide expenses to see every firm expense."
            : "Billing approves routine expenses under threshold; Contingency / Personal Injury and high-value items escalate to the Managing Partner."
        }
      />
      <FilterToolbar hint={hintParts.join(" · ")}>
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
        <FilterField label="Scope" className="w-full sm:w-56">
          <select
            className="select select-bordered select-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeFilter)}
            aria-label="Expense review scope"
          >
            <option value="my_queue">{queueLabel}</option>
            <option value="firm_wide">Firm-wide expenses</option>
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
      {visibleRows.length === 0 ? (
        <EmptyState
          title={
            scope === "my_queue" && isPartner
              ? "No expenses require Managing Partner right now."
              : "No expenses for this filter."
          }
        />
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
                {visibleRows.map((r) => {
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
