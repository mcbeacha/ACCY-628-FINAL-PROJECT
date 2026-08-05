"use client";

import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

type Inv = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_total: number;
  retainer_applied: number;
  payments_applied: number;
  balance_due: number;
  invoice_status: string;
  dispute_status: string;
  dispute_reason: string | null;
  client_message: string | null;
  matter_id: string;
  matters?: { matter_number: string; matter_name: string } | null;
};

type Line = { id: string; invoice_id: string; description: string; final_amount: number; line_type: string; service_date: string | null };
type Pay = {
  id: string;
  payment_number: string;
  payment_date: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
};

export function ClientBillingClient({
  invoices: initial,
  lines,
  payments,
  retainerBalance,
  userId,
}: {
  invoices: Inv[];
  lines: Line[];
  payments: Pay[];
  retainerBalance: number;
  userId: string;
}) {
  const [invoices, setInvoices] = useState(initial);
  const [selected, setSelected] = useState<string | null>(initial[0]?.id || null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const inv = invoices.find((i) => i.id === selected);
  const invLines = lines.filter((l) => l.invoice_id === selected);

  async function submitDispute() {
    if (!inv || !reason.trim()) {
      setErr("Enter a dispute reason.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({
        dispute_status: "Raised",
        dispute_reason: reason.trim(),
        dispute_raised_at: new Date().toISOString(),
        invoice_status: "Disputed",
      })
      .eq("id", inv.id);
    if (error) {
      setErr(error.message);
      return;
    }
    await supabase.from("financial_activity").insert({
      action_type: "client_dispute",
      record_type: "invoice",
      record_id: inv.id,
      matter_id: inv.matter_id,
      action_description: `Client dispute on ${inv.invoice_number}: ${reason}`,
      performed_by: userId,
    });
    setInvoices((rows) =>
      rows.map((r) =>
        r.id === inv.id
          ? { ...r, dispute_status: "Raised", dispute_reason: reason, invoice_status: "Disputed" }
          : r
      )
    );
    setMsg("Your dispute was submitted. Balances cannot be changed from the portal.");
    setReason("");
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="alert alert-success text-sm">
          <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="alert alert-error text-sm">
          <span>{err}</span>
        </div>
      )}

      <div className="stats shadow bg-base-100 border border-base-300">
        <div className="stat">
          <div className="stat-title">Retainer balance</div>
          <div className="stat-value text-2xl">{formatCurrency(retainerBalance)}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Open invoice balance</div>
          <div className="stat-value text-2xl">
            {formatCurrency(invoices.reduce((s, i) => s + Number(i.balance_due), 0))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-base">Your invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm opacity-60">No finalized invoices yet.</p>
            ) : (
              <ul className="space-y-2">
                {invoices.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      className={`w-full text-left border rounded-lg p-3 ${selected === i.id ? "border-primary" : "border-base-200"}`}
                      onClick={() => setSelected(i.id)}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{i.invoice_number}</span>
                        <StatusBadge status={i.invoice_status} />
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        {i.matters?.matter_number} · Due {formatDate(i.due_date)}
                      </div>
                      <div className="text-sm mt-1">
                        Total {formatCurrency(Number(i.invoice_total))} · Balance{" "}
                        <span className="font-semibold">{formatCurrency(Number(i.balance_due))}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-base">Invoice detail</h2>
            {!inv ? (
              <p className="text-sm opacity-60">Select an invoice.</p>
            ) : (
              <>
                <p className="text-sm">
                  Date {formatDate(inv.invoice_date)} · Due {formatDate(inv.due_date)}
                </p>
                <ul className="text-sm space-y-1 mt-2">
                  <li>Invoice total: {formatCurrency(Number(inv.invoice_total))}</li>
                  <li>Retainer applied: {formatCurrency(Number(inv.retainer_applied))}</li>
                  <li>Payments applied: {formatCurrency(Number(inv.payments_applied))}</li>
                  <li className="font-semibold">Balance due: {formatCurrency(Number(inv.balance_due))}</li>
                </ul>
                {inv.client_message && (
                  <p className="text-sm mt-2 opacity-80">{inv.client_message}</p>
                )}
                <h3 className="font-medium text-sm mt-3">Line descriptions</h3>
                <ul className="text-sm space-y-1">
                  {invLines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>
                        {l.line_type}: {l.description}
                      </span>
                      <span>{formatCurrency(Number(l.final_amount))}</span>
                    </li>
                  ))}
                </ul>
                <div className="divider" />
                <h3 className="font-medium text-sm">Submit a dispute</h3>
                <p className="text-xs opacity-60 mb-2">
                  You may report a concern. You cannot change balances or approve adjustments.
                </p>
                <textarea
                  className="textarea textarea-bordered text-sm"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for dispute"
                />
                <button type="button" className="btn btn-sm btn-outline mt-2 w-fit" onClick={submitDispute}>
                  Submit dispute
                </button>
                {inv.dispute_status !== "None" && (
                  <p className="text-sm mt-2">
                    Dispute status: <StatusBadge status={inv.dispute_status} />
                    {inv.dispute_reason ? ` — ${inv.dispute_reason}` : ""}
                  </p>
                )}
                <Link href="/client-portal" className="link text-sm mt-4 block">
                  Back to client portal
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h2 className="card-title text-base">Payment history</h2>
          {payments.length === 0 ? (
            <p className="text-sm opacity-60">No posted payments on file.</p>
          ) : (
            <div className="table-wrap">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.payment_number}</td>
                      <td>{formatDate(p.payment_date)}</td>
                      <td>{p.payment_method}</td>
                      <td>{formatCurrency(Number(p.total_amount))}</td>
                      <td>
                        <StatusBadge status={p.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
