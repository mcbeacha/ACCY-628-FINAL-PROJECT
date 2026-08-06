import {
  viewerCanApprove,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import {
  canApproveExpenses,
  canApproveInvoices,
  canApproveMatterCosts,
  canApproveMatters,
  canApproveTime,
  canApproveVendors,
  canApproveWriteOffs,
} from "@/lib/permissions";
import { calcBillableAmount } from "@/lib/phase2-types";
import type { UserRole } from "@/lib/types";

const MATTER_CTX =
  "billing_method, practice_area, responsible_attorney_id" as const;

function asMatterCtx(m: unknown): ApprovalMatterContext | null {
  if (!m || typeof m !== "object") return null;
  const row = m as ApprovalMatterContext;
  return {
    billing_method: row.billing_method ?? null,
    practice_area: row.practice_area ?? null,
    responsible_attorney_id: row.responsible_attorney_id ?? null,
  };
}

/** Approval-queue hrefs included in the Inbox badge sum (excludes /inbox itself). */
export const APPROVAL_BADGE_HREFS = [
  "/expenses/review",
  "/costs/review",
  "/time/review",
  "/costs/allocations",
  "/vendors",
  "/invoices",
  "/matters",
  "/marketing",
] as const;

export type ApprovalBadgeHref = (typeof APPROVAL_BADGE_HREFS)[number] | "/inbox";

/**
 * Count pending approvals the viewer can currently act on, keyed by nav href.
 * Inbox is the sum of those queue counts (approval items only).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadNavApprovalBadgeCounts(
  supabase: any,
  input: { role: UserRole; userId: string }
): Promise<Record<string, number>> {
  const { role, userId } = input;
  const next: Record<string, number> = {};

  const empty = Promise.resolve({ data: null as unknown[] | null, error: null });

  const [
    expensesRes,
    costsRes,
    timeRes,
    allocationsRes,
    vendorsRes,
    invoicesRes,
    writeOffsRes,
    mattersRes,
    marketingRes,
  ] = await Promise.all([
    canApproveExpenses(role)
      ? supabase
          .from("expense_entries")
          .select(
            `id, amount, created_by, matters(${MATTER_CTX})`
          )
          .eq("approval_status", "Submitted")
      : empty,
    canApproveMatterCosts(role)
      ? supabase
          .from("matter_cost_entries")
          .select(
            `id, total_cost, created_by, matters(${MATTER_CTX})`
          )
          .eq("approval_status", "Submitted")
      : empty,
    canApproveTime(role)
      ? supabase
          .from("time_entries")
          .select(
            `id, hours, billing_rate, billable_status, matters(${MATTER_CTX})`
          )
          .eq("approval_status", "Submitted")
      : empty,
    role === "managing_partner"
      ? supabase
          .from("cost_allocations")
          .select("id")
          .eq("approval_status", "Submitted")
      : empty,
    canApproveVendors(role)
      ? supabase
          .from("vendors")
          .select("id")
          .eq("approved_vendor_status", false)
      : empty,
    canApproveInvoices(role)
      ? supabase
          .from("invoices")
          .select(
            `id, total_amount, invoice_total, created_by, matters(${MATTER_CTX})`
          )
          .eq("approval_status", "Submitted")
      : empty,
    canApproveWriteOffs(role)
      ? supabase
          .from("write_offs")
          .select(
            `id, amount, invoices(matters(${MATTER_CTX}))`
          )
          .eq("approval_status", "Submitted")
      : empty,
    canApproveMatters(role)
      ? supabase
          .from("matters")
          .select(
            "id, billing_method, practice_area, responsible_attorney_id, approval_status, matter_status"
          )
          .or(
            "approval_status.in.(Pending Approval,Needs Review),matter_status.eq.Pending Approval"
          )
      : empty,
    role === "managing_partner"
      ? supabase
          .from("marketing_spend")
          .select("id")
          .eq("approval_status", "Submitted")
      : empty,
  ]);

  if (!expensesRes.error && expensesRes.data) {
    next["/expenses/review"] = (expensesRes.data as Array<{
      amount: number;
      created_by: string | null;
      matters: unknown;
    }>).filter((row) =>
      viewerCanApprove({
        kind: "expense",
        viewerRole: role,
        viewerId: userId,
        matter: asMatterCtx(row.matters),
        amount: Number(row.amount),
        preparerId: row.created_by,
      }).allowed
    ).length;
  }

  if (!costsRes.error && costsRes.data) {
    next["/costs/review"] = (costsRes.data as Array<{
      total_cost: number;
      created_by: string | null;
      matters: unknown;
    }>).filter((row) =>
      viewerCanApprove({
        kind: "cost",
        viewerRole: role,
        viewerId: userId,
        matter: asMatterCtx(row.matters),
        amount: Number(row.total_cost),
        preparerId: row.created_by,
      }).allowed
    ).length;
  }

  if (!timeRes.error && timeRes.data) {
    next["/time/review"] = (timeRes.data as Array<{
      hours: number;
      billing_rate: number;
      billable_status: string;
      matters: unknown;
    }>).filter((row) =>
      viewerCanApprove({
        kind: "time",
        viewerRole: role,
        viewerId: userId,
        matter: asMatterCtx(row.matters),
        amount: calcBillableAmount(
          Number(row.hours),
          Number(row.billing_rate),
          row.billable_status
        ),
      }).allowed
    ).length;
  }

  if (!allocationsRes.error && allocationsRes.data) {
    next["/costs/allocations"] = (allocationsRes.data as unknown[]).length;
  }

  if (!vendorsRes.error && vendorsRes.data) {
    next["/vendors"] = (vendorsRes.data as unknown[]).length;
  }

  let invoiceCount = 0;
  if (!invoicesRes.error && invoicesRes.data) {
    invoiceCount = (invoicesRes.data as Array<{
      total_amount: number | null;
      invoice_total: number | null;
      created_by: string | null;
      matters: unknown;
    }>).filter((row) =>
      viewerCanApprove({
        kind: "invoice",
        viewerRole: role,
        viewerId: userId,
        matter: asMatterCtx(row.matters),
        amount: Number(row.total_amount ?? row.invoice_total ?? 0),
        preparerId: row.created_by,
      }).allowed
    ).length;
  }

  let writeOffCount = 0;
  if (!writeOffsRes.error && writeOffsRes.data) {
    writeOffCount = (writeOffsRes.data as Array<{
      amount: number;
      invoices: { matters: unknown } | null;
    }>).filter((row) =>
      viewerCanApprove({
        kind: "write_off",
        viewerRole: role,
        viewerId: userId,
        matter: asMatterCtx(row.invoices?.matters),
        amount: Number(row.amount),
      }).allowed
    ).length;
  }
  if (canApproveInvoices(role) || canApproveWriteOffs(role)) {
    next["/invoices"] = invoiceCount + writeOffCount;
  }

  if (!mattersRes.error && mattersRes.data) {
    next["/matters"] = (mattersRes.data as Array<{
      billing_method: string | null;
      practice_area: string | null;
      responsible_attorney_id: string | null;
    }>).filter((row) =>
      viewerCanApprove({
        kind: "matter_engagement",
        viewerRole: role,
        viewerId: userId,
        matter: {
          billing_method: row.billing_method,
          practice_area: row.practice_area,
          responsible_attorney_id: row.responsible_attorney_id,
        },
      }).allowed
    ).length;
  }

  if (!marketingRes.error && marketingRes.data) {
    next["/marketing"] = (marketingRes.data as unknown[]).length;
  }

  next["/inbox"] = APPROVAL_BADGE_HREFS.reduce(
    (sum, href) => sum + (next[href] ?? 0),
    0
  );

  return next;
}
