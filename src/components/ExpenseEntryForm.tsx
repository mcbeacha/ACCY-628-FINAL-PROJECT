"use client";

import { PageHeader } from "@/components/PageHeader";
import {
  EXPENSE_HIGH_VALUE_THRESHOLD,
  EXPENSE_RECEIPT_THRESHOLD,
  EXPENSE_TYPES,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type MatterOpt = { id: string; matter_number: string; matter_name: string };

const VENDOR_TYPES = new Set([
  "Filing Fee",
  "Court Cost",
  "Expert Witness",
  "Medical Records",
  "Travel",
  "Lodging",
  "Outside Counsel",
  "Deposition",
  "Research",
  "Copying",
  "Postage",
]);

export function ExpenseEntryForm({ userId }: { userId: string }) {
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [expenseType, setExpenseType] = useState("Filing Fee");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("matters")
        .select("id, matter_number, matter_name")
        .order("matter_number");
      setMatters((data || []) as MatterOpt[]);
    })();
  }, []);

  async function save(e: FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const matterId = String(fd.get("matter_id") || "");
    const expenseDate = String(fd.get("expense_date") || "");
    const vendor = String(fd.get("vendor_name") || "").trim();
    const desc = String(fd.get("description") || "").trim();
    const receipt = String(fd.get("receipt_reference") || "").trim();
    const reimbursable = fd.get("client_reimbursable") === "on";
    const amt = Number(amount);

    if (!matterId || !expenseDate) {
      setError("Matter and expense date are required.");
      return;
    }
    if (!amt || amt <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (!desc) {
      setError("Description is required.");
      return;
    }
    if (VENDOR_TYPES.has(expenseType) && !vendor) {
      setError("A vendor is required for this expense type.");
      return;
    }
    if (amt >= EXPENSE_RECEIPT_THRESHOLD && !receipt) {
      setError(`A receipt reference is required for expenses of $${EXPENSE_RECEIPT_THRESHOLD} or more.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data: dups } = await supabase
      .from("expense_entries")
      .select("id, description, vendor_name, amount")
      .eq("matter_id", matterId)
      .eq("expense_date", expenseDate)
      .eq("amount", amt);

    if (dups?.length) {
      setWarning(
        "A possible duplicate expense was found (same matter, date, and amount). You can still submit if this entry is intentional."
      );
    }

    if (amt >= EXPENSE_HIGH_VALUE_THRESHOLD) {
      setWarning(
        (prev) =>
          (prev ? prev + " " : "") +
          `Amount is $${EXPENSE_HIGH_VALUE_THRESHOLD}+ and will be flagged for extra review.`
      );
    }

    const payload = {
      matter_id: matterId,
      expense_date: expenseDate,
      expense_type: expenseType,
      vendor_name: vendor || null,
      amount: amt,
      client_reimbursable: reimbursable,
      description: desc,
      receipt_reference: receipt || null,
      approval_status: submit ? "Submitted" : "Draft",
      invoice_status: reimbursable ? "Unbilled" : "Nonreimbursable",
      locked_status: false,
      created_by: userId,
    };

    const { data, error: insErr } = await supabase
      .from("expense_entries")
      .insert(payload)
      .select("id")
      .single();

    if (insErr) {
      setError(insErr.message);
      setLoading(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: submit ? "expense_submitted" : "expense_created",
      record_type: "expense_entry",
      record_id: data.id,
      matter_id: matterId,
      action_description: submit
        ? "Expense submitted for approval."
        : "Expense saved as draft.",
      performed_by: userId,
    });

    setMessage(submit ? "Expense submitted for approval." : "Draft expense saved.");
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    setAmount("");
    setExpenseType("Filing Fee");
  }

  return (
    <>
      <PageHeader
        title="Enter Expense"
        description="Record matter-related costs. Mark whether the client should reimburse the firm later."
        actions={
          <Link href="/expenses" className="btn btn-ghost btn-sm">
            My Expenses
          </Link>
        }
      />

      <form className="card bg-base-100 border border-base-300 shadow-sm max-w-3xl" onSubmit={(e) => save(e, false)}>
        <div className="card-body space-y-4">
          <div className="form-grid">
            <label className="label-cell" htmlFor="matter_id">
              Matter *
            </label>
            <div className="field-cell">
              <select id="matter_id" name="matter_id" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>
                  Select matter
                </option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_number} · {m.matter_name}
                  </option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="expense_date">
              Expense date *
            </label>
            <div className="field-cell">
              <input id="expense_date" name="expense_date" type="date" className="input input-bordered w-full" required />
            </div>

            <label className="label-cell" htmlFor="expense_type">
              Expense type *
            </label>
            <div className="field-cell">
              <select
                id="expense_type"
                className="select select-bordered w-full"
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
              >
                {EXPENSE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="vendor_name">
              Vendor {VENDOR_TYPES.has(expenseType) ? "*" : ""}
            </label>
            <div className="field-cell">
              <input id="vendor_name" name="vendor_name" className="input input-bordered w-full" />
            </div>

            <label className="label-cell" htmlFor="amount">
              Amount *
            </label>
            <div className="field-cell">
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                className="input input-bordered w-full"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {amount && Number(amount) > 0 && (
                <p className="text-xs opacity-60 mt-1">{formatCurrency(Number(amount))}</p>
              )}
            </div>

            <label className="label-cell" htmlFor="description">
              Description *
            </label>
            <div className="field-cell">
              <textarea id="description" name="description" className="textarea textarea-bordered w-full" rows={3} required />
            </div>

            <label className="label-cell" htmlFor="receipt_reference">
              Receipt reference {Number(amount) >= EXPENSE_RECEIPT_THRESHOLD ? "*" : ""}
            </label>
            <div className="field-cell">
              <input
                id="receipt_reference"
                name="receipt_reference"
                className="input input-bordered w-full"
                placeholder="RCPT-DEMO-0000 or fictional filename"
              />
              <p className="text-xs opacity-60 mt-1">
                Required at ${EXPENSE_RECEIPT_THRESHOLD}+. Document upload is not enabled in this phase.
              </p>
            </div>

            <span className="label-cell">Reimbursable</span>
            <div className="field-cell">
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" name="client_reimbursable" className="checkbox checkbox-sm" defaultChecked />
                <span className="label-text">Client reimbursable (for future billing)</span>
              </label>
            </div>
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
                    { preventDefault() {}, currentTarget: form, target: form } as unknown as FormEvent<HTMLFormElement>,
                    true
                  );
              }}
            >
              Submit for Approval
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
