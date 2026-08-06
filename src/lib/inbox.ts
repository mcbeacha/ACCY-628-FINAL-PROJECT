import { evaluateBillingReadiness } from "@/lib/billing-readiness";
import {
  requiredApproverRole,
  viewerCanApprove,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import { getFirmThresholds } from "@/lib/firm-thresholds";
import { calcBillableAmount } from "@/lib/phase2-types";
import type { Client, Matter, MatterTask, UserRole } from "@/lib/types";

export type InboxPriority = "urgent" | "high" | "normal";

export type InboxKind =
  | "matter_approval"
  | "time_approval"
  | "expense_approval"
  | "cost_approval"
  | "invoice_approval"
  | "write_off_approval"
  | "vendor_approval"
  | "allocation_approval"
  | "billing_readiness"
  | "unbilled"
  | "low_retainer"
  | "draft_payment"
  | "draft_invoice"
  | "task"
  | "time_fix"
  | "expense_fix"
  | "matter_update"
  | "past_due_invoice"
  | "client_invoice"
  | "client_milestone";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  priority: InboxPriority;
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
  amount?: number | null;
  matterLabel?: string | null;
  submitter?: string | null;
  /** When true, inbox UI may offer inline Approve/Reject. */
  canInlineDecide?: boolean;
  recordId?: string;
  matterId?: string | null;
  clientId?: string | null;
  createdBy?: string | null;
  hours?: number | null;
};

export type InboxMeta = {
  title: string;
  description: string;
};

const PRIORITY_RANK: Record<InboxPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

export function inboxMetaForRole(role: UserRole): InboxMeta {
  switch (role) {
    case "managing_partner":
      return {
        title: "Approval Inbox",
        description:
          "Elevated and over-threshold approvals — Contingency / Personal Injury, high-value items, write-offs, vendors, and allocations.",
      };
    case "billing_staff":
      return {
        title: "Billing Inbox",
        description:
          "Expenses, costs, and routine invoices you can approve under firm thresholds, plus readiness gaps, unbilled work, and payments.",
      };
    case "attorney":
      return {
        title: "My Work Inbox",
        description:
          "Time approvals on your matters, routine engagement approvals, tasks, and matter follow-ups.",
      };
    case "paralegal":
      return {
        title: "My Work Inbox",
        description:
          "Tasks, time and expense follow-ups, and matter work that needs your attention.",
      };
    case "client":
      return {
        title: "My Inbox",
        description: "Open invoices and milestones on your matters.",
      };
    default:
      return { title: "Inbox", description: "Items that need your attention." };
  }
}

export function inboxNavLabel(role: UserRole): string {
  return inboxMetaForRole(role).title;
}

export function canViewInbox(_role: UserRole): boolean {
  return true;
}

export function kindLabel(kind: InboxKind): string {
  switch (kind) {
    case "matter_approval":
      return "Matter";
    case "time_approval":
      return "Time";
    case "expense_approval":
      return "Expense";
    case "cost_approval":
      return "Cost";
    case "invoice_approval":
      return "Invoice";
    case "write_off_approval":
      return "Write-off";
    case "vendor_approval":
      return "Vendor";
    case "allocation_approval":
      return "Allocation";
    case "billing_readiness":
      return "Billing readiness";
    case "unbilled":
      return "Unbilled";
    case "low_retainer":
      return "Retainer";
    case "draft_payment":
      return "Payment";
    case "draft_invoice":
      return "Draft invoice";
    case "task":
      return "Task";
    case "time_fix":
      return "Time fix";
    case "expense_fix":
      return "Expense fix";
    case "matter_update":
      return "Matter update";
    case "past_due_invoice":
      return "Past-due invoice";
    case "client_invoice":
      return "Invoice due";
    case "client_milestone":
      return "Milestone";
    default:
      return "Item";
  }
}

