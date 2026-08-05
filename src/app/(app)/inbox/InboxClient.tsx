"use client";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  kindLabel,
  type InboxItem,
  type InboxKind,
  type InboxMeta,
} from "@/lib/inbox";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const KIND_FILTER_ORDER: InboxKind[] = [
  "matter_approval",
  "time_approval",
  "expense_approval",
  "cost_approval",
  "invoice_approval",
  "write_off_approval",
  "vendor_approval",
  "allocation_approval",
  "billing_readiness",
  "unbilled",
  "low_retainer",
  "draft_payment",
  "draft_invoice",
  "task",
  "time_fix",
  "expense_fix",
  "matter_update",
  "past_due_invoice",
  "client_invoice",
  "client_milestone",
];

function priorityTone(priority: InboxItem["priority"]) {
  if (priority === "urgent") return "border-error/40 bg-error/5";
  if (priority === "high") return "border-warning/40 bg-warning/5";
  return "border-base-300 bg-base-100";
}

export function InboxClient({
  initialItems,
  meta,
  userId,
  role,
  initialKind,
}: {
  initialItems: InboxItem[];
  meta: InboxMeta;
  userId: string;
  role: UserRole;
  initialKind?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const validInitial =
    initialKind && KIND_FILTER_ORDER.includes(initialKind as InboxKind)
      ? (initialKind as InboxKind)
      : "all";
  const [kindFilter, setKindFilter] = useState<InboxKind | "all">(validInitial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kindCounts = useMemo(() => {
    const map = new Map<InboxKind, number>();
    for (const item of items) {
      map.set(item.kind, (map.get(item.kind) || 0) + 1);
    }
    return map;
  }, [items]);

  const visibleKinds = KIND_FILTER_ORDER.filter((k) => (kindCounts.get(k) || 0) > 0);

  const filtered = useMemo(
    () => (kindFilter === "all" ? items : items.filter((i) => i.kind === kindFilter)),
    [items, kindFilter]
  );

  async function decide(item: InboxItem, decision: "Approved" | "Rejected") {
    if (!item.canInlineDecide || !item.recordId) return;

    let reason: string | null = null;
    if (decision === "Rejected") {
      reason = window.prompt("Rejection reason (required):");
      if (!reason?.trim()) {
        setError("A rejection reason is required.");
        return;
      }
    } else if (!window.confirm(`Approve this ${kindLabel(item.kind).toLowerCase()} item?`)) {
      return;
    }

    setBusyId(item.id);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    try {
      if (item.kind === "time_approval") {
        const { error: upErr } = await supabase
          .from("time_entries")
          .update({
            approval_status: decision,
            rejection_reason: reason,
          })
          .eq("id", item.recordId);
        if (upErr) throw upErr;

        await supabase.from("financial_activity").insert({
          action_type: decision === "Approved" ? "time_approved" : "time_rejected",
          record_type: "time_entry",
          record_id: item.recordId,
          matter_id: item.matterId,
          action_description:
            decision === "Approved"
              ? `Time entry approved (${item.hours ?? "?"} hrs).`
              : `Time entry rejected: ${reason}`,
          performed_by: userId,
        });
      } else if (item.kind === "expense_approval") {
        const { error: upErr } = await supabase
          .from("expense_entries")
          .update({
            approval_status: decision,
            rejection_reason: reason,
          })
          .eq("id", item.recordId);
        if (upErr) throw upErr;

        await supabase.from("financial_activity").insert({
          action_type: decision === "Approved" ? "expense_approved" : "expense_rejected",
          record_type: "expense_entry",
          record_id: item.recordId,
          matter_id: item.matterId,
          action_description:
            decision === "Approved"
              ? `Expense approved (${formatCurrency(item.amount)}).`
              : `Expense rejected: ${reason}`,
          performed_by: userId,
        });
      } else if (item.kind === "cost_approval") {
        const notes =
          decision === "Approved"
            ? window.prompt("Approval notes (optional):") ?? ""
            : reason;
        const selfApproval = decision === "Approved" && item.createdBy === userId;
        const { error: upErr } = await supabase
          .from("matter_cost_entries")
          .update({
            approval_status: decision,
            approved_by: decision === "Approved" ? userId : null,
            approved_at: decision === "Approved" ? new Date().toISOString() : null,
            approval_notes: decision === "Approved" ? notes || null : null,
            rejection_reason: decision === "Rejected" ? reason : null,
            self_approval_flag: selfApproval,
          })
          .eq("id", item.recordId);
        if (upErr) throw upErr;

        await supabase.from("financial_activity").insert({
          action_type: decision === "Approved" ? "cost_approved" : "cost_rejected",
          record_type: "matter_cost_entry",
          record_id: item.recordId,
          matter_id: item.matterId,
          client_id: item.clientId,
          action_description:
            decision === "Approved"
              ? `Cost entry approved (${formatCurrency(item.amount)}).`
              : `Cost entry rejected: ${reason}`,
          performed_by: userId,
        });
      } else {
        throw new Error("Inline decision not supported for this item.");
      }

      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setMessage(`${kindLabel(item.kind)} ${decision.toLowerCase()}.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <span className="badge badge-lg badge-outline">
            {items.length} open
          </span>
        }
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

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className={`btn btn-sm ${kindFilter === "all" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setKindFilter("all")}
          >
            All ({items.length})
          </button>
          {visibleKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`btn btn-sm ${kindFilter === kind ? "btn-primary" : "btn-outline"}`}
              onClick={() => setKindFilter(kind)}
            >
              {kindLabel(kind)} ({kindCounts.get(kind)})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "You’re clear" : "No items in this filter"}
          description={
            items.length === 0
              ? role === "managing_partner"
                ? "Nothing is waiting for your approval right now."
                : "No work items need your attention right now."
              : "Try another category above."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`rounded-box border shadow-sm p-4 ${priorityTone(item.priority)}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-ghost badge-sm">{kindLabel(item.kind)}</span>
                    <PriorityBadge
                      priority={
                        item.priority === "urgent"
                          ? "Urgent"
                          : item.priority === "high"
                            ? "High"
                            : "Normal"
                      }
                    />
                    <span className="text-xs opacity-60">{formatDate(item.createdAt)}</span>
                  </div>
                  <h2 className="font-semibold text-base leading-snug">{item.title}</h2>
                  <p className="text-sm opacity-70">{item.subtitle}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
                    {item.matterLabel && <span>{item.matterLabel}</span>}
                    {item.submitter && <span>From {item.submitter}</span>}
                    {item.amount != null && !Number.isNaN(item.amount) && (
                      <span>{formatCurrency(item.amount)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {item.canInlineDecide && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        disabled={busyId === item.id || pending}
                        onClick={() => decide(item, "Approved")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-error btn-outline"
                        disabled={busyId === item.id || pending}
                        onClick={() => decide(item, "Rejected")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <Link href={item.href} className="btn btn-sm btn-primary btn-outline">
                    Open →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
