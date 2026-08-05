"use client";

import { PageHeader } from "@/components/PageHeader";
import {
  EXPENSE_HIGH_VALUE_THRESHOLD,
  EXPENSE_RECEIPT_THRESHOLD,
  EXPENSE_TYPES,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { ExpenseEntry } from "@/lib/phase2-types";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function ExpenseEntryForm({
  userId,
  editId,
  defaultMatterId,
}: {
  userId: string;
  editId?: string;
  defaultMatterId?: string;
}) {
  const router = useRouter();
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [expenseType, setExpenseType] = useState("Filing Fee");
  const [amount, setAmount] = useState("");
  const [matterId, setMatterId] = useState(defaultMatterId || "");
  const [expenseDate, setExpenseDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState("");
  const [reimbursable, setReimbursable] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(!editId);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("matters")
        .select("id, matter_number, matter_name")
        .order("matter_number");
      setMatters((data || []) as MatterOpt[]);

      if (editId) {
        const { data: entry, error: loadErr } = await supabase
          .from("expense_entries")
          .select("*")
          .eq("id", editId)
          .eq("created_by", userId)
          .maybeSingle();
        if (loadErr || !entry) {
          setError(loadErr?.message || "Expense not found or not editable.");
          setReady(true);
          return;
        }
        const row = entry as ExpenseEntry;
        if (!["Draft", "Rejected"].includes(row.approval_status) || row.locked_status) {
          setError("Only unlocked Draft or Rejected expenses can be edited.");
          setReady(true);
          return;
        }
        setMatterId(row.matter_id);
        setExpenseDate(row.expense_date);
        setExpenseType(row.expense_type);
        setVendor(row.vendor_name || "");
        setAmount(String(row.amount));
        setDescription(row.description || "");
        setReceipt(row.receipt_reference || "");
        setReimbursable(row.client_reimbursable);
        setRejectionReason(row.rejection_reason);
      }
      setReady(true);
    })();
  }, [editId, userId]);

  async function save(e: FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setMessage(null);

    const desc = description.trim();
    const vendorName = vendor.trim();
    const receiptRef = receipt.trim();
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
    if (VENDOR_TYPES.has(expenseType) && !vendorName) {
      setError("A vendor is required for this expense type.");
      return;
    }
    if (amt >= EXPENSE_RECEIPT_THRESHOLD && !receiptRef) {
      setError(`A receipt reference is required for expenses of $${EXPENSE_RECEIPT_THRESHOLD} or more.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    let dupQ = supabase
      .from("expense_entries")
      .select("id, description, vendor_name, amount")
      .eq("matter_id", matterId)
      .eq("expense_date", expenseDate)
      .eq("amount", amt);
    if (editId) dupQ = dupQ.neq("id", editId);

    const { data: dups } = await dupQ;
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
      vendor_name: vendorName || null,
      amount: amt,
      client_reimbursable: reimbursable,
      description: desc,
      receipt_reference: receiptRef || null,
      approval_status: submit ? "Submitted" : "Draft",
      invoice_status: reimbursable ? "Unbilled" : "Nonreimbursable",
      locked_status: false,
      needs_extra_review: amt >= EXPENSE_HIGH_VALUE_THRESHOLD,
      rejection_reason: submit ? null : editId ? rejectionReason : null,
      created_by: userId,
    };

    let entryId = editId;
    if (editId) {
      const { error: upErr } = await supabase.from("expense_entries").update(payload).eq("id", editId);
      if (upErr) {
        setError(upErr.message);
        setLoading(false);
        return;
      }
    } else {
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
      entryId = data.id;
    }

    await supabase.from("financial_activity").insert({
      action_type: editId
        ? submit
          ? "expense_resubmitted"
          : "expense_updated"
        : submit
          ? "expense_submitted"
          : "expense_created",
      record_type: "expense_entry",
      record_id: entryId,
      matter_id: matterId,
      action_description: editId
        ? submit
          ? "Corrected expense resubmitted for approval."
          : "Draft expense updated."
        : submit
          ? "Expense submitted for approval."
          : "Expense saved as draft.",
      performed_by: userId,
    });

    setMessage(
      editId
        ? submit
          ? "Corrected expense resubmitted for approval."
          : "Draft expense updated."
        : submit
          ? "Expense submitted for approval."
          : "Draft expense saved."
    );
    setLoading(false);

    if (editId) {
      router.push(submit ? "/expenses?status=Submitted" : "/expenses?status=Draft");
      router.refresh();
      return;
    }

    setAmount("");
    setExpenseType("Filing Fee");
    setMatterId("");
    setExpenseDate("");
    setVendor("");
    setDescription("");
    setReceipt("");
    setReimbursable(true);
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
        title={editId ? "Edit & Resubmit Expense" : "Enter Expense"}
        description={
          editId
            ? "Correct a Draft or Rejected expense, then save or resubmit for approval."
            : "Record matter-related costs. Mark whether the client should reimburse the firm later."
        }
        actions={
          <Link href="/expenses" className="btn btn-ghost btn-sm">
            My Expenses
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
              <input
                id="expense_date"
                name="expense_date"
                type="date"
                className="input input-bordered w-full"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
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
              <input
                id="vendor_name"
                name="vendor_name"
                className="input input-bordered w-full"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
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
              <textarea
                id="description"
                name="description"
                className="textarea textarea-bordered w-full"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
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
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
              />
              <p className="text-xs opacity-60 mt-1">
                Required at ${EXPENSE_RECEIPT_THRESHOLD}+. Document upload is not enabled in this phase.
              </p>
            </div>

            <span className="label-cell">Reimbursable</span>
            <div className="field-cell">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  name="client_reimbursable"
                  className="checkbox checkbox-sm"
                  checked={reimbursable}
                  onChange={(e) => setReimbursable(e.target.checked)}
                />
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
