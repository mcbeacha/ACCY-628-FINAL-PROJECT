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
  return role === "managing_partner";
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
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewDataQuality(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
}

export function canViewControls(role: UserRole) {
  return role === "managing_partner" || role === "billing_staff";
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

export function navForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "managing_partner":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/clients", label: "Clients" },
        { href: "/matters", label: "Matters" },
        { href: "/tasks", label: "Tasks" },
        { href: "/profitability/matters", label: "Matter Profitability" },
        { href: "/profitability/clients", label: "Client Profitability" },
        { href: "/profitability/practice-areas", label: "Practice Areas" },
        { href: "/productivity", label: "Attorney Productivity" },
        { href: "/reports", label: "Reports" },
        { href: "/data-quality", label: "Data Quality" },
        { href: "/controls", label: "Control Monitor" },
        { href: "/billing-readiness", label: "Billing Readiness" },
        { href: "/time/review", label: "Time Review" },
        { href: "/expenses/review", label: "Expense Review" },
        { href: "/unbilled", label: "Unbilled Activity" },
        { href: "/invoices", label: "Invoices" },
        { href: "/payments", label: "Payments" },
        { href: "/ar", label: "Accounts Receivable" },
        { href: "/retainers", label: "Retainers" },
        { href: "/trust-ledger", label: "Trust Ledger" },
        { href: "/journal", label: "Journal Entries" },
      ];
    case "attorney":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/matters", label: "My Matters" },
        { href: "/tasks", label: "My Tasks" },
        { href: "/time", label: "My Time" },
        { href: "/time/new", label: "Enter Time" },
        { href: "/expenses", label: "My Expenses" },
        { href: "/expenses/new", label: "Enter Expense" },
        { href: "/invoices", label: "Assigned Matter Billing Status" },
      ];
    case "paralegal":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/matters", label: "My Matters" },
        { href: "/tasks", label: "My Tasks" },
        { href: "/time", label: "My Time" },
        { href: "/time/new", label: "Enter Time" },
        { href: "/expenses", label: "My Expenses" },
        { href: "/expenses/new", label: "Enter Expense" },
      ];
    case "billing_staff":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/clients", label: "Clients" },
        { href: "/matters", label: "Matters" },
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
      ];
    case "client":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/matters", label: "My Matters" },
        { href: "/portal", label: "Milestones" },
        { href: "/portal/billing", label: "My Invoices & Payments" },
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
