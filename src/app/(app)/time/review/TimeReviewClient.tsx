"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { calcBillableAmount, calcLaborCost, type TimeEntry } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function TimeReviewClient({ userId }: { userId: string }) {
  const [rows, setRows] = useState<TimeEntry[]>([]);
  const [status, setStatus] = useState("Submitted");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    let q = supabase
      .from("time_entries")
      .select("*, matters(id, matter_number, matter_name), employee:profiles!time_entries_employee_id_fkey(full_name)")
      .order("work_date", { ascending: false });
    if (status) q = q.eq("approval_status", status);
    const { data } = await q;
    setRows((data || []) as TimeEntry[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function decide(row: TimeEntry, decision: "Approved" | "Rejected") {
    let reason: string | null = null;
    if (decision === "Rejected") {
      reason = window.prompt("Rejection reason (required):");
      if (!reason?.trim()) {
        setError("A rejection reason is required.");
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
          ? `Time entry approved (${row.hours} hrs).`
          : `Time entry rejected: ${reason}`,
      performed_by: userId,
    });

    setMessage(`Entry ${decision.toLowerCase()}.`);
    setBusy(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Time Review"
        description="Approve or reject submitted time entries. Approver and timestamp are recorded automatically."
      />
      <div className="flex flex-wrap gap-2 items-center">
        <select className="select select-bordered select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["Submitted", "Approved", "Rejected", "Draft", ""].map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All"}
            </option>
          ))}
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
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-sm">{formatDate(r.work_date)}</td>
                    <td className="text-sm">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(r as any).employee?.full_name || "—"}
                    </td>
                    <td className="text-sm">{r.matters?.matter_number}</td>
                    <td>{r.hours}</td>
                    <td className="text-sm">
                      {formatCurrency(calcBillableAmount(Number(r.hours), Number(r.billing_rate), r.billable_status))}
                    </td>
                    <td className="text-sm">
                      {formatCurrency(calcLaborCost(Number(r.hours), Number(r.internal_cost_rate)))}
                    </td>
                    <td>
                      <StatusBadge status={r.approval_status} />
                    </td>
                    <td className="text-sm max-w-[14rem]">
                      {r.billing_description}
                      {r.rejection_reason && (
                        <div className="text-xs text-error mt-1">{r.rejection_reason}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.approval_status === "Submitted" && (
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
