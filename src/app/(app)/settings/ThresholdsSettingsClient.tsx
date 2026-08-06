"use client";

import {
  DEFAULT_FIRM_THRESHOLDS,
  getFirmThresholds,
  type FirmApprovalThresholds,
} from "@/lib/firm-thresholds";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const FIRM_ROW_ID = "e1900000-0000-4000-8000-000000000001";

export function ThresholdsSettingsClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [routine, setRoutine] = useState(String(DEFAULT_FIRM_THRESHOLDS.routineExpenseCostMp));
  const [elevated, setElevated] = useState(String(DEFAULT_FIRM_THRESHOLDS.elevatedExpenseCostMp));
  const [invoice, setInvoice] = useState(String(DEFAULT_FIRM_THRESHOLDS.routineInvoiceMp));
  const [rowId, setRowId] = useState(FIRM_ROW_ID);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warnElevated, setWarnElevated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("firm_approval_thresholds")
        .select("id, routine_expense_cost_mp, elevated_expense_cost_mp, routine_invoice_mp")
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setRoutine(String(Number(data.routine_expense_cost_mp)));
        setElevated(String(Number(data.elevated_expense_cost_mp)));
        setInvoice(String(Number(data.routine_invoice_mp)));
      } else {
        const t = await getFirmThresholds(supabase);
        applyLocal(t);
      }
      setLoading(false);
    })();
  }, []);

  function applyLocal(t: FirmApprovalThresholds) {
    setRoutine(String(t.routineExpenseCostMp));
    setElevated(String(t.elevatedExpenseCostMp));
    setInvoice(String(t.routineInvoiceMp));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const routineN = Number(routine);
    const elevatedN = Number(elevated);
    const invoiceN = Number(invoice);

    if (![routineN, elevatedN, invoiceN].every((n) => Number.isFinite(n) && n > 0)) {
      setError("All thresholds must be positive dollar amounts.");
      return;
    }

    setWarnElevated(elevatedN > routineN);
    setSaving(true);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("firm_approval_thresholds")
      .update({
        routine_expense_cost_mp: routineN,
        elevated_expense_cost_mp: elevatedN,
        routine_invoice_mp: invoiceN,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", rowId);

    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }

    setMessage(
      "Thresholds saved. New expense, cost, and invoice submissions will use these amounts. Items already submitted keep their original routing."
    );
    setSaving(false);
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm opacity-70">Loading thresholds…</p>;
  }

  return (
    <form onSubmit={onSave} className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Approval thresholds</h2>
          <p className="text-sm opacity-70 mt-1">
            Dollar gates for Managing Partner vs Billing approval. Contingency and Personal Injury
            invoices always require Managing Partner. Changes apply to new submissions only.
          </p>
        </div>

        {error && (
          <div role="alert" className="alert alert-error text-sm">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="alert alert-success text-sm">
            {message}
          </div>
        )}
        {warnElevated && (
          <div role="status" className="alert alert-warning text-sm">
            Elevated threshold is higher than the routine threshold. That is allowed but unusual.
          </div>
        )}

        <label className="form-control w-full max-w-sm">
          <span className="label-text font-medium">Routine expense / cost → Managing Partner</span>
          <span className="label-text-alt opacity-60 mb-1">
            Billing may approve below this amount on non-Contingency / non-PI matters.
          </span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            className="input input-bordered"
            value={routine}
            onChange={(e) => setRoutine(e.target.value)}
            required
          />
        </label>

        <label className="form-control w-full max-w-sm">
          <span className="label-text font-medium">
            Elevated expense / cost → Managing Partner
          </span>
          <span className="label-text-alt opacity-60 mb-1">
            Contingency fee or Personal Injury matters.
          </span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            className="input input-bordered"
            value={elevated}
            onChange={(e) => setElevated(e.target.value)}
            required
          />
        </label>

        <label className="form-control w-full max-w-sm">
          <span className="label-text font-medium">Routine invoice → Managing Partner</span>
          <span className="label-text-alt opacity-60 mb-1">
            Billing may approve below this amount (not self-prepared). Elevated invoices always MP.
          </span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            className="input input-bordered"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            required
          />
        </label>

        <div className="card-actions justify-start">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save thresholds"}
          </button>
        </div>
      </div>
    </form>
  );
}
