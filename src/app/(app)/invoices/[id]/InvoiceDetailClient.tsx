"use client";

import { StatusBadge } from "@/components/Badges";
import type { Invoice, InvoiceLine } from "@/lib/billing-types";
import {
  approvalBadgeLabel,
  viewerCanApprove,
} from "@/lib/approval-tiers";
import { INVOICE_BILLING_APPROVE_MAX } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  invoice: Invoice & {
    matters?: {
      matter_number: string;
      matter_name: string;
      matter_status?: string;
      billing_method?: string | null;
      practice_area?: string | null;
      responsible_attorney_id?: string | null;
    } | null;
    clients?: {
      organization_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      client_number?: string;
    } | null;
  };
  lines: InvoiceLine[];
  adjustments: {
    id: string;
    adjustment_type: string;
    original_amount: number;
    adjustment_amount: number;
    adjusted_amount: number;
    reason: string;
    approval_status: string;
  }[];
  writeOffs: {
    id: string;
    amount: number;
    reason: string;
    approval_status: string;
  }[];
  applications: {
    id: string;
    amount_applied: number;
    payments?: { payment_number: string; payment_status: string } | null;
  }[];
  retainerBalance: number | null;
  userId: string;
  role: string;
};

type EditableLine = {
  id: string;
  description: string;
  write_down_amount: string;
};

