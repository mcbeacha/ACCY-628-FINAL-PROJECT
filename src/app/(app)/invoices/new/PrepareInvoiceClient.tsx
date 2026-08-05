"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { calcBillableAmount } from "@/lib/phase2-types";
import { formatCurrency, formatDate } from "@/lib/format";
import { FINANCE_NOTICE } from "@/lib/billing-types";
import {
  DUPLICATE_INVOICE_NUMBER_MESSAGE,
  isDuplicateInvoiceNumberError,
} from "@/lib/invoice-controls";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseEntry, TimeEntry } from "@/lib/phase2-types";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MatterRow = {
  id: string;
  matter_number: string;
  matter_name: string;
  client_id: string;
  matter_status: string;
  approval_status: string;
  engagement_start_date: string | null;
  payment_terms_days: number | null;
  billing_method: string | null;
};

const HIGH_VALUE = 5000;

export function PrepareInvoiceClient({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const router = useRouter();
  const [matters, setMatters] = useState<MatterRow[]>([]);
  const [matterId, setMatterId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [fixedFee, setFixedFee] = useState("");
  const [fixedDesc, setFixedDesc] = useState("Authorized fixed-fee installment");
  const [timeRows, setTimeRows] = useState<TimeEntry[]>([]);
  const [expRows, setExpRows] = useState<ExpenseEntry[]>([]);
  const [selTime, setSelTime] = useState<Record<string, boolean>>({});
  const [selExp, setSelExp] = useState<Record<string, boolean>>({});
  const [writeDowns, setWriteDowns] = useState<Record<string, string>>({});
  const [retainerBal, setRetainerBal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("matters")
        .select(
          "id, matter_number, matter_name, client_id, matter_status, approval_status, engagement_start_date, payment_terms_days, billing_method"
        )
        .in("approval_status", ["Approved"])
        .in("matter_status", ["Active", "Approved", "Closed"])
        .order("matter_number");
      setMatters((data || []) as MatterRow[]);
    })();
  }, []);

  useEffect(() => {
    if (!matterId) {
      setTimeRows([]);
      setExpRows([]);
      setRetainerBal(null);
      return;
    }
    const m = matters.find((x) => x.id === matterId);
    if (m && !dueDate) {
      const terms = m.payment_terms_days || 30;
      const d = new Date(`${invoiceDate}T00:00:00`);
      d.setDate(d.getDate() + terms);
      setDueDate(d.toISOString().slice(0, 10));
    }
    (async () => {
      const supabase = createClient();
      let tq = supabase
        .from("time_entries")
        .select("*")
        .eq("matter_id", matterId)
        .eq("approval_status", "Approved")
        .eq("invoice_status", "Unbilled")
        .eq("billable_status", "Billable")
        .order("work_date");
      let eq = supabase
        .from("expense_entries")
        .select("*")
        .eq("matter_id", matterId)
        .eq("approval_status", "Approved")
        .eq("client_reimbursable", true)
        .eq("invoice_status", "Unbilled")
        .order("expense_date");
      if (periodStart) {
        tq = tq.gte("work_date", periodStart);
        eq = eq.gte("expense_date", periodStart);
      }
      if (periodEnd) {
        tq = tq.lte("work_date", periodEnd);
        eq = eq.lte("expense_date", periodEnd);
      }
      const [{ data: t }, { data: e }, { data: ra }] = await Promise.all([
        tq,
        eq,
        supabase
          .from("retainer_accounts")
          .select("current_balance")
          .eq("matter_id", matterId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setTimeRows((t || []) as TimeEntry[]);
      setExpRows((e || []) as ExpenseEntry[]);
      setRetainerBal(ra ? Number(ra.current_balance) : null);
      setSelTime({});
      setSelExp({});
      setWriteDowns({});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId, periodStart, periodEnd, matters, invoiceDate]);

  const preview = useMemo(() => {
    let timeOrig = 0;
    let timeFinal = 0;
    let expTotal = 0;
    let wd = 0;
    for (const r of timeRows) {
      if (!selTime[r.id]) continue;
      const orig = calcBillableAmount(Number(r.hours), Number(r.billing_rate), r.billable_status);
      const down = Math.min(Number(writeDowns[r.id] || 0) || 0, orig);
      timeOrig += orig;
      wd += down;
      timeFinal += orig - down;
    }
    for (const r of expRows) {
      if (!selExp[r.id]) continue;
      expTotal += Number(r.amount);
    }
    const fixed = Number(fixedFee) || 0;
    const subtotal = timeFinal + expTotal + fixed;
    return { timeOrig, timeFinal, expTotal, fixed, wd, subtotal };
  }, [timeRows, expRows, selTime, selExp, writeDowns, fixedFee]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const m = matters.find((x) => x.id === matterId);
    if (!m) {
      setError("Select a matter.");
      return;
    }
    if (m.matter_status === "Canceled" || m.approval_status === "Rejected") {
      setError("Cannot bill a canceled or rejected matter.");
      return;
    }
    if (m.matter_status === "Closed") {
      if (!window.confirm("This matter is Closed. Continue only for an authorized final invoice?")) {
        return;
      }
    }
    if (!invoiceDate || !dueDate) {
      setError("Invoice date and due date are required.");
      return;
    }
    if (dueDate < invoiceDate) {
      setError("Due date cannot be before the invoice date.");
      return;
    }
    if (m.engagement_start_date && invoiceDate < m.engagement_start_date) {
      if (
        !window.confirm(
          "Invoice date is before the matter engagement start. Only continue if clearly authorized."
        )
      ) {
        return;
      }
    }
    const times = timeRows.filter((r) => selTime[r.id]);
    const exps = expRows.filter((r) => selExp[r.id]);
    const fixed = Number(fixedFee) || 0;
    if (!times.length && !exps.length && fixed <= 0) {
      setError("Select at least one approved unbilled entry or a fixed-fee line.");
      return;
    }
    if (preview.subtotal >= HIGH_VALUE && role === "managing_partner") {
      // partner may prepare — still fine
    }

    setBusy(true);
    const supabase = createClient();
    const requestedNumber = invoiceNumber.trim();
    if (requestedNumber) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .ilike("invoice_number", requestedNumber)
        .limit(1)
        .maybeSingle();
      if (existing) {
        setError(`${DUPLICATE_INVOICE_NUMBER_MESSAGE} Existing number: ${existing.invoice_number}.`);
        setBusy(false);
        return;
      }
    }

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        matter_id: m.id,
        client_id: m.client_id,
        invoice_date: invoiceDate,
        due_date: dueDate,
        billing_period_start: periodStart || null,
        billing_period_end: periodEnd || null,
        invoice_status: "Draft",
        approval_status: "Draft",
        client_message: clientMessage || null,
        internal_notes: internalNotes || null,
        created_by: userId,
        ...(requestedNumber ? { invoice_number: requestedNumber } : {}),
      })
      .select("id, invoice_number")
      .single();

    if (invErr || !inv) {
      setError(
        isDuplicateInvoiceNumberError(invErr?.message)
          ? DUPLICATE_INVOICE_NUMBER_MESSAGE
          : invErr?.message || "Could not create invoice."
      );
      setBusy(false);
      return;
    }

    const lines: Record<string, unknown>[] = [];
    for (const r of times) {
      const orig = calcBillableAmount(Number(r.hours), Number(r.billing_rate), r.billable_status);
      const down = Math.min(Number(writeDowns[r.id] || 0) || 0, orig);
      lines.push({
        invoice_id: inv.id,
        matter_id: m.id,
        line_type: "Time",
        time_entry_id: r.id,
        description: r.billing_description || "Legal services",
        service_date: r.work_date,
        quantity: Number(r.hours),
        unit_rate: Number(r.billing_rate),
        original_amount: orig,
        write_down_amount: down,
        final_amount: orig - down,
      });
      if (down > 0) {
        await supabase.from("billing_adjustments").insert({
          matter_id: m.id,
          invoice_id: inv.id,
          adjustment_type: "Write-Down",
          original_amount: orig,
          adjustment_amount: down,
          adjusted_amount: orig - down,
          reason: "Pre-billing write-down applied during invoice prep",
          approval_status: "Approved",
          requested_by: userId,
          approved_by: userId,
          approved_at: new Date().toISOString(),
        });
      }
    }
    for (const r of exps) {
      lines.push({
        invoice_id: inv.id,
        matter_id: m.id,
        line_type: "Expense",
        expense_entry_id: r.id,
        description: r.description,
        service_date: r.expense_date,
        quantity: 1,
        unit_rate: Number(r.amount),
        original_amount: Number(r.amount),
        write_down_amount: 0,
        final_amount: Number(r.amount),
      });
    }
    if (fixed > 0) {
      lines.push({
        invoice_id: inv.id,
        matter_id: m.id,
        line_type: "Fixed Fee",
        description: fixedDesc || "Fixed fee",
        service_date: invoiceDate,
        quantity: 1,
        unit_rate: fixed,
        original_amount: fixed,
        write_down_amount: 0,
        final_amount: fixed,
      });
    }

    const { error: lineErr } = await supabase.from("invoice_lines").insert(lines);
    if (lineErr) {
      setError(lineErr.message);
      setBusy(false);
      return;
    }

    // Mark source entries selected for billing (not yet Billed)
    const timeIds = times.map((t) => t.id);
    const expIds = exps.map((x) => x.id);
    if (timeIds.length) {
      await supabase
        .from("time_entries")
        .update({ invoice_status: "Selected for Billing", invoice_id: inv.id })
        .in("id", timeIds);
    }
    if (expIds.length) {
      await supabase
        .from("expense_entries")
        .update({ invoice_status: "Selected for Billing", invoice_id: inv.id })
        .in("id", expIds);
    }

    await supabase.rpc("recalc_invoice_totals", { p_invoice_id: inv.id });
    await supabase.from("financial_activity").insert({
      action_type: "invoice_drafted",
      record_type: "invoice",
      record_id: inv.id,
      matter_id: m.id,
      action_description: `Draft invoice ${inv.invoice_number} created.`,
      performed_by: userId,
    });

    setBusy(false);
    router.push(`/invoices/${inv.id}`);
  }

  return (
    <>
      <PageHeader
        title="Prepare Invoice"
        description="Select approved unbilled time and expenses for an active matter. Finals lock lines after approval."
      />
      <div className="alert alert-info text-sm">
        <span>{FINANCE_NOTICE}</span>
      </div>
      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text font-medium">Matter</span>
              <select
                className="select select-bordered"
                value={matterId}
                onChange={(e) => setMatterId(e.target.value)}
                required
              >
                <option value="">Select approved matter…</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_number} · {m.matter_name} ({m.matter_status})
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm opacity-70 self-end">
              Retainer available:{" "}
              <span className="font-semibold">
                {retainerBal == null ? "—" : formatCurrency(retainerBal)}
              </span>{" "}
              (apply after finalization)
            </div>
            <label className="form-control">
              <span className="label-text">Billing period start</span>
              <input
                type="date"
                className="input input-bordered"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Billing period end</span>
              <input
                type="date"
                className="input input-bordered"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Invoice number (optional)</span>
              <input
                className="input input-bordered"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Leave blank to auto-assign"
              />
              <span className="label-text-alt opacity-70">
                Must be unique — duplicates are blocked for Billing Staff.
              </span>
            </label>
            <label className="form-control">
              <span className="label-text">Invoice date</span>
              <input
                type="date"
                className="input input-bordered"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Due date</span>
              <input
                type="date"
                className="input input-bordered"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </label>
            <label className="form-control md:col-span-2">
              <span className="label-text">Client message</span>
              <textarea
                className="textarea textarea-bordered"
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                rows={2}
              />
            </label>
            <label className="form-control md:col-span-2">
              <span className="label-text">Internal notes</span>
              <textarea
                className="textarea textarea-bordered"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
              />
            </label>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Approved unbilled time</h2>
            {timeRows.length === 0 ? (
              <EmptyState title="No eligible time for this matter/period." />
            ) : (
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th />
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Rate</th>
                      <th>Original</th>
                      <th>Write-down</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeRows.map((r) => {
                      const orig = calcBillableAmount(
                        Number(r.hours),
                        Number(r.billing_rate),
                        r.billable_status
                      );
                      return (
                        <tr key={r.id}>
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={!!selTime[r.id]}
                              onChange={(e) =>
                                setSelTime((s) => ({ ...s, [r.id]: e.target.checked }))
                              }
                            />
                          </td>
                          <td>{formatDate(r.work_date)}</td>
                          <td>{r.hours}</td>
                          <td>{formatCurrency(Number(r.billing_rate))}</td>
                          <td>{formatCurrency(orig)}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="input input-bordered input-xs w-24"
                              disabled={!selTime[r.id]}
                              value={writeDowns[r.id] || ""}
                              onChange={(e) =>
                                setWriteDowns((w) => ({ ...w, [r.id]: e.target.value }))
                              }
                            />
                          </td>
                          <td className="max-w-xs truncate">{r.billing_description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Approved unbilled reimbursable expenses</h2>
            {expRows.length === 0 ? (
              <EmptyState title="No eligible expenses for this matter/period." />
            ) : (
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th />
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expRows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!!selExp[r.id]}
                            onChange={(e) =>
                              setSelExp((s) => ({ ...s, [r.id]: e.target.checked }))
                            }
                          />
                        </td>
                        <td>{formatDate(r.expense_date)}</td>
                        <td>{r.expense_type}</td>
                        <td>{formatCurrency(Number(r.amount))}</td>
                        <td className="max-w-xs truncate">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text">Fixed-fee line amount (optional)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input input-bordered"
                value={fixedFee}
                onChange={(e) => setFixedFee(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Fixed-fee description</span>
              <input
                className="input input-bordered"
                value={fixedDesc}
                onChange={(e) => setFixedDesc(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="card bg-base-100 border border-primary/30 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Invoice preview</h2>
            <ul className="text-sm space-y-1">
              <li>Time original: {formatCurrency(preview.timeOrig)}</li>
              <li>Write-downs: {formatCurrency(preview.wd)}</li>
              <li>Time final: {formatCurrency(preview.timeFinal)}</li>
              <li>Expenses: {formatCurrency(preview.expTotal)}</li>
              <li>Fixed fee: {formatCurrency(preview.fixed)}</li>
              <li className="font-semibold">
                Subtotal / invoice total (tax 0): {formatCurrency(preview.subtotal)}
              </li>
            </ul>
            {preview.subtotal >= HIGH_VALUE && (
              <div className="alert alert-warning text-sm mt-2">
                High-value invoice (≥ {formatCurrency(HIGH_VALUE)}). Self-approval will be flagged on
                the detail page.
              </div>
            )}
            <button type="submit" className="btn btn-primary mt-3 w-fit" disabled={busy}>
              {busy ? "Saving…" : "Create draft invoice"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
