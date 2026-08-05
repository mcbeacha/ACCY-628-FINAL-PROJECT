import type { UserRole } from "./types";

export function canViewAllClients(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canCreateClients(role: UserRole) {
  return role === "managing_partner" || role === "attorney";
}

export function canCreateMatters(role: UserRole) {
  return role === "managing_partner" || role === "attorney";
}

export function canApproveMatters(role: UserRole) {
  return role === "managing_partner";
}

export function canAssignTeam(role: UserRole) {
  return role === "managing_partner" || role === "attorney";
}

export function canViewBillingReadiness(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canManageInternalTasks(role: UserRole) {
  return role === "managing_partner" || role === "attorney" || role === "paralegal";
}

export function canEnterTime(role: UserRole) {
  return role === "managing_partner" || role === "attorney" || role === "paralegal";
}

export function canApproveTime(role: UserRole) {
  return role === "managing_partner" || role === "attorney";
}

export function canApproveExpenses(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewUnbilled(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canManageRetainers(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canPrepareInvoices(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canApproveInvoices(role: UserRole) {
  return role === "managing_partner";
}

export function canPostPayments(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewAR(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewJournal(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canApproveWriteOffs(role: UserRole) {
  return role === "managing_partner";
}

export function canViewProfitability(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewProductivity(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewReports(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff" || role === "attorney";
}

export function canViewDataQuality(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewControls(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canManageVendors(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canApproveVendors(role: UserRole) {
  return role === "managing_partner";
}

export function canEnterMatterCosts(role: UserRole) {
  return (
    role === "managing_partner" ||
    role === "billing_staff" ||
    role === "attorney" ||
    role === "paralegal"
  );
}

export function canApproveMatterCosts(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canManageAllocations(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewCostDashboard(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewMatterCosts(role: UserRole) {
  return role !== "client";
}

export function canViewInternalCost(role: UserRole) {
  return (
    role === "managing_partner" ||
    role === "billing_staff" ||
    role === "attorney" ||
    role === "paralegal"
  );
}

export function isClientRole(role: UserRole) {
  return role === "client";
}

export function isStaffRole(role: UserRole) {
  return role !== "client";
}

export type NavItem = { href: string; label: string };

/** Workspace tools every staff role shares. */
const STAFF_WORKSPACE: NavItem[] = [
  { href: "/calendar", label: "Calendar" },
  { href: "/documents", label: "Documents" },
];

/** Firm-wide references available to every staff role. */
const STAFF_FIRM: NavItem[] = [
  { href: "/messages", label: "Messages" },
  { href: "/research", label: "Legal Research" },
  { href: "/directory", label: "Firm Directory" },
  { href: "/resources", label: "Resources" },
  { href: "/settings", label: "Settings" },
];

export function navForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "managing_partner":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/case-evaluations", label: "Case Evaluations" },
        { href: "/costs", label: "Cost & Resources" },
        { href: "/vendors", label: "Vendors" },
        { href: "/costs/new", label: "Cost Entry" },
        { href: "/costs/vendor-charge", label: "Vendor Charge" },
        { href: "/costs/allocations", label: "Cost Allocations" },
        { href: "/costs/review", label: "Cost Approval" },
        { href: "/clients", label: "Clients" },
        { href: "/matters", label: "Matters" },
        { href: "/tasks", label: "Tasks" },
        ...STAFF_WORKSPACE,
        { href: "/profitability/matters", label: "Matter Profitability" },
        { href: "/profitability/clients", label: "Client Profitability" },
        { href: "/profitability/practice-areas", label: "Practice Areas" },
        { href: "/productivity", label: "Attorney Productivity" },
        { href: "/reports", label: "Reports" },
        { href: "/data-quality", label: "Data Quality" },
        { href: "/controls", label: "Control Monitor" },
        { href: "/billing-readiness", label: "Billing Readiness" },
        { href: "/time/review", label: "Time Review / Out-of-Scope" },
        { href: "/expenses/review", label: "Expense Review" },
        { href: "/unbilled", label: "Unbilled Activity" },
        { href: "/invoices", label: "Invoices" },
        { href: "/payments", label: "Payments" },
        { href: "/ar", label: "Accounts Receivable" },
        { href: "/retainers", label: "Retainers" },
        { href: "/trust-ledger", label: "Trust Ledger" },
        { href: "/journal", label: "Journal Entries" },
        ...STAFF_FIRM,
      ];
    case "attorney":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/clients", label: "Clients" },
        { href: "/case-evaluations", label: "Case Evaluations" },
        { href: "/matters", label: "My Matters" },
        { href: "/tasks", label: "My Tasks" },
        ...STAFF_WORKSPACE,
        { href: "/time", label: "My Time" },
        { href: "/time/new", label: "Enter Time" },
        { href: "/time/review", label: "Review Time / Out-of-Scope" },
        { href: "/expenses", label: "My Expenses" },
        { href: "/expenses/new", label: "Enter Expense" },
        { href: "/costs/new", label: "Cost Entry" },
        { href: "/costs/vendor-charge", label: "Request Vendor Charge" },
        { href: "/invoices", label: "Assigned Matter Billing Status" },
        { href: "/reports", label: "Reports" },
        ...STAFF_FIRM,
      ];
    case "paralegal":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/case-evaluations", label: "Case Evaluations" },
        { href: "/matters", label: "My Matters" },
        { href: "/tasks", label: "My Tasks" },
        ...STAFF_WORKSPACE,
        { href: "/time", label: "My Time" },
        { href: "/time/new", label: "Enter Time" },
        { href: "/expenses", label: "My Expenses" },
        { href: "/expenses/new", label: "Enter Expense" },
        { href: "/costs/new", label: "Cost Entry" },
        ...STAFF_FIRM,
      ];
    case "billing_staff":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/costs", label: "Cost & Resources" },
        { href: "/vendors", label: "Vendors" },
        { href: "/costs/new", label: "Cost Entry" },
        { href: "/costs/vendor-charge", label: "Vendor Charge" },
        { href: "/costs/allocations", label: "Cost Allocations" },
        { href: "/costs/review", label: "Cost Approval" },
        { href: "/clients", label: "Clients" },
        { href: "/matters", label: "Matters" },
        ...STAFF_WORKSPACE,
        { href: "/profitability/matters", label: "Matter Profitability" },
        { href: "/profitability/clients", label: "Client Profitability" },
        { href: "/profitability/practice-areas", label: "Practice Areas" },
        { href: "/productivity", label: "Productivity" },
        { href: "/reports", label: "Reports" },
        { href: "/data-quality", label: "Data Quality" },
        { href: "/controls", label: "Control Monitor" },
        { href: "/billing-readiness", label: "Billing Readiness" },
        { href: "/unbilled", label: "Unbilled Activity" },
        { href: "/expenses/review", label: "Expense Review" },
        { href: "/invoices", label: "Invoices" },
        { href: "/invoices/new", label: "Prepare Invoice" },
        { href: "/payments", label: "Payments" },
        { href: "/ar", label: "Accounts Receivable" },
        { href: "/retainers", label: "Retainers" },
        { href: "/trust-ledger", label: "Trust Ledger" },
        { href: "/journal", label: "Journal Entries" },
        ...STAFF_FIRM,
      ];
    case "client":
      return [
        { href: "/dashboard", label: "Home" },
        { href: "/matters", label: "My Matters" },
        { href: "/portal", label: "Milestones" },
        { href: "/portal/billing", label: "My Invoices & Payments" },
        { href: "/settings", label: "Settings" },
      ];
    default:
      return [{ href: "/dashboard", label: "Dashboard" }];
  }
}

/** AR aging bucket from due date and balance */
export function arAgingBucket(dueDate: string, balanceDue: number, status: string): string {
  if (balanceDue <= 0 || ["Paid", "Canceled", "Written Off"].includes(status)) {
    return "Current / Settled";
  }
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysPast = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (daysPast <= 0) return "Current";
  if (daysPast <= 30) return "1–30";
  if (daysPast <= 60) return "31–60";
  if (daysPast <= 90) return "61–90";
  return "90+";
}
