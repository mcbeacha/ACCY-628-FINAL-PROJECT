"use client";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type OpenInvoice = {
  id: string;
  invoice_number: string;
  balance_due: number;
  matter_id: string;
  matters?: { matter_number: string; matter_name: string } | null;
};

const METHODS = ["Credit Card", "ACH", "Check", "Other"] as const;

export function ClientPayForm({ invoices }: { invoices: OpenInvoice[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = useMemo(
    () => invoices.filter((i) => Number(i.balance_due) > 0),
    [invoices]
  );
  const preferred = searchParams.get("invoice");
  const initialId =
    (preferred && open.some((i) => i.id === preferred) ? preferred : null) ||
    open[0]?.id ||
    "";
  const [invoiceId, setInvoiceId] = useState(initialId);
  const selected = open.find((i) => i.id === invoiceId);
  const [amount, setAmount] = useState(
    selected ? String(Number(selected.balance_due).toFixed(2)) : ""
  );
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Credit Card");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onInvoiceChange(id: string) {
    setInvoiceId(id);
    const inv = open.find((i) => i.id === id);
    setAmount(inv ? String(Number(inv.balance_due).toFixed(2)) : "");
    setError(null);
    setSuccess(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);
    if (!invoiceId) {
      setError("Select an invoice.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    const bal = Number(selected?.balance_due || 0);
    if (value > bal) {
      setError(`Payment cannot exceed the balance due (${formatCurrency(bal)}).`);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error: rpcErr } = await supabase.rpc("client_portal_simulated_payment", {
      p_invoice_id: invoiceId,
      p_amount: value,
      p_payment_method: method,
      p_reference_number: reference.trim() || null,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }

    setSuccess(
      `Payment ${data?.payment_number || ""} recorded. Confirmation reference saved. Balances update after refresh.`
    );
    setBusy(false);
    router.refresh();
  }

  if (!open.length) {
    return (
      <div className="alert alert-success text-sm">
        <span>You have no outstanding balances. Thank you!</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body space-y-4">
        <div className="alert alert-warning text-sm">
          <span>
            Payments in this academic demonstration are simulated. No real funds are processed.
          </span>
        </div>
        {error && (
          <div className="alert alert-error text-sm" role="alert" id="portal-pay-error">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success text-sm" role="status">
            <span>{success}</span>
          </div>
        )}
        <label className="form-control" htmlFor="portal-pay-invoice">
          <span className="label-text font-medium">Open invoice</span>
          <select
            id="portal-pay-invoice"
            className="select select-bordered"
            value={invoiceId}
            onChange={(e) => onInvoiceChange(e.target.value)}
            required
            aria-required
            aria-invalid={!!error && !invoiceId}
            aria-describedby={error ? "portal-pay-error" : undefined}
          >
            {open.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoice_number} · {i.matters?.matter_name || "Matter"} · Due{" "}
                {formatCurrency(Number(i.balance_due))}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="text-sm opacity-75">
            Balance due: <strong>{formatCurrency(Number(selected.balance_due))}</strong>
          </p>
        )}
        <label className="form-control" htmlFor="portal-pay-amount">
          <span className="label-text font-medium">Payment amount</span>
          <input
            id="portal-pay-amount"
            type="number"
            min="0.01"
            step="0.01"
            className="input input-bordered"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            aria-required
            aria-invalid={!!error}
            aria-describedby={error ? "portal-pay-error" : undefined}
          />
        </label>
        <label className="form-control" htmlFor="portal-pay-method">
          <span className="label-text font-medium">Payment method</span>
          <select
            id="portal-pay-method"
            className="select select-bordered"
            value={method}
            onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control" htmlFor="portal-pay-reference">
          <span className="label-text font-medium">Reference number (optional)</span>
          <input
            id="portal-pay-reference"
            className="input input-bordered"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Fictional confirmation or check number"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? "Processing…" : "Confirm simulated payment"}
        </button>
      </div>
    </form>
  );
}
