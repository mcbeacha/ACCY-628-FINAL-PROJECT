"use client";

import { PageHeader } from "@/components/PageHeader";
import {
  BILLING_ACTIVITIES,
  buildBillingCode,
} from "@/lib/billing-codes";
import {
  EXPENSE_HIGH_VALUE_THRESHOLD,
  EXPENSE_RECEIPT_THRESHOLD,
  TIME_BILLABLE_STATUSES,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  calcBillableAmount,
  calcLaborCost,
  hoursFromTimes,
} from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MatterOpt = { id: string; matter_number: string; matter_name: string; matter_status: string };

export function TimeEntryForm({
  userId,
  showInternalCost,
}: {
  userId: string;
  showInternalCost: boolean;
}) {
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [matterId, setMatterId] = useState("");
  const [activityCode, setActivityCode] = useState("");
  const [billingRate, setBillingRate] = useState(0);
  const [costRate, setCostRate] = useState(0);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hours, setHours] = useState("");
  const [billable, setBillable] = useState("Billable");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    })();
  }, [userId]);

  const selectedMatter = useMemo(
    () => matters.find((m) => m.id === matterId) || null,
    [matters, matterId]
  );

  const billingCode = useMemo(() => {
    if (!selectedMatter?.matter_number || !activityCode) return "";
    return buildBillingCode(selectedMatter.matter_number, activityCode);
  }, [selectedMatter, activityCode]);

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

    const fd = new FormData(e.currentTarget);
    const workDate = String(fd.get("work_date") || "");
    const desc = String(fd.get("billing_description") || "").trim();
    const notes = String(fd.get("internal_notes") || "").trim();
    const h = Number(hours);

    if (!matterId || !workDate) {
      setError("Matter and work date are required.");
      return;
    }
    if (!activityCode || !billingCode) {
      setError("Select an activity so the billing code can be generated.");
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

    const matter = matters.find((m) => m.id === matterId);
    if (matter && ["Canceled", "Closed"].includes(matter.matter_status)) {
      // allow Closed only if partner - server will enforce
    }

    setLoading(true);
    const supabase = createClient();

    // Soft duplicate / overlap warning
    const { data: existing } = await supabase
      .from("time_entries")
      .select("id, start_time, end_time, billing_description, approval_status")
      .eq("employee_id", userId)
      .eq("matter_id", matterId)
      .eq("work_date", workDate)
      .neq("approval_status", "Rejected");

    if (existing?.length) {
      const simDesc = existing.some(
        (x) =>
          x.billing_description &&
          desc &&
          x.billing_description.toLowerCase().includes(desc.slice(0, 12).toLowerCase())
      );
      if (simDesc || existing.length > 0) {
        setWarning(
          "A similar time entry may already exist on this matter and date. Review carefully — definite overlaps are blocked."
        );
      }
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
      billing_code: billingCode,
      billing_description: desc || null,
      internal_notes: notes || null,
      approval_status: submit ? "Submitted" : "Draft",
      invoice_status: "Unbilled",
      locked_status: false,
      created_by: userId,
    };

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

    await supabase.from("financial_activity").insert({
      action_type: submit ? "time_submitted" : "time_created",
      record_type: "time_entry",
      record_id: data.id,
      matter_id: matterId,
      action_description: submit
        ? "Time entry submitted for approval."
        : "Time entry saved as draft.",
      performed_by: userId,
    });

    setMessage(submit ? "Time entry submitted for approval." : "Draft time entry saved.");
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    setMatterId("");
    setActivityCode("");
    setStart("");
    setEnd("");
    setHours("");
    setBillable("Billable");
  }

  return (
    <>
      <PageHeader
        title="Enter Time"
        description="Record billable and nonbillable work. Rates are snapshot onto each entry."
        actions={
          <Link href="/time" className="btn btn-ghost btn-sm">
            My Time
          </Link>
        }
      />

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
              <input id="work_date" name="work_date" type="date" className="input input-bordered w-full" required />
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

            <label className="label-cell" htmlFor="activity_code">
              Activity *
            </label>
            <div className="field-cell">
              <select
                id="activity_code"
                name="activity_code"
                className="select select-bordered w-full"
                required
                value={activityCode}
                onChange={(e) => setActivityCode(e.target.value)}
              >
                <option value="" disabled>
                  Select activity
                </option>
                {BILLING_ACTIVITIES.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="billing_code">
              Billing code
            </label>
            <div className="field-cell">
              <input
                id="billing_code"
                name="billing_code"
                className="input input-bordered w-full font-mono"
                value={billingCode}
                readOnly
                placeholder="Select matter and activity"
                aria-describedby="billing_code_help"
              />
              <p id="billing_code_help" className="text-xs opacity-60 mt-1">
                Auto-built as Matter # + activity code (example: MT-05001-1002).
              </p>
            </div>

            <label className="label-cell" htmlFor="billing_description">
              Billing description {billable === "Billable" ? "*" : ""}
            </label>
            <div className="field-cell">
              <textarea id="billing_description" name="billing_description" className="textarea textarea-bordered w-full" rows={3} />
            </div>

            <label className="label-cell" htmlFor="internal_notes">
              Internal notes
            </label>
            <div className="field-cell">
              <textarea id="internal_notes" name="internal_notes" className="textarea textarea-bordered w-full" rows={2} />
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
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={loading}
              onClick={() => {
                // default form submits as draft via onSubmit(..., false)
              }}
            >
              {loading ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={(ev) => {
                const form = (ev.target as HTMLElement).closest("form");
                if (form) save({ preventDefault() {}, currentTarget: form, target: form } as unknown as FormEvent<HTMLFormElement>, true);
              }}
            >
              Submit for Approval
            </button>
          </div>
        </div>
      </form>
      <p className="text-xs opacity-60 max-w-3xl">
        Receipt threshold for expenses is ${EXPENSE_RECEIPT_THRESHOLD}+. High-value expense review flag starts at $
        {EXPENSE_HIGH_VALUE_THRESHOLD}.
      </p>
    </>
  );
}