/** Map inbox rows into TodaysFocus cards for the Partner Workspace. */
export function inboxItemsToFocus(
  items: InboxItem[],
  limit = 6
): {
  id: string;
  kind: "task" | "document" | "client" | "deadline";
  title: string;
  matterRef: string;
  clientName: string;
  dueDate: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: string;
  href: string;
}[] {
  return items.slice(0, limit).map((item) => {
    const dueDate = item.createdAt.slice(0, 10);
    const priority =
      item.priority === "urgent"
        ? ("Critical" as const)
        : item.priority === "high"
          ? ("High" as const)
          : ("Medium" as const);
    const kind =
      item.kind.includes("invoice") || item.kind.includes("write_off")
        ? ("document" as const)
        : item.kind.includes("matter") || item.kind.includes("vendor")
          ? ("client" as const)
          : item.kind.includes("time") || item.kind.includes("expense") || item.kind.includes("cost")
            ? ("deadline" as const)
            : ("task" as const);
    return {
      id: item.id,
      kind,
      title: item.title,
      matterRef: item.matterLabel || kindLabel(item.kind),
      clientName: item.submitter || item.subtitle,
      dueDate,
      priority,
      status: kindLabel(item.kind),
      href: item.href,
    };
  });
}

function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function matterLabel(m: {
  matter_number?: string | null;
  matter_name?: string | null;
} | null): string | null {
  if (!m) return null;
  if (m.matter_number && m.matter_name) return `${m.matter_number} · ${m.matter_name}`;
  return m.matter_number || m.matter_name || null;
}

