"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import {
  approvalBadgeLabel,
  viewerCanApprove,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import { formatCurrency, formatDate } from "@/lib/format";
import { calcBillableAmount, calcLaborCost, type TimeEntry } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

type TimeRow = TimeEntry & {
  matters?: ApprovalMatterContext & {
    id?: string;
    matter_number?: string;
    matter_name?: string;
  } | null;
  employee?: { full_name?: string } | null;
};

export function TimeReviewClient({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [rows, setRows] = useState<TimeRow[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [scopeFilter, setScopeFilter] = useState<"all" | "oos" | "in">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    let q = supabase
      .from("time_entries")
      .select(
        "*, matters(id, matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), employee:profiles!time_entries_employee_id_fkey(full_name)"
      )
      .order("work_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    if (scopeFilter === "oos") q = q.eq("out_of_scope", true);
    if (scopeFilter === "in") q = q.eq("out_of_scope", false);
    const { data } = await q;
    setRows((data || []) as TimeRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, scopeFilter]);

  function rowGate(row: TimeRow) {
    return viewerCanApprove({
      kind: "time",
      viewerRole: role,
      viewerId: userId,
      matter: row.matters,
      amount: calcBillableAmount(
        Number(row.hours),
        Number(row.billing_rate),
        row.billable_status
      ),
    });
  }

  async function decide(row: TimeRow, decision: "Approved" | "Rejected") {
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
    } else if (row.out_of_scope) {
      if (
        !window.confirm(
          "Authorize this additional / out-of-scope work for billing?\n\nApproving confirms attorney authorization that the work was not in the original assignment but may be billed."
        )
      ) {
        return;
      }
    } else if (!window.confirm("Approve this time entry?")) {
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("time_entries")
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
      action_type: decision === "Approved" ? "time_approved" : "time_rejected",
      record_type: "time_entry",
      record_id: row.id,
      matter_id: row.matter_id,
      action_description:
        decision === "Approved"
          ? row.out_of_scope
            ? `Out-of-scope time authorized for billing (${row.hours} hrs). Reason: ${row.out_of_scope_reason || "—"}`
            : `Time entry approved (${row.hours} hrs).`
          : `Time entry rejected: ${reason}`,
      performed_by: userId,
    });

    setMessage(
      decision === "Approved" && row.out_of_scope
        ? "Out-of-scope work authorized for billing."
        : `Entry ${decision.toLowerCase()}.`
    );
    setBusy(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Time Review/Out-of-Scope"
        description="Approve or reject submitted time. Attorneys review their responsible matters; Contingency / PI time still routes to the responsible attorney first."
      />
      <div className="flex flex-wrap gap-2 items-center">
        <select className="select select-bordered select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["Submitted", "Approved", "Rejected", "Draft", ""].map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as "all" | "oos" | "in")}
        >
          <option value="all">All scope</option>
          <option value="oos">Out-of-scope only</option>
          <option value="in">In-scope only</option>
        </select>
      </div>
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
        <EmptyState title="No time entries for this filter." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Matter</th>
                  <th>Hours</th>
                  <th>Billable</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const gate = rowGate(r);
                  return (
                    <tr key={r.id} className={r.out_of_scope ? "bg-warning/10" : undefined}>
                      <td className="text-sm">{formatDate(r.work_date)}</td>
                      <td className="text-sm">{r.employee?.full_name || "—"}</td>
                      <td className="text-sm">{r.matters?.matter_number}</td>
                      <td>{r.hours}</td>
                      <td className="text-sm">
                        {formatCurrency(
                          calcBillableAmount(
                            Number(r.hours),
                            Number(r.billing_rate),
                            r.billable_status
                          )
                        )}
                      </td>
                      <td className="text-sm">
                        {formatCurrency(
                          calcLaborCost(Number(r.hours), Number(r.internal_cost_rate))
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={r.approval_status} />
                          {r.out_of_scope && (
                            <span className="badge badge-warning badge-sm whitespace-nowrap">
                              Out of scope
                            </span>
                          )}
                          {r.approval_status === "Submitted" && (
                            <span className="badge badge-ghost badge-sm">
                              {approvalBadgeLabel(gate.decision)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm max-w-[16rem]">
                        {r.billing_description}
                        {r.out_of_scope && r.out_of_scope_reason && (
                          <div className="text-xs mt-1 opacity-80">
                            <span className="font-semibold">Ad hoc reason:</span>{" "}
                            {r.out_of_scope_reason}
                          </div>
                        )}
                        {r.rejection_reason && (
                          <div className="text-xs text-error mt-1">{r.rejection_reason}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {r.approval_status === "Submitted" && gate.allowed && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className={`btn btn-xs ${r.out_of_scope ? "btn-warning" : "btn-success"}`}
                              disabled={busy}
                              onClick={() => decide(r, "Approved")}
                            >
                              {r.out_of_scope ? "Authorize" : "Approve"}
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
                          <span className="text-xs opacity-60 max-w-[8rem] inline-block">
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
