"use client";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { RETAINER_TXN_TYPES } from "@/lib/constants";
import { clientDisplayName, formatCurrency, formatDate } from "@/lib/format";
import type { RetainerAccount, RetainerTransaction } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import { FormEvent, useEffect, useState } from "react";
import type { Client } from "@/lib/types";

export function RetainersClient({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<RetainerAccount[]>([]);
  const [txns, setTxns] = useState<RetainerTransaction[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase
        .from("retainer_accounts")
        .select("*, matters(id, matter_number, matter_name, clients(organization_name, first_name, last_name))")
        .order("created_at", { ascending: false }),
      supabase
        .from("retainer_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(40),
    ]);
    setAccounts((a || []) as RetainerAccount[]);
    setTxns((t || []) as RetainerTransaction[]);
    if (!selected && a?.[0]) setSelected(a[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onTxn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const accountId = String(fd.get("retainer_account_id") || "");
    const txnType = String(fd.get("transaction_type") || "");
    const amount = Number(fd.get("amount"));
    const desc = String(fd.get("description") || "").trim();
    const ref = String(fd.get("reference_number") || "").trim();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      setError("Select a retainer account.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    if (["Refund", "Adjustment Decrease", "Applied to Fees", "Applied to Expenses"].includes(txnType)) {
      if (Number(account.current_balance) - amount < 0) {
        setError("This transaction would reduce the retainer below zero.");
        return;
      }
    }

    if (["Refund", "Adjustment Increase", "Adjustment Decrease"].includes(txnType)) {
      if (!window.confirm("Confirm this simulated refund/adjustment? It will be recorded with your approval.")) {
        return;
      }
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error: insErr } = await supabase
      .from("retainer_transactions")
      .insert({
        retainer_account_id: accountId,
        matter_id: account.matter_id,
        transaction_date: String(fd.get("transaction_date") || new Date().toISOString().slice(0, 10)),
        transaction_type: txnType,
        amount,
        description: desc || null,
        reference_number: ref || null,
        approval_status: "Approved",
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr) {
      setError(insErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: `retainer_${txnType.toLowerCase().replace(/\s+/g, "_")}`,
      record_type: "retainer_transaction",
      record_id: data.id,
      matter_id: account.matter_id,
      action_description: `Simulated ${txnType} of ${formatCurrency(amount)} recorded.`,
      performed_by: userId,
    });

    setMessage("Transaction recorded. Balance and status updated automatically.");
    setBusy(false);
    (e.target as HTMLFormElement).reset();
    await load();
  }

  const recent = selected ? txns.filter((t) => t.retainer_account_id === selected) : txns;

  return (
    <>
      <PageHeader
        title="Retainers"
        description="ASC 606 contract liabilities: retainer deposits are advances held for future services—not revenue when received. Balances fall when applied to finalized invoices (performance obligations satisfied)."
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

      {accounts.length === 0 ? (
        <EmptyState title="No retainer accounts yet." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Matter</th>
                  <th>Client</th>
                  <th>Required</th>
                  <th>Balance</th>
                  <th>Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className={`cursor-pointer ${selected === a.id ? "bg-primary/5" : ""}`}
                    onClick={() => setSelected(a.id)}
                  >
                    <td className="text-sm font-medium">{a.matters?.matter_number}</td>
                    <td className="text-sm">
                      {clientDisplayName((a.matters?.clients as Client) || null)}
                    </td>
                    <td>{formatCurrency(Number(a.initial_required_amount))}</td>
                    <td className="font-semibold">{formatCurrency(Number(a.current_balance))}</td>
                    <td>{formatCurrency(Number(a.replenishment_threshold))}</td>
                    <td>
                      <StatusBadge status={a.account_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onTxn} className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Record simulated transaction</h2>
            <div className="form-grid">
              <label className="label-cell">Account</label>
              <div className="field-cell">
                <select
                  name="retainer_account_id"
                  className="select select-bordered w-full"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.matters?.matter_number} · bal {formatCurrency(Number(a.current_balance))}
                    </option>
                  ))}
                </select>
              </div>
              <label className="label-cell">Date</label>
              <div className="field-cell">
                <input
                  name="transaction_date"
                  type="date"
                  className="input input-bordered w-full"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <label className="label-cell">Type</label>
              <div className="field-cell">
                <select name="transaction_type" className="select select-bordered w-full" defaultValue="Deposit">
                  {RETAINER_TXN_TYPES.filter((t) => !t.startsWith("Applied")).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <label className="label-cell">Amount</label>
              <div className="field-cell">
                <input name="amount" type="number" min="0.01" step="0.01" className="input input-bordered w-full" required />
              </div>
              <label className="label-cell">Reference</label>
              <div className="field-cell">
                <input name="reference_number" className="input input-bordered w-full" placeholder="DEP-DEMO-xxx" />
              </div>
              <label className="label-cell">Description</label>
              <div className="field-cell">
                <textarea name="description" className="textarea textarea-bordered w-full" rows={2} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm w-fit" disabled={busy} type="submit">
              Record transaction
            </button>
          </div>
        </form>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Recent transactions</h2>
            {recent.length === 0 ? (
              <p className="text-sm opacity-60">No transactions yet.</p>
            ) : (
              <ul className="space-y-2">
                {recent.slice(0, 12).map((t) => (
                  <li key={t.id} className="text-sm border-b border-base-200 pb-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {t.transaction_type} · {formatCurrency(Number(t.amount))}
                      </span>
                      <StatusBadge status={t.approval_status} />
                    </div>
                    <div className="text-xs opacity-60">
                      {formatDate(t.transaction_date)} · {t.reference_number || "no ref"}
                    </div>
                    {t.description && <div className="text-xs mt-1">{t.description}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