function daysPastDue(dueDate: string | null | undefined): number {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asMatterCtx(m: unknown): ApprovalMatterContext | null {
  if (!m || typeof m !== "object") return null;
  const row = m as ApprovalMatterContext;
  return {
    billing_method: row.billing_method ?? null,
    practice_area: row.practice_area ?? null,
    responsible_attorney_id: row.responsible_attorney_id ?? null,
  };
}

async function loadManagingPartnerInbox(supabase: any): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const thresholds = await getFirmThresholds(supabase);

  const [
    mattersRes,
    timeRes,
    expRes,
    costRes,
    invRes,
    writeOffRes,
    vendorRes,
    allocRes,
  ] = await Promise.all([
    supabase
      .from("matters")
      .select(
        "id, matter_number, matter_name, approval_status, matter_status, updated_at, created_at, billing_method, practice_area, responsible_attorney_id"
      )
      .or(
        "approval_status.in.(Pending Approval,Needs Review),matter_status.eq.Pending Approval"
      ),
    supabase
      .from("time_entries")
      .select(
        "id, hours, billing_rate, billable_status, work_date, created_at, matter_id, employee_id, billing_description, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), employee:profiles!time_entries_employee_id_fkey(full_name)"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("expense_entries")
      .select(
        "id, amount, expense_date, created_at, matter_id, created_by, description, required_approver_role, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), creator:profiles!expense_entries_created_by_fkey(full_name)"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("matter_cost_entries")
      .select(
        "id, total_cost, cost_date, created_at, matter_id, client_id, created_by, description, required_approver_role, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), creator:profiles!matter_cost_entries_created_by_fkey(full_name)"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, total_amount, invoice_total, balance_due, due_date, created_at, created_by, matter_id, approval_status, invoice_status, required_approver_role, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id)"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("write_offs")
      .select(
        "id, amount, created_at, invoice_id, approval_status, invoices(id, invoice_number, matter_id, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id))"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("vendors")
      .select("id, vendor_name, created_at, approved_vendor_status")
      .eq("approved_vendor_status", false),
    supabase
      .from("cost_allocations")
      .select(
        "id, created_at, approval_status, allocation_number, description, shared_cost_amount"
      )
      .eq("approval_status", "Submitted"),
  ]);

  for (const m of mattersRes.data || []) {
    const decision = requiredApproverRole({
      kind: "matter_engagement",
      matter: m,
      thresholds,
    });
    if (decision.requiredRole !== "managing_partner") continue;
    const needsReview = m.approval_status === "Needs Review";
    items.push({
      id: `matter-${m.id}`,
      kind: "matter_approval",
      priority: needsReview ? "urgent" : "high",
      title: needsReview
        ? `Matter needs review: ${m.matter_number || "Matter"}`
        : `Matter awaiting approval: ${m.matter_number || "Matter"}`,
      subtitle: decision.reason,
      href: `/matters/${m.id}`,
      createdAt: m.updated_at || m.created_at || new Date().toISOString(),
      matterLabel: matterLabel(m),
    });
  }

  // Time never requires MP as primary approver — leave to responsible attorneys.
  void timeRes;

  for (const e of expRes.data || []) {
    const decision = requiredApproverRole({
      kind: "expense",
      matter: asMatterCtx(e.matters),
      amount: Number(e.amount),
      thresholds,
      stampedRequiredRole: e.required_approver_role,
    });
    if (decision.requiredRole !== "managing_partner") continue;
    items.push({
      id: `expense-${e.id}`,
      kind: "expense_approval",
      priority: "high",
      title: `Expense — $${Number(e.amount).toFixed(2)}`,
      subtitle: decision.reason,
      href: `/expenses/review`,
      createdAt: e.created_at || `${e.expense_date}T00:00:00`,
      amount: Number(e.amount),
      matterLabel: matterLabel(e.matters),
      submitter: e.creator?.full_name || null,
      canInlineDecide: true,
      recordId: e.id,
      matterId: e.matter_id,
      createdBy: e.created_by,
    });
  }

  for (const c of costRes.data || []) {
    const amount = Number(c.total_cost ?? 0);
    const decision = requiredApproverRole({
      kind: "cost",
      matter: asMatterCtx(c.matters),
      amount,
      thresholds,
      stampedRequiredRole: c.required_approver_role,
    });
    if (decision.requiredRole !== "managing_partner") continue;
    items.push({
      id: `cost-${c.id}`,
      kind: "cost_approval",
      priority: "high",
      title: `Cost entry — $${amount.toFixed(2)}`,
      subtitle: decision.reason,
      href: `/costs/review`,
      createdAt: c.created_at || `${c.cost_date}T00:00:00`,
      amount,
      matterLabel: matterLabel(c.matters),
      submitter: c.creator?.full_name || null,
      canInlineDecide: true,
      recordId: c.id,
      matterId: c.matter_id,
      clientId: c.client_id,
      createdBy: c.created_by,
    });
  }

  for (const inv of invRes.data || []) {
    const amount = Number(inv.invoice_total ?? inv.total_amount ?? inv.balance_due ?? 0);
    const decision = requiredApproverRole({
      kind: "invoice",
      matter: asMatterCtx(inv.matters),
      amount,
      preparerId: inv.created_by,
      thresholds,
      stampedRequiredRole: inv.required_approver_role,
    });
    if (decision.requiredRole !== "managing_partner") continue;
    const past = daysPastDue(inv.due_date);
    items.push({
      id: `invoice-${inv.id}`,
      kind: "invoice_approval",
      priority: past > 0 ? "urgent" : "high",
      title: `Invoice ${inv.invoice_number || ""} awaiting approval`.trim(),
      subtitle: decision.reason,
      href: `/invoices/${inv.id}`,
      createdAt: inv.created_at || new Date().toISOString(),
      amount,
      matterLabel: matterLabel(inv.matters),
    });
  }

  for (const w of writeOffRes.data || []) {
    const inv = w.invoices;
    items.push({
      id: `writeoff-${w.id}`,
      kind: "write_off_approval",
      priority: "urgent",
      title: `Write-off request — $${Number(w.amount).toFixed(2)}`,
      subtitle: inv?.invoice_number
        ? `Invoice ${inv.invoice_number}`
        : "Submitted write-off",
      href: inv?.id ? `/invoices/${inv.id}` : "/invoices",
      createdAt: w.created_at || new Date().toISOString(),
      amount: Number(w.amount),
      matterLabel: matterLabel(inv?.matters),
    });
  }

  for (const v of vendorRes.data || []) {
    items.push({
      id: `vendor-${v.id}`,
      kind: "vendor_approval",
      priority: "normal",
      title: `Vendor pending approval: ${v.vendor_name || "Vendor"}`,
      subtitle: "Not yet marked as approved vendor",
      href: "/vendors",
      createdAt: v.created_at || new Date().toISOString(),
    });
  }

  for (const a of allocRes.data || []) {
    items.push({
      id: `alloc-${a.id}`,
      kind: "allocation_approval",
      priority: "normal",
      title: `Cost allocation ${a.allocation_number || ""}`.trim(),
      subtitle: a.description || "Submitted for partner approval",
      href: "/costs/allocations",
      createdAt: a.created_at || new Date().toISOString(),
      amount: a.shared_cost_amount != null ? Number(a.shared_cost_amount) : null,
    });
  }

  return sortInbox(items);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadBillingInbox(supabase: any, profileId: string): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const thresholds = await getFirmThresholds(supabase);

  const [
    expRes,
    costRes,
    mattersRes,
    invRes,
    payRes,
    retRes,
    timeRes,
    expUnbilledRes,
  ] = await Promise.all([
    supabase
      .from("expense_entries")
      .select(
        "id, amount, expense_date, created_at, matter_id, created_by, description, required_approver_role, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), creator:profiles!expense_entries_created_by_fkey(full_name)"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("matter_cost_entries")
      .select(
        "id, total_cost, cost_date, created_at, matter_id, client_id, created_by, description, required_approver_role, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), creator:profiles!matter_cost_entries_created_by_fkey(full_name)"
      )
      .eq("approval_status", "Submitted"),
    supabase
      .from("matters")
      .select("*, clients(*)")
      .eq("approval_status", "Approved"),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, total_amount, invoice_total, balance_due, created_at, created_by, approval_status, invoice_status, required_approver_role, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id)"
      )
      .or("approval_status.eq.Draft,invoice_status.eq.Draft,approval_status.eq.Submitted"),
    supabase.from("payments").select("id, payment_number, total_amount, created_at, payment_status").eq("payment_status", "Draft"),
    supabase
      .from("retainer_accounts")
      .select("id, current_balance, account_status, updated_at, matters(matter_number, matter_name)")
      .in("account_status", ["Below Threshold", "Exhausted"]),
    supabase
      .from("time_entries")
      .select("id, hours, billing_rate, billable_status, approval_status, invoice_status, matter_id, matters(matter_number, matter_name)")
      .eq("approval_status", "Approved")
      .eq("invoice_status", "Unbilled")
      .eq("billable_status", "Billable"),
    supabase
      .from("expense_entries")
      .select("id, amount, approval_status, invoice_status, client_reimbursable, matter_id, matters(matter_number, matter_name)")
      .eq("approval_status", "Approved")
      .eq("client_reimbursable", true)
      .eq("invoice_status", "Unbilled"),
  ]);

  for (const e of expRes.data || []) {
    const decision = requiredApproverRole({
      kind: "expense",
      matter: asMatterCtx(e.matters),
      amount: Number(e.amount),
      thresholds,
      stampedRequiredRole: e.required_approver_role,
    });
    if (decision.requiredRole !== "billing_staff") continue;
    if (e.created_by === profileId) continue;
    items.push({
      id: `expense-${e.id}`,
      kind: "expense_approval",
      priority: "high",
      title: `Expense to approve — $${Number(e.amount).toFixed(2)}`,
      subtitle: decision.reason,
      href: "/expenses/review",
      createdAt: e.created_at || `${e.expense_date}T00:00:00`,
      amount: Number(e.amount),
      matterLabel: matterLabel(e.matters),
      submitter: e.creator?.full_name || null,
      canInlineDecide: true,
      recordId: e.id,
      matterId: e.matter_id,
      createdBy: e.created_by,
    });
  }

  for (const c of costRes.data || []) {
    const amount = Number(c.total_cost ?? 0);
    const decision = requiredApproverRole({
      kind: "cost",
      matter: asMatterCtx(c.matters),
      amount,
      thresholds,
      stampedRequiredRole: c.required_approver_role,
    });
    if (decision.requiredRole !== "billing_staff") continue;
    if (c.created_by === profileId) continue;
    items.push({
      id: `cost-${c.id}`,
      kind: "cost_approval",
      priority: "high",
      title: `Cost to approve — $${amount.toFixed(2)}`,
      subtitle: decision.reason,
      href: "/costs/review",
      createdAt: c.created_at || `${c.cost_date}T00:00:00`,
      amount,
      matterLabel: matterLabel(c.matters),
      submitter: c.creator?.full_name || null,
      canInlineDecide: true,
      recordId: c.id,
      matterId: c.matter_id,
      clientId: c.client_id,
      createdBy: c.created_by,
    });
  }

  for (const m of (mattersRes.data || []) as Matter[]) {
    const row = evaluateBillingReadiness(m, (m.clients as Client) || null);
    if (row.status === "Ready") continue;
    items.push({
      id: `readiness-${m.id}`,
      kind: "billing_readiness",
      priority: row.status === "Needs Review" ? "urgent" : "high",
      title: `${m.matter_number || "Matter"} — ${row.status}`,
      subtitle: row.missing.slice(0, 3).join("; ") || row.status,
      href: "/billing-readiness",
      createdAt: m.updated_at || m.created_at || new Date().toISOString(),
      matterLabel: matterLabel(m),
    });
  }

  for (const inv of invRes.data || []) {
    const isSubmitted = inv.approval_status === "Submitted";
    const amount = Number(inv.invoice_total ?? inv.total_amount ?? 0);
    if (isSubmitted) {
      const decision = requiredApproverRole({
        kind: "invoice",
        matter: asMatterCtx(inv.matters),
        amount,
        preparerId: inv.created_by,
        thresholds,
        stampedRequiredRole: inv.required_approver_role,
      });
      const selfPrepared = inv.created_by === profileId;
      const billingCanApprove =
        decision.requiredRole === "billing_staff" && !selfPrepared;
      items.push({
        id: `invoice-sub-${inv.id}`,
        kind: "invoice_approval",
        priority: "high",
        title: `Invoice ${inv.invoice_number || ""} pending approval`.trim(),
        subtitle: billingCanApprove
          ? decision.reason
          : selfPrepared
            ? "Self-prepared — awaiting Managing Partner"
            : decision.reason,
        href: `/invoices/${inv.id}`,
        createdAt: inv.created_at || new Date().toISOString(),
        amount,
        matterLabel: matterLabel(inv.matters),
      });
    } else {
      items.push({
        id: `invoice-draft-${inv.id}`,
        kind: "draft_invoice",
        priority: "normal",
        title: `Draft invoice ${inv.invoice_number || ""}`.trim(),
        subtitle: "Finish preparation or submit for approval",
        href: `/invoices/${inv.id}`,
        createdAt: inv.created_at || new Date().toISOString(),
        amount,
        matterLabel: matterLabel(inv.matters),
      });
    }
  }

  for (const p of payRes.data || []) {
    items.push({
      id: `pay-${p.id}`,
      kind: "draft_payment",
      priority: "normal",
      title: `Draft payment ${p.payment_number || ""}`.trim(),
      subtitle: "Post or complete this payment",
      href: "/payments",
      createdAt: p.created_at || new Date().toISOString(),
      amount: Number(p.total_amount ?? 0),
    });
  }

  for (const r of retRes.data || []) {
    items.push({
      id: `ret-${r.id}`,
      kind: "low_retainer",
      priority: r.account_status === "Exhausted" ? "urgent" : "high",
      title: `Retainer ${r.account_status}`,
      subtitle: `Balance $${Number(r.current_balance).toFixed(2)}`,
      href: "/retainers",
      createdAt: r.updated_at || new Date().toISOString(),
      amount: Number(r.current_balance),
      matterLabel: matterLabel(r.matters),
    });
  }

  const unbilledAmt =
    (timeRes.data || []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, t: any) =>
        s + calcBillableAmount(Number(t.hours), Number(t.billing_rate), t.billable_status),
      0
    ) +
    (expUnbilledRes.data || []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, e: any) => s + Number(e.amount),
      0
    );
  const unbilledCount = (timeRes.data || []).length + (expUnbilledRes.data || []).length;
  if (unbilledCount > 0) {
    items.push({
      id: "unbilled-summary",
      kind: "unbilled",
      priority: "normal",
      title: `${unbilledCount} unbilled approved items`,
      subtitle: "Ready to select for invoicing",
      href: "/unbilled",
      createdAt: new Date().toISOString(),
      amount: unbilledAmt,
    });
  }

  return sortInbox(items);
}