export function InvoiceDetailClient(props: Props) {
  const { invoice: initial, lines: initialLines, adjustments, writeOffs, applications, retainerBalance, userId, role } =
    props;
  const [inv, setInv] = useState(initial);
  const [lines, setLines] = useState(initialLines);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retainerAmt, setRetainerAmt] = useState("");
  const [writeOffAmt, setWriteOffAmt] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("");
  const [disputeReason, setDisputeReason] = useState(inv.dispute_reason || "");
  const [disputeResolution, setDisputeResolution] = useState("");
  const [editInvoiceDate, setEditInvoiceDate] = useState(initial.invoice_date?.slice(0, 10) || "");
  const [editDueDate, setEditDueDate] = useState(initial.due_date?.slice(0, 10) || "");
  const [editPeriodStart, setEditPeriodStart] = useState(
    initial.billing_period_start?.slice(0, 10) || ""
  );
  const [editPeriodEnd, setEditPeriodEnd] = useState(initial.billing_period_end?.slice(0, 10) || "");
  const [editClientMessage, setEditClientMessage] = useState(initial.client_message || "");
  const [editInternalNotes, setEditInternalNotes] = useState(initial.internal_notes || "");
  const [editLines, setEditLines] = useState<EditableLine[]>(
    initialLines.map((l) => ({
      id: l.id,
      description: l.description || "",
      write_down_amount: String(Number(l.write_down_amount) || 0),
    }))
  );
  const router = useRouter();

  const locked = !!inv.finalized_at;
  const canPrepare = role === "managing_partner" || role === "billing_staff";
  const matterCtx = inv.matters || null;
  const invoiceApproval = viewerCanApprove({
    kind: "invoice",
    viewerRole: role as UserRole,
    viewerId: userId,
    matter: matterCtx,
    amount: Number(inv.invoice_total),
    preparerId: inv.created_by,
  });
  const writeOffApproval = viewerCanApprove({
    kind: "write_off",
    viewerRole: role as UserRole,
    viewerId: userId,
    matter: matterCtx,
    amount: Number(writeOffAmt || 0),
  });
  const canApprove = invoiceApproval.allowed;
  const canApproveWriteOff = writeOffApproval.allowed;
  const canPost = canPrepare;
  const canEditDraft = canPrepare && !locked && inv.approval_status === "Draft";
  const isHighValue = Number(inv.invoice_total) >= INVOICE_BILLING_APPROVE_MAX;
  const selfApprovalFlag =
    isHighValue && inv.created_by === userId && role === "managing_partner";
  const approvalPolicyLabel = approvalBadgeLabel(invoiceApproval.decision);

  function syncEditForm(
    nextInv: typeof inv,
    nextLines: InvoiceLine[]
  ) {
    setEditInvoiceDate(nextInv.invoice_date?.slice(0, 10) || "");
    setEditDueDate(nextInv.due_date?.slice(0, 10) || "");
    setEditPeriodStart(nextInv.billing_period_start?.slice(0, 10) || "");
    setEditPeriodEnd(nextInv.billing_period_end?.slice(0, 10) || "");
    setEditClientMessage(nextInv.client_message || "");
    setEditInternalNotes(nextInv.internal_notes || "");
    setEditLines(
      nextLines.map((l) => ({
        id: l.id,
        description: l.description || "",
        write_down_amount: String(Number(l.write_down_amount) || 0),
      }))
    );
  }

  async function refresh() {
    const supabase = createClient();
    const [{ data }, { data: lineData }] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          "*, matters(matter_number, matter_name, matter_status), clients(organization_name, first_name, last_name, client_number)"
        )
        .eq("id", inv.id)
        .single(),
      supabase.from("invoice_lines").select("*").eq("invoice_id", inv.id).order("service_date"),
    ]);
    if (data) setInv(data as typeof inv);
    const nextLines = (lineData || []) as InvoiceLine[];
    setLines(nextLines);
    if (data) syncEditForm(data as typeof inv, nextLines);
    router.refresh();
  }

  async function saveDraftEdits() {
    if (!canEditDraft) return;
    if (!editInvoiceDate || !editDueDate) {
      setError("Invoice date and due date are required.");
      return;
    }
    for (const el of editLines) {
      const line = lines.find((l) => l.id === el.id);
      if (!line) continue;
      const wd = Number(el.write_down_amount);
      if (Number.isNaN(wd) || wd < 0) {
        setError("Write-down amounts must be zero or positive numbers.");
        return;
      }
      if (wd > Number(line.original_amount)) {
        setError("Write-down cannot exceed the original line amount.");
        return;
      }
      if (!el.description.trim()) {
        setError("Line descriptions cannot be empty.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error: invErr } = await supabase
      .from("invoices")
      .update({
        invoice_date: editInvoiceDate,
        due_date: editDueDate,
        billing_period_start: editPeriodStart || null,
        billing_period_end: editPeriodEnd || null,
        client_message: editClientMessage.trim() || null,
        internal_notes: editInternalNotes.trim() || null,
      })
      .eq("id", inv.id);

    if (invErr) {
      setError(invErr.message);
      setBusy(false);
      return;
    }

    for (const el of editLines) {
      const line = lines.find((l) => l.id === el.id);
      if (!line) continue;
      const wd = Math.min(Number(el.write_down_amount) || 0, Number(line.original_amount));
      const finalAmount = Number(line.original_amount) - wd;
      const { error: lineErr } = await supabase
        .from("invoice_lines")
        .update({
          description: el.description.trim(),
          write_down_amount: wd,
          final_amount: finalAmount,
        })
        .eq("id", el.id);
      if (lineErr) {
        setError(lineErr.message);
        setBusy(false);
        return;
      }
    }

    const { error: recalcErr } = await supabase.rpc("recalc_invoice_totals", {
      p_invoice_id: inv.id,
    });
    if (recalcErr) {
      setError(recalcErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: "invoice_draft_edited",
      record_type: "invoice",
      record_id: inv.id,
      matter_id: inv.matter_id,
      action_description: `Draft invoice ${inv.invoice_number} header/lines updated.`,
      performed_by: userId,
    });

    setMessage("Draft invoice changes saved.");
    await refresh();
    setBusy(false);
  }

  async function submitForApproval() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("invoices")
      .update({ approval_status: "Submitted", invoice_status: "Pending Approval" })
      .eq("id", inv.id);
    if (err) setError(err.message);
    else {
      await supabase.from("financial_activity").insert({
        action_type: "invoice_submitted",
        record_type: "invoice",
        record_id: inv.id,
        matter_id: inv.matter_id,
        action_description: `Invoice ${inv.invoice_number} submitted for approval.`,
        performed_by: userId,
      });
      setMessage("Invoice submitted for approval.");
      await refresh();
    }
    setBusy(false);
  }

  async function approve() {
    if (selfApprovalFlag) {
      if (
        !window.confirm(
          "SELF-APPROVAL FLAG: You prepared this high-value invoice. Approving as the same user is discouraged. Continue only for demo purposes?"
        )
      ) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("invoices")
      .update({
        approval_status: "Approved",
        invoice_status: "Approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", inv.id);
    if (err) setError(err.message);
    else {
      await supabase.from("financial_activity").insert({
        action_type: "invoice_approved",
        record_type: "invoice",
        record_id: inv.id,
        matter_id: inv.matter_id,
        action_description: `Invoice ${inv.invoice_number} approved.`,
        performed_by: userId,
      });
      setMessage("Invoice approved.");
      await refresh();
    }
    setBusy(false);
  }

  async function reject() {
    const reason = window.prompt("Rejection reason:");
    if (!reason?.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("invoices")
      .update({
        approval_status: "Draft",
        invoice_status: "Draft",
        internal_notes: `${inv.internal_notes || ""}\nRejected: ${reason}`.trim(),
      })
      .eq("id", inv.id);
    if (err) setError(err.message);
    else {
      setMessage("Invoice rejected — returned to draft.");
      await refresh();
    }
    setBusy(false);
  }

  async function finalize() {
    if (!window.confirm("Finalize this invoice? Lines and source entries will lock and AR will be created.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("finalize_invoice", { p_invoice_id: inv.id });
    if (err) setError(err.message);
    else {
      setMessage("Invoice finalized. ASC 606: revenue recognized for satisfied performance obligations; simulated AR journal entry created.");
      await refresh();
    }
    setBusy(false);
  }

  async function applyRetainer() {
    const amt = Number(retainerAmt);
    if (!amt || amt <= 0) {
      setError("Enter a positive retainer amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("apply_retainer_to_invoice", {
      p_invoice_id: inv.id,
      p_amount: amt,
      p_user: userId,
    });
    if (err) setError(err.message);
    else {
      setMessage("Retainer applied (ASC 606): contract liability reduced against earned invoice; simulated.");
      setRetainerAmt("");
      await refresh();
    }
    setBusy(false);
  }

  async function raiseDispute() {
    if (!disputeReason.trim()) {
      setError("Dispute reason is required.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("invoices")
      .update({
        dispute_status: "Raised",
        dispute_reason: disputeReason.trim(),
        dispute_raised_at: new Date().toISOString(),
        invoice_status: locked ? "Disputed" : inv.invoice_status,
      })
      .eq("id", inv.id);
    if (err) setError(err.message);
    else {
      await supabase.from("financial_activity").insert({
        action_type: "dispute_raised",
        record_type: "invoice",
        record_id: inv.id,
        matter_id: inv.matter_id,
        action_description: `Dispute raised on ${inv.invoice_number}: ${disputeReason}`,
        performed_by: userId,
      });
      setMessage("Dispute recorded.");
      await refresh();
    }
    setBusy(false);
  }

  async function resolveDispute(status: "Resolved" | "Accepted Adjustment" | "Rejected" | "Under Review") {
    setBusy(true);
    const supabase = createClient();
    const nextStatus =
      status === "Resolved" || status === "Rejected" || status === "Accepted Adjustment"
        ? Number(inv.balance_due) <= 0
          ? "Paid"
          : Number(inv.payments_applied) > 0
            ? "Partially Paid"
            : "Finalized"
        : "Disputed";
    const { error: err } = await supabase
      .from("invoices")
      .update({
        dispute_status: status,
        dispute_resolution: disputeResolution || null,
        invoice_status: nextStatus as Invoice["invoice_status"],
      })
      .eq("id", inv.id);
    if (err) setError(err.message);
    else {
      setMessage(`Dispute set to ${status}.`);
      await refresh();
    }
    setBusy(false);
  }

  async function requestWriteOff() {
    const amt = Number(writeOffAmt);
    if (!amt || amt <= 0) {
      setError("Write-off amount must be positive.");
      return;
    }
    if (amt > Number(inv.balance_due)) {
      setError("Write-off cannot exceed balance due.");
      return;
    }
    if (!writeOffReason.trim()) {
      setError("Write-off reason is required.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("write_offs").insert({
      invoice_id: inv.id,
      client_id: inv.client_id,
      matter_id: inv.matter_id,
      amount: amt,
      reason: writeOffReason.trim(),
      approval_status: "Submitted",
      requested_by: userId,
      write_off_date: new Date().toISOString().slice(0, 10),
    });
    if (err) setError(err.message);
    else {
      setMessage("Write-off submitted for Managing Partner approval.");
      setWriteOffAmt("");
      setWriteOffReason("");
      await refresh();
    }
    setBusy(false);
  }

  async function approveWriteOff(id: string) {
    if (Number(inv.invoice_total) >= INVOICE_BILLING_APPROVE_MAX && inv.created_by === userId) {
      if (!window.confirm("Self-approval flag on related high-value work. Continue?")) return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("approve_write_off", { p_writeoff_id: id });
    if (err) setError(err.message);
    else {
      setMessage("Write-off approved. AR reduced with bad-debt journal entry.");
      await refresh();
    }
    setBusy(false);
  }

  const clientLabel =
    inv.clients?.organization_name ||
    [inv.clients?.first_name, inv.clients?.last_name].filter(Boolean).join(" ") ||
    "—";

  return (
    <div className="space-y-4">
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
      {selfApprovalFlag && (
        <div className="alert alert-warning text-sm">
          <span>
            Control flag: preparer is the same user as the potential approver on a high-value invoice
            (≥ {formatCurrency(INVOICE_BILLING_APPROVE_MAX)}).
          </span>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <div className="flex flex-wrap gap-2 items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{inv.invoice_number}</h2>
              <p className="text-sm opacity-70">
                {inv.matters?.matter_number} · {clientLabel}
              </p>
            </div>
            <div className="flex gap-2">
              <StatusBadge status={inv.invoice_status} />
              <StatusBadge status={inv.approval_status} />
              {inv.dispute_status !== "None" && <StatusBadge status={inv.dispute_status} />}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
            <div>
              <div className="opacity-60">Invoice date</div>
              <div className="font-medium">{formatDate(inv.invoice_date)}</div>
            </div>
            <div>
              <div className="opacity-60">Due date</div>
              <div className="font-medium">{formatDate(inv.due_date)}</div>
            </div>
            <div>
              <div className="opacity-60">Invoice total</div>
              <div className="font-medium">{formatCurrency(Number(inv.invoice_total))}</div>
            </div>
            <div>
              <div className="opacity-60">Balance due</div>
              <div className="font-semibold text-lg">{formatCurrency(Number(inv.balance_due))}</div>
            </div>
            <div>
              <div className="opacity-60">Payments applied</div>
              <div>{formatCurrency(Number(inv.payments_applied))}</div>
            </div>
            <div>
              <div className="opacity-60">Retainer applied</div>
              <div>{formatCurrency(Number(inv.retainer_applied))}</div>
            </div>
            <div>
              <div className="opacity-60">Write-offs</div>
              <div>{formatCurrency(Number(inv.write_off_total))}</div>
            </div>
            <div>
              <div className="opacity-60">Write-down total</div>
              <div>{formatCurrency(Number(inv.write_down_total))}</div>
            </div>
          </div>
          {inv.client_message && (
            <p className="text-sm mt-3">
              <span className="opacity-60">Client message: </span>
              {inv.client_message}
            </p>
          )}
          {canPrepare && inv.internal_notes && (
            <p className="text-sm mt-1 opacity-80">
              <span className="font-medium">Internal notes:</span> {inv.internal_notes}
            </p>
          )}
          {locked && (
            <p className="text-xs mt-2 opacity-60">
              Finalized {formatDate(inv.finalized_at)} — lines locked; corrections use adjustments /
              write-offs / reversals.
            </p>
          )}
        </div>
      </div>

      {canEditDraft && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Edit invoice</h2>
            <p className="text-sm opacity-70">
              Draft invoices can be updated before submission. Finalized invoices stay locked.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-2">
              <label className="form-control">
                <span className="label-text text-xs">Invoice date</span>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={editInvoiceDate}
                  onChange={(e) => setEditInvoiceDate(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Due date</span>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Billing period start</span>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={editPeriodStart}
                  onChange={(e) => setEditPeriodStart(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Billing period end</span>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="form-control mt-2">
              <span className="label-text text-xs">Client message</span>
              <textarea
                className="textarea textarea-bordered text-sm"
                rows={2}
                value={editClientMessage}
                onChange={(e) => setEditClientMessage(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Internal notes</span>
              <textarea
                className="textarea textarea-bordered text-sm"
                rows={2}
                value={editInternalNotes}
                onChange={(e) => setEditInternalNotes(e.target.value)}
              />
            </label>
            <button className="btn btn-primary btn-sm w-fit" disabled={busy} onClick={saveDraftEdits}>
              Save changes
            </button>
          </div>
        </div>
      )}

      {canPrepare && !locked && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="badge badge-outline badge-sm">{approvalPolicyLabel}</span>
            {!canApprove && inv.approval_status === "Submitted" ? (
              <span className="text-xs opacity-70">
                {invoiceApproval.blockedReason || invoiceApproval.decision.reason}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
          {inv.approval_status === "Draft" && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={submitForApproval}>
              Submit for approval
            </button>
          )}
          {canApprove && inv.approval_status === "Submitted" && (
            <>
              <button className="btn btn-success btn-sm" disabled={busy} onClick={approve}>
                Approve
              </button>
              <button className="btn btn-outline btn-error btn-sm" disabled={busy} onClick={reject}>
                Reject
              </button>
            </>
          )}
          {canApprove && inv.approval_status === "Draft" && inv.created_by === userId && isHighValue && (
            <span className="text-xs self-center opacity-70">Submit before partner review recommended.</span>
          )}
          {(inv.approval_status === "Approved" ||
            (canApprove && inv.approval_status === "Submitted")) &&
            !inv.finalized_at && (
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={finalize}>
                Finalize invoice
              </button>
            )}
          {canApprove && inv.approval_status === "Draft" && (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={async () => {
                await approve();
              }}
            >
              Approve draft
            </button>
          )}
          </div>
        </div>
      )}
      {canApprove && inv.approval_status === "Approved" && !inv.finalized_at && canPrepare && (
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={finalize}>
          Finalize invoice
        </button>
      )}
      {canPost && inv.finalized_at && Number(inv.balance_due) > 0 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body py-4">
            <h3 className="font-semibold text-sm">Apply retainer (available: {formatCurrency(retainerBalance ?? 0)})</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <input
                type="number"
                min={0}
                step="0.01"
                className="input input-bordered input-sm w-40"
                value={retainerAmt}
                onChange={(e) => setRetainerAmt(e.target.value)}
                placeholder="Amount"
              />
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={applyRetainer}>
                Apply retainer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Line items</h2>
          {canEditDraft && (
            <p className="text-xs opacity-70">
              Description and write-down are editable on drafts — use Save changes above to persist.
            </p>
          )}
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Original</th>
                  <th>Write-down</th>
                  <th>Final</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const edit = editLines.find((e) => e.id === l.id);
                  const wdPreview = canEditDraft
                    ? Math.min(
                        Number(edit?.write_down_amount) || 0,
                        Number(l.original_amount)
                      )
                    : Number(l.write_down_amount);
                  const finalPreview = Number(l.original_amount) - wdPreview;
                  return (
                    <tr key={l.id}>
                      <td>{l.line_type}</td>
                      <td>{formatDate(l.service_date)}</td>
                      <td className="max-w-sm">
                        {canEditDraft ? (
                          <input
                            className="input input-bordered input-xs w-full min-w-[12rem]"
                            value={edit?.description ?? l.description}
                            onChange={(e) =>
                              setEditLines((prev) =>
                                prev.map((row) =>
                                  row.id === l.id ? { ...row, description: e.target.value } : row
                                )
                              )
                            }
                          />
                        ) : (
                          l.description
                        )}
                      </td>
                      <td>{l.quantity}</td>
                      <td>{formatCurrency(Number(l.unit_rate))}</td>
                      <td>{formatCurrency(Number(l.original_amount))}</td>
                      <td>
                        {canEditDraft ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input input-bordered input-xs w-24"
                            value={edit?.write_down_amount ?? String(Number(l.write_down_amount))}
                            onChange={(e) =>
                              setEditLines((prev) =>
                                prev.map((row) =>
                                  row.id === l.id
                                    ? { ...row, write_down_amount: e.target.value }
                                    : row
                                )
                              )
                            }
                          />
                        ) : (
                          formatCurrency(Number(l.write_down_amount))
                        )}
                      </td>
                      <td className="font-medium">{formatCurrency(finalPreview)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {adjustments.length > 0 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-base">Billing adjustments (write-downs)</h2>
            <ul className="text-sm space-y-2">
              {adjustments.map((a) => (
                <li key={a.id}>
                  {a.adjustment_type}: original {formatCurrency(Number(a.original_amount))} → write-down{" "}
                  {formatCurrency(Number(a.adjustment_amount))} ={" "}
                  {formatCurrency(Number(a.adjusted_amount))} · {a.reason} ({a.approval_status})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-base">Payment applications</h2>
            <ul className="text-sm space-y-1">
              {applications.map((a) => (
                <li key={a.id}>
                  {a.payments?.payment_number || "Payment"} · {formatCurrency(Number(a.amount_applied))} ·{" "}
                  {a.payments?.payment_status}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {canPrepare && locked && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <h3 className="font-semibold">Dispute handling</h3>
              <textarea
                className="textarea textarea-bordered text-sm"
                rows={2}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Dispute reason"
              />
              <button className="btn btn-sm btn-outline w-fit" disabled={busy} onClick={raiseDispute}>
                Mark disputed
              </button>
              {inv.dispute_status !== "None" && (
                <>
                  <textarea
                    className="textarea textarea-bordered text-sm"
                    rows={2}
                    value={disputeResolution}
                    onChange={(e) => setDisputeResolution(e.target.value)}
                    placeholder="Resolution notes"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-xs" disabled={busy} onClick={() => resolveDispute("Under Review")}>
                      Under review
                    </button>
                    <button className="btn btn-xs btn-success" disabled={busy} onClick={() => resolveDispute("Resolved")}>
                      Resolved
                    </button>
                    <button className="btn btn-xs" disabled={busy} onClick={() => resolveDispute("Accepted Adjustment")}>
                      Accepted adj.
                    </button>
                    <button className="btn btn-xs btn-error" disabled={busy} onClick={() => resolveDispute("Rejected")}>
                      Reject dispute
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <h3 className="font-semibold">Write-off</h3>
              <input
                type="number"
                className="input input-bordered input-sm"
                placeholder="Amount"
                value={writeOffAmt}
                onChange={(e) => setWriteOffAmt(e.target.value)}
              />
              <input
                className="input input-bordered input-sm"
                placeholder="Reason"
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
              />
              <button className="btn btn-sm btn-outline w-fit" disabled={busy} onClick={requestWriteOff}>
                Request write-off
              </button>
              <ul className="text-sm space-y-2 mt-2">
                {writeOffs.map((w) => (
                  <li key={w.id} className="flex flex-wrap gap-2 items-center justify-between">
                    <span>
                      {formatCurrency(Number(w.amount))} · {w.reason} ·{" "}
                      <StatusBadge status={w.approval_status} />
                    </span>
                    {canApproveWriteOff && w.approval_status !== "Approved" && (
                      <button className="btn btn-xs btn-primary" disabled={busy} onClick={() => approveWriteOff(w.id)}>
                        Approve write-off
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
