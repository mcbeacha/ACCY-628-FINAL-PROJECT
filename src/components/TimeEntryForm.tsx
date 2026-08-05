"use client";

import { PageHeader } from "@/components/PageHeader";
import { TIME_BILLABLE_STATUSES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  calcBillableAmount,
  calcLaborCost,
  hoursFromTimes,
  type TimeEntry,
} from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MatterOpt = { id: string; matter_number: string; matter_name: string; matter_status: string };

export function TimeEntryForm({
  userId,
  showInternalCost,
  editId,
  defaultMatterId,
}: {
  userId: string;
  showInternalCost: boolean;
  editId?: string;
  defaultMatterId?: string;
}) {
  const router = useRouter();
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [billingRate, setBillingRate] = useState(0);
  const [costRate, setCostRate] = useState(0);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hours, setHours] = useState("");
  const [billable, setBillable] = useState("Billable");
  const [matterId, setMatterId] = useState(defaultMatterId || "");
  const [workDate, setWorkDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [outOfScope, setOutOfScope] = useState(false);
  const [outOfScopeReason, setOutOfScopeReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(!editId);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: m }, { data: rates }] = await Promise.all([
        supabase
          .from("matters")
          .select("id, matter_number, matter_name, matter_status")
          .order("matter_number"),
        supabase
          .from("employee_rates")
          .select("billing_rate, internal_cost_rate")
          .eq("user_id", userId)
          .eq("active_status", true)
          .order("effective_start_date", { ascending: false })
          .limit(1),
      ]);
      setMatters((m || []) as MatterOpt[]);
      if (rates?.[0]) {
        setBillingRate(Number(rates[0].billing_rate));
        setCostRate(Number(rates[0].internal_cost_rate));
      }

      if (editId) {
        const { data: entry, error: loadErr } = await supabase
          .from("time_entries")
          .select("*")
          .eq("id", editId)
          .eq("employee_id", userId)
          .maybeSingle();
        if (loadErr || !entry) {
          setError(loadErr?.message || "Time entry not found or not editable.");
          setReady(true);
          return;
        }
        const row = entry as TimeEntry;
        if (!["Draft", "Rejected"].includes(row.approval_status) || row.locked_status) {
          setError("Only unlocked Draft or Rejected entries can be edited.");
          setReady(true);
          return;
        }
        setMatterId(row.matter_id);
        setWorkDate(row.work_date);
        setStart(row.start_time ? String(row.start_time).slice(0, 5) : "");
        setEnd(row.end_time ? String(row.end_time).slice(0, 5) : "");
        setHours(String(row.hours));
        setBillable(row.billable_status);
        setDescription(row.billing_description || "");
        setNotes(row.internal_notes || "");
        setOutOfScope(Boolean(row.out_of_scope));
        setOutOfScopeReason(row.out_of_scope_reason || "");
        setRejectionReason(row.rejection_reason);
        setBillingRate(Number(row.billing_rate) || Number(rates?.[0]?.billing_rate) || 0);
        setCostRate(Number(row.internal_cost_rate) || Number(rates?.[0]?.internal_cost_rate) || 0);
      }
      setReady(true);
    })();
  }, [userId, editId]);

  const calcHours = useMemo(() => {
    const fromTimes = hoursFromTimes(start, end);
    if (fromTimes !== null) return fromTimes;
    const h = Number(hours);
    return Number.isFinite(h) ? h : 0;
  }, [start, end, hours]);

  const billableAmt = calcBillableAmount(calcHours || 0, billingRate, billable);
  const laborCost = calcLaborCost(calcHours || 0, costRate);

  useEffect(() => {
    const fromTimes = hoursFromTimes(start, end);
    if (fromTimes !== null) setHours(String(fromTimes));
  }, [start, end]);

  async function save(e: FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setMessage(null);

    const h = Number(hours);
    const desc = description.trim();

    if (!matterId || !workDate) {
      setError("Matter and work date are required.");
      return;
    }
    if (!h || h <= 0 || h > 24) {
      setError("Hours must be greater than 0 and at most 24.");
      return;
    }
    if (billable === "Billable" && !desc) {
      setError("Billable entries require a billing description.");
      return;
    }
    if (outOfScope && !outOfScopeReason.trim()) {
      setError("Explain why this work is outside the original assignment.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    let q = supabase
      .from("time_entries")
      .select("id, start_time, end_time, billing_description, approval_status")
      .eq("employee_id", userId)
      .eq("matter_id", matterId)
      .eq("work_date", workDate)
      .neq("approval_status", "Rejected");
    if (editId) q = q.neq("id", editId);

    const { data: existing } = await q;
    if (existing?.length) {
      setWarning(
        "A similar time entry may already exist on this matter and date. Review carefully — definite overlaps are blocked."
      );
    }

    const payload = {
      matter_id: matterId,
      employee_id: userId,
      work_date: workDate,
      start_time: start || null,
      end_time: end || null,
      hours: h,
      billing_rate: billingRate,
      internal_cost_rate: costRate,
      billable_status: billable,
      billing_description: desc || null,
      internal_notes: notes.trim() || null,
      out_of_scope: outOfScope,
      out_of_scope_reason: outOfScope ? outOfScopeReason.trim() : null,
      approval_status: submit ? "Submitted" : "Draft",
      invoice_status: "Unbilled",
      locked_status: false,
      rejection_reason: submit ? null : editId ? rejectionReason : null,
      created_by: userId,
    };

    let entryId = editId;
    if (editId) {
      const { error: upErr } = await supabase.from("time_entries").update(payload).eq("id", editId);
      if (upErr) {
        setError(upErr.message);
        setLoading(false);
        return;
      }
    } else {
      const { data, error: insErr } = await supabase
        .from("time_entries")
        .insert(payload)
        .select("id")
        .single();
      if (insErr) {
        setError(insErr.message);
        setLoading(false);
        return;
      }
      entryId = data.id;
    }

    await supabase.from("financial_activity").insert({
      action_type: editId
        ? submit
          ? "time_resubmitted"
          : "time_updated"
        : submit
          ? "time_submitted"
          : "time_created",
      record_type: "time_entry",
      record_id: entryId,
      matter_id: matterId,
      action_description: editId
        ? submit
          ? outOfScope
            ? "Corrected out-of-scope time resubmitted — attorney approval required before billing."
            : "Corrected time entry resubmitted for approval."
          : "Draft time entry updated."
        : submit
          ? outOfScope
            ? "Out-of-scope time submitted — attorney approval required before billing."
            : "Time entry submitted for approval."
          : "Time entry saved as draft.",
      performed_by: userId,
    });

    setMessage(
      editId
        ? submit
          ? outOfScope
            ? "Resubmitted. Out-of-scope work needs attorney approval before it can be billed."
            : "Corrected entry resubmitted for approval."
          : "Draft updated."
        : submit
          ? outOfScope
            ? "Submitted. Flagged as additional work — attorney approval required before billing."
            : "Time entry submitted for approval."
          : "Draft time entry saved."
    );
    setLoading(false);

    if (editId) {
      router.push(submit ? "/time?status=Submitted" : "/time?status=Draft");
      router.refresh();
      return;
    }

    setStart("");
    setEnd("");
    setHours("");
    setBillable("Billable");
    setMatterId("");
    setWorkDate("");
    setDescription("");
    setNotes("");
    setOutOfScope(false);
    setOutOfScopeReason("");
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={editId ? "Edit & Resubmit Time" : "Enter Time"}
        description={
          editId
            ? "Correct a Draft or Rejected entry, then save or resubmit for approval."
            : "Record billable and nonbillable work. Rates are snapshot onto each entry."
        }
        actions={
          <Link href="/time" className="btn btn-ghost btn-sm">
            My Time
          </Link>
        }
      />

      {rejectionReason && (
        <div className="alert alert-error text-sm max-w-3xl mb-4">
          <span>
            <strong>Rejection reason:</strong> {rejectionReason}
          </span>
        </div>
      )}

      <form
        className="card bg-base-100 border border-base-300 shadow-sm max-w-3xl"
        onSubmit={(e) => save(e, false)}
      >
        <div className="card-body space-y-4">
          <div className="form-grid">
            <label className="label-cell" htmlFor="matter_id">
              Matter *
            </label>
            <div className="field-cell">
              <select
                id="matter_id"
                name="matter_id"
                className="select select-bordered w-full"
                required
                value={matterId}
                onChange={(e) => setMatterId(e.target.value)}
              >
                <option value="" disabled>
                  Select assigned matter
                </option>
                {matters
                  .filter((m) => m.matter_status !== "Canceled")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.matter_number} · {m.matter_name} ({m.matter_status})
                    </option>
                  ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="work_date">
              Work date *
            </label>
            <div className="field-cell">
              <input
                id="work_date"
                name="work_date"
                type="date"
                className="input input-bordered w-full"
                required
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>

            <label className="label-cell" htmlFor="start_time">
              Start time
            </label>
            <div className="field-cell">
              <input
                id="start_time"
                type="time"
                className="input input-bordered w-full"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <label className="label-cell" htmlFor="end_time">
              End time
            </label>
            <div className="field-cell">
              <input
                id="end_time"
                type="time"
                className="input input-bordered w-full"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>

            <label className="label-cell" htmlFor="hours">
              Hours *
            </label>
            <div className="field-cell">
              <input
                id="hours"
                className="input input-bordered w-full"
                type="number"
                min="0.01"
                max="24"
                step="0.01"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
              <p className="text-xs opacity-60 mt-1">Auto-fills from start/end when both are set.</p>
            </div>

            <label className="label-cell" htmlFor="billable_status">
              Billable status
            </label>
            <div className="field-cell">
              <select
                id="billable_status"
                className="select select-bordered w-full"
                value={billable}
                onChange={(e) => setBillable(e.target.value)}
              >
                {TIME_BILLABLE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="billing_description">
              Billing description {billable === "Billable" ? "*" : ""}
            </label>
            <div className="field-cell">
              <textarea
                id="billing_description"
                name="billing_description"
                className="textarea textarea-bordered w-full"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <label className="label-cell" htmlFor="internal_notes">
              Internal notes
            </label>
            <div className="field-cell">
              <textarea
                id="internal_notes"
                name="internal_notes"
                className="textarea textarea-bordered w-full"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <span className="label-cell">Scope control</span>
            <div className="field-cell space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-0.5"
                  checked={outOfScope}
                  onChange={(e) => setOutOfScope(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-semibold">Additional work not in original assignment</span>
                  <span className="block opacity-70 mt-0.5">
                    Unauthorized / ad hoc work cannot be billed until an attorney approves it.
                  </span>
                </span>
              </label>
              {outOfScope && (
                <div>
                  <label className="label-text text-sm font-semibold" htmlFor="out_of_scope_reason">
                    Why is this outside the assignment? *
                  </label>
                  <textarea
                    id="out_of_scope_reason"
                    className="textarea textarea-bordered w-full mt-1"
                    rows={2}
                    value={outOfScopeReason}
                    onChange={(e) => setOutOfScopeReason(e.target.value)}
                    placeholder="Example: Client asked for an urgent records pull not on the intake checklist."
                    required
                  />
                  <div className="alert alert-warning text-sm mt-2 py-2">
                    <span>
                      Submitting this flag routes the entry for attorney approval before billing
                      (invoice prep only includes Approved time).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-base-200 p-3">
              <p className="text-xs opacity-60">Billing rate snapshot</p>
              <p className="font-semibold">{formatCurrency(billingRate)}/hr</p>
            </div>
            <div className="rounded-lg bg-base-200 p-3">
              <p className="text-xs opacity-60">Billable amount (not revenue)</p>
              <p className="font-semibold">{formatCurrency(billableAmt)}</p>
            </div>
            {showInternalCost && (
              <div className="rounded-lg bg-base-200 p-3">
                <p className="text-xs opacity-60">Internal labor cost</p>
                <p className="font-semibold">{formatCurrency(laborCost)}</p>
              </div>
            )}
          </div>

          {warning && (
            <div className="alert alert-warning text-sm">
              <span>{warning}</span>
            </div>
          )}
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

          <div className="flex flex-wrap gap-2 justify-end">
            <button type="submit" className="btn btn-ghost" disabled={loading}>
              {loading ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={(ev) => {
                const form = (ev.target as HTMLElement).closest("form");
                if (form)
                  save(
                    {
                      preventDefault() {},
                      currentTarget: form,
                      target: form,
                    } as unknown as FormEvent<HTMLFormElement>,
                    true
                  );
              }}
            >
              {editId ? "Resubmit for Approval" : "Submit for Approval"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
