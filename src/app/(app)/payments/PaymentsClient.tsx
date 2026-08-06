"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate, clientDisplayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";
import { FormEvent, useEffect, useState } from "react";

type InvoiceOpen = {
  id: string;
  invoice_number: string;
  balance_due: number;
  invoice_status: string;
  client_id: string;
  matter_id: string;
};

type PaymentRow = {
  id: string;
  payment_number: string;
  client_id: string;
  payment_date: string;
  payment_method: string;
  total_amount: number;
  unapplied_amount: number;
  payment_status: string;
  reference_number: string | null;
  clients?: {
    organization_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

const METHODS = ["Check", "ACH", "Credit Card", "Cash", "Wire", "Other"];

export function PaymentsClient({ userId }: { userId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [openInvoices, setOpenInvoices] = useState<InvoiceOpen[]>([]);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Check");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [apps, setApps] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("clients").select("*").order("client_number"),
      supabase
        .from("payments")
        .select("*, clients(organization_name, first_name, last_name, client_type, primary_contact_name)")
        .order("payment_date", { ascending: false })
        .limit(40),
    ]);
    setClients((c || []) as Client[]);
    setPayments((p || []) as PaymentRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setOpenInvoices([]);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, balance_due, invoice_status, client_id, matter_id")
        .eq("client_id", clientId)
        .not("finalized_at", "is", null)
        .gt("balance_due", 0)
        .order("due_date");
      setOpenInvoices((data || []) as InvoiceOpen[]);
      setApps({});
    })();
  }, [clientId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const total = Number(amount);
    if (!clientId || !total || total <= 0) {
      setError("Client and positive amount required.");
      return;
    }
    let applied = 0;
    const applications: { invoice_id: string; amount: number; matter_id: string }[] = [];
    for (const inv of openInvoices) {
      const a = Number(apps[inv.id] || 0);
      if (!a) continue;
      if (a < 0) {
        setError("Application amounts cannot be negative.");
        return;
      }
      if (a > Number(inv.balance_due)) {
        setError(`Application to ${inv.invoice_number} exceeds balance.`);
        return;
      }
      applied += a;
      applications.push({ invoice_id: inv.id, amount: a, matter_id: inv.matter_id });
    }
    if (applied > total) {
      setError("Total applications exceed payment amount.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const matterId = applications[0]?.matter_id || openInvoices[0]?.matter_id || null;

    // Allocate payment_number in-app — seed data can leave the DB sequence behind.
    const { data: latestPay } = await supabase
      .from("payments")
      .select("payment_number")
      .like("payment_number", "PMT-%")
      .order("payment_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestN = Number(String(latestPay?.payment_number || "PMT-020000").replace(/\D/g, "")) || 20000;
    const paymentNumber = `PMT-${String(latestN + 1).padStart(6, "0")}`;

    const { data: pay, error: pErr } = await supabase
      .from("payments")
      .insert({
        client_id: clientId,
        matter_id: matterId,
        payment_date: date,
        payment_method: method,
        total_amount: total,
        reference_number: ref || null,
        payment_status: "Draft",
        unapplied_amount: total,
        notes: notes || "Simulated customer payment",
        entered_by: userId,
        payment_number: paymentNumber,
      })
      .select("id, payment_number")
      .single();

    if (pErr || !pay) {
      setError(pErr?.message || "Could not create payment.");
      setBusy(false);
      return;
    }

    if (applications.length) {
      const { error: aErr } = await supabase.from("payment_applications").insert(
        applications.map((a) => ({
          payment_id: pay.id,
          invoice_id: a.invoice_id,
          amount_applied: a.amount,
          applied_by: userId,
        }))
      );
      if (aErr) {
        setError(aErr.message);
        setBusy(false);
        return;
      }
    }

    let postErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const { error } = await supabase.rpc("post_payment", { p_payment_id: pay.id });
      if (!error) {
        postErr = null;
        break;
      }
      postErr = error;
      // Seeded JE numbers can leave the sequence behind; retries advance it.
      if (!/journal_entry_number|23505/i.test(error.message)) break;
    }
    if (postErr) {
      setError(postErr.message);
      setBusy(false);
      return;
    }

    setMessage(`Payment ${pay.payment_number} posted (simulated).`);
    setAmount("");
    setRef("");
    setNotes("");
    setApps({});
    setBusy(false);
    await load();
    // refresh open invoices
    setClientId(clientId);
    const { data } = await createClient()
      .from("invoices")
      .select("id, invoice_number, balance_due, invoice_status, client_id, matter_id")
      .eq("client_id", clientId)
      .not("finalized_at", "is", null)
      .gt("balance_due", 0);
    setOpenInvoices((data || []) as InvoiceOpen[]);
  }

  async function reverse(id: string) {
    const reason = window.prompt("Reversal reason (required):");
    if (!reason?.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("reverse_payment", {
      p_payment_id: id,
      p_reason: reason.trim(),
    });
    if (err) setError(err.message);
    else setMessage("Payment reversed. Invoice balances restored via recalc.");
    setBusy(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Simulated Payments"
        description="Record fictional customer payments and apply them to open invoices."
      />
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

      <form onSubmit={onCreate} className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body grid gap-3 md:grid-cols-2">
          <h2 className="card-title text-base md:col-span-2">Enter payment</h2>
          <label className="form-control">
            <span className="label-text">Client</span>
            <select
              className="select select-bordered"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientDisplayName(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Payment date</span>
            <input
              type="date"
              className="input input-bordered"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">Method</span>
            <select className="select select-bordered" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Total amount</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className="input input-bordered"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">Fictional reference #</span>
            <input className="input input-bordered" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="CHK-1001" />
          </label>
          <label className="form-control">
            <span className="label-text">Notes</span>
            <input className="input input-bordered" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="md:col-span-2">
            <h3 className="font-semibold text-sm mb-2">Apply to open invoices (optional partial leave unapplied)</h3>
            {openInvoices.length === 0 ? (
              <p className="text-sm opacity-60">No open AR invoices for this client.</p>
            ) : (
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th>Balance</th>
                      <th>Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.invoice_number}</td>
                        <td>
                          <StatusBadge status={inv.invoice_status} />
                        </td>
                        <td>{formatCurrency(Number(inv.balance_due))}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input input-bordered input-xs w-28"
                            value={apps[inv.id] || ""}
                            onChange={(e) => setApps((a) => ({ ...a, [inv.id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary w-fit" disabled={busy}>
            {busy ? "Posting…" : "Create & post payment"}
          </button>
        </div>
      </form>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Recent payments</h2>
          {payments.length === 0 ? (
            <EmptyState title="No payments yet." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Method</th>
                    <th>Total</th>
                    <th>Unapplied</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.payment_number}</td>
                      <td>{formatDate(p.payment_date)}</td>
                      <td className="text-sm">
                        {clientDisplayName(p.clients as Client)}
                      </td>
                      <td>{p.payment_method}</td>
                      <td>{formatCurrency(Number(p.total_amount))}</td>
                      <td>{formatCurrency(Number(p.unapplied_amount))}</td>
                      <td>
                        <StatusBadge status={p.payment_status} />
                      </td>
                      <td>
                        {p.payment_status === "Posted" && (
                          <button
                            className="btn btn-ghost btn-xs"
                            disabled={busy}
                            onClick={() => reverse(p.id)}
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