async function loadStaffWorkInbox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileId: string,
  role: "attorney" | "paralegal"
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);

  const [
    { data: tasks },
    { data: myTime },
    { data: myExp },
    { data: matters },
    { data: pendingTime },
    { data: pendingMatters },
  ] = await Promise.all([
      supabase
        .from("matter_tasks")
        .select("*, matters(matter_number, matter_name)")
        .eq("assigned_to", profileId)
        .order("due_date", { ascending: true }),
      supabase
        .from("time_entries")
        .select("id, hours, approval_status, work_date, created_at, rejection_reason, matters(matter_number, matter_name)")
        .eq("employee_id", profileId)
        .in("approval_status", ["Draft", "Rejected"]),
      supabase
        .from("expense_entries")
        .select("id, amount, approval_status, expense_date, created_at, rejection_reason, matters(matter_number, matter_name)")
        .eq("created_by", profileId)
        .eq("approval_status", "Rejected"),
      supabase
        .from("matters")
        .select("id, matter_number, matter_name, matter_status, approval_status, updated_at, created_at")
        .order("updated_at", { ascending: false }),
      role === "attorney"
        ? supabase
            .from("time_entries")
            .select(
              "id, hours, billing_rate, billable_status, work_date, created_at, matter_id, billing_description, matters(matter_number, matter_name, billing_method, practice_area, responsible_attorney_id), employee:profiles!time_entries_employee_id_fkey(full_name)"
            )
            .eq("approval_status", "Submitted")
        : Promise.resolve({ data: [] }),
      role === "attorney"
        ? supabase
            .from("matters")
            .select(
              "id, matter_number, matter_name, approval_status, matter_status, updated_at, created_at, billing_method, practice_area, responsible_attorney_id"
            )
            .or(
              "approval_status.in.(Pending Approval,Needs Review),matter_status.eq.Pending Approval"
            )
        : Promise.resolve({ data: [] }),
    ]);

  if (role === "attorney") {
    for (const t of pendingTime || []) {
      const gate = viewerCanApprove({
        kind: "time",
        viewerRole: "attorney",
        viewerId: profileId,
        matter: asMatterCtx(t.matters),
        amount: calcBillableAmount(
          Number(t.hours),
          Number(t.billing_rate),
          t.billable_status
        ),
      });
      if (!gate.allowed) continue;
      items.push({
        id: `time-approve-${t.id}`,
        kind: "time_approval",
        priority: "high",
        title: `Time to approve — ${Number(t.hours)} hrs`,
        subtitle: gate.decision.reason,
        href: "/time/review",
        createdAt: t.created_at || `${t.work_date}T00:00:00`,
        amount: calcBillableAmount(
          Number(t.hours),
          Number(t.billing_rate),
          t.billable_status
        ),
        matterLabel: matterLabel(t.matters),
        submitter: t.employee?.full_name || null,
        canInlineDecide: true,
        recordId: t.id,
        matterId: t.matter_id,
        hours: Number(t.hours),
      });
    }

    for (const m of pendingMatters || []) {
      const gate = viewerCanApprove({
        kind: "matter_engagement",
        viewerRole: "attorney",
        viewerId: profileId,
        matter: m,
      });
      if (!gate.allowed) continue;
      items.push({
        id: `matter-approve-${m.id}`,
        kind: "matter_approval",
        priority: m.approval_status === "Needs Review" ? "urgent" : "high",
        title: `Engagement to approve: ${m.matter_number || "Matter"}`,
        subtitle: gate.decision.reason,
        href: `/matters/${m.id}`,
        createdAt: m.updated_at || m.created_at || new Date().toISOString(),
        matterLabel: matterLabel(m),
      });
    }
  }

  for (const t of (tasks || []) as MatterTask[]) {
    if (["Completed", "Canceled"].includes(t.task_status)) continue;
    const overdue = t.due_date
      ? new Date(`${t.due_date}T00:00:00`) < today
      : false;
    const dueSoon =
      t.due_date &&
      !overdue &&
      new Date(`${t.due_date}T00:00:00`) <= soon;
    const waiting = t.task_status === "Waiting";
    if (!overdue && !dueSoon && !waiting && role === "attorney") {
      // still surface high-priority open tasks
      if (t.priority !== "Urgent" && t.priority !== "High") continue;
    }
    if (!overdue && !dueSoon && !waiting && role === "paralegal") {
      if (t.priority !== "Urgent" && t.priority !== "High") continue;
    }
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      priority: overdue || t.priority === "Urgent" ? "urgent" : waiting || dueSoon ? "high" : "normal",
      title: t.task_title || "Task",
      subtitle: [
        overdue ? "Overdue" : dueSoon ? "Due soon" : waiting ? "Waiting" : t.task_status,
        matterLabel(t.matters as { matter_number?: string; matter_name?: string } | null),
      ]
        .filter(Boolean)
        .join(" · "),
      href: overdue
        ? "/tasks?filter=overdue"
        : dueSoon
          ? "/tasks?filter=due_soon"
          : waiting
            ? "/tasks?filter=waiting"
            : "/tasks?filter=open",
      createdAt: t.due_date ? `${t.due_date}T00:00:00` : t.created_at || new Date().toISOString(),
      matterLabel: matterLabel(t.matters as { matter_number?: string; matter_name?: string } | null),
    });
  }

  for (const t of myTime || []) {
    const rejected = t.approval_status === "Rejected";
    items.push({
      id: `time-fix-${t.id}`,
      kind: "time_fix",
      priority: rejected ? "high" : "normal",
      title: rejected ? "Rejected time entry needs fix" : "Draft time entry to submit",
      subtitle: t.rejection_reason || `${Number(t.hours)} hrs`,
      href: "/time",
      createdAt: t.created_at || `${t.work_date}T00:00:00`,
      matterLabel: matterLabel(t.matters),
      hours: Number(t.hours),
    });
  }

  for (const e of myExp || []) {
    items.push({
      id: `expense-fix-${e.id}`,
      kind: "expense_fix",
      priority: "high",
      title: "Rejected expense needs fix",
      subtitle: e.rejection_reason || `$${Number(e.amount).toFixed(2)}`,
      href: "/expenses",
      createdAt: e.created_at || `${e.expense_date}T00:00:00`,
      amount: Number(e.amount),
      matterLabel: matterLabel(e.matters),
    });
  }

  if (role === "attorney") {
    for (const m of matters || []) {
      const needsUpdate =
        ["Draft", "Pending Approval", "Needs Review", "On Hold"].includes(m.matter_status) ||
        ["Needs Review", "Returned for Correction"].includes(m.approval_status);
      if (!needsUpdate) continue;
      items.push({
        id: `matter-upd-${m.id}`,
        kind: "matter_update",
        priority: m.approval_status === "Needs Review" ? "urgent" : "high",
        title: `Matter needs update: ${m.matter_number || "Matter"}`,
        subtitle: `${m.matter_status} / ${m.approval_status}`,
        href: `/matters/${m.id}`,
        createdAt: m.updated_at || m.created_at || new Date().toISOString(),
        matterLabel: matterLabel(m),
      });
    }

    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, balance_due, due_date, finalized_at, invoice_status, matters(matter_number, matter_name)"
      )
      .gt("balance_due", 0)
      .order("due_date", { ascending: true })
      .limit(40);

    for (const inv of invoices || []) {
      if (!inv.finalized_at) continue;
      const past = daysPastDue(inv.due_date);
      if (past <= 0) continue;
      items.push({
        id: `pastdue-${inv.id}`,
        kind: "past_due_invoice",
        priority: past > 30 ? "urgent" : "high",
        title: `Past-due invoice ${inv.invoice_number || ""}`.trim(),
        subtitle: `${past} days past due`,
        href: `/invoices/${inv.id}`,
        createdAt: inv.due_date ? `${inv.due_date}T00:00:00` : new Date().toISOString(),
        amount: Number(inv.balance_due),
        matterLabel: matterLabel(inv.matters),
      });
    }
  }

  return sortInbox(items);
}

async function loadClientInbox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileId: string
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("portal_user_id", profileId)
    .maybeSingle();

  const { data: matters } = await supabase
    .from("matters")
    .select("id, matter_number, matter_name")
    .order("created_at", { ascending: false });

  const matterIds = (matters || []).map((m: { id: string }) => m.id);

  if (client?.id) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, balance_due, due_date, invoice_status, finalized_at, matters(matter_number, matter_name)"
      )
      .eq("client_id", client.id)
      .gt("balance_due", 0)
      .order("due_date", { ascending: true });

    for (const inv of invoices || []) {
      if (!inv.finalized_at && inv.invoice_status === "Draft") continue;
      const past = daysPastDue(inv.due_date);
      items.push({
        id: `client-inv-${inv.id}`,
        kind: "client_invoice",
        priority: past > 0 ? "urgent" : "high",
        title: `Invoice ${inv.invoice_number || ""}`.trim(),
        subtitle: past > 0 ? `${past} days past due` : "Balance due",
        href: "/portal/billing",
        createdAt: inv.due_date ? `${inv.due_date}T00:00:00` : new Date().toISOString(),
        amount: Number(inv.balance_due),
        matterLabel: matterLabel(inv.matters),
      });
    }
  }

  if (matterIds.length) {
    const { data: tasks } = await supabase
      .from("matter_tasks")
      .select("*, matters(matter_number, matter_name)")
      .eq("client_visible", true)
      .in("matter_id", matterIds)
      .order("due_date", { ascending: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of (tasks || []) as MatterTask[]) {
      if (["Completed", "Canceled"].includes(t.task_status)) continue;
      const overdue = t.due_date
        ? new Date(`${t.due_date}T00:00:00`) < today
        : false;
      if (!overdue && t.priority !== "Urgent" && t.priority !== "High") continue;
      items.push({
        id: `milestone-${t.id}`,
        kind: "client_milestone",
        priority: overdue ? "urgent" : "high",
        title: t.task_title || "Milestone",
        subtitle: overdue ? "Overdue" : t.task_status,
        href: "/portal",
        createdAt: t.due_date ? `${t.due_date}T00:00:00` : t.created_at || new Date().toISOString(),
        matterLabel: matterLabel(t.matters as { matter_number?: string; matter_name?: string } | null),
      });
    }
  }

  return sortInbox(items);
}

export async function loadInboxItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: UserRole,
  profileId: string
): Promise<InboxItem[]> {
  switch (role) {
    case "managing_partner":
      return loadManagingPartnerInbox(supabase);
    case "billing_staff":
      return loadBillingInbox(supabase, profileId);
    case "attorney":
      return loadStaffWorkInbox(supabase, profileId, "attorney");
    case "paralegal":
      return loadStaffWorkInbox(supabase, profileId, "paralegal");
    case "client":
      return loadClientInbox(supabase, profileId);
    default:
      return [];
  }
}
