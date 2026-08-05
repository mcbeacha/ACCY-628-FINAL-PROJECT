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
  return role === "managing_partner" || role === "billing_staff" || role === "attorney";
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

/**
 * Icon keys are resolved to components in `AppShell` so this module stays free
 * of JSX and can be imported from server code.
 */
export type NavIcon =
  | "dashboard"
  | "matters"
  | "clients"
  | "calendar"
  | "tasks"
  | "documents"
  | "time"
  | "expenses"
  | "messages"
  | "research"
  | "reports"
  | "directory"
  | "resources"
  | "settings"
  | "profitability"
  | "productivity"
  | "quality"
  | "controls"
  | "billing"
  | "invoices"
  | "payments"
  | "receivables"
  | "retainers"
  | "trust"
  | "journal"
  | "unbilled"
  | "review";

export type NavItem = {
  href: string;
  label: string;
  icon?: NavIcon;
  /** Optional grouping label rendered above the item in the sidebar. */
  group?: string;
};

/** Workspace tools every staff role shares. */
const STAFF_WORKSPACE: NavItem[] = [
  { href: "/calendar", label: "Calendar", icon: "calendar", group: "Workspace" },
  { href: "/tasks", label: "Tasks", icon: "tasks", group: "Workspace" },
  { href: "/documents", label: "Documents", icon: "documents", group: "Workspace" },
];

const STAFF_FIRM: NavItem[] = [
  { href: "/directory", label: "Firm Directory", icon: "directory", group: "Firm" },
  { href: "/resources", label: "Resources", icon: "resources", group: "Firm" },
  { href: "/settings", label: "Settings", icon: "settings", group: "Firm" },
];

export function navForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "managing_partner":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Workspace" },
        { href: "/matters", label: "Matters", icon: "matters", group: "Workspace" },
        { href: "/clients", label: "Clients", icon: "clients", group: "Workspace" },
        ...STAFF_WORKSPACE,
        { href: "/time/review", label: "Time Review", icon: "review", group: "Practice" },
        { href: "/expenses/review", label: "Expense Review", icon: "review", group: "Practice" },
        { href: "/messages", label: "Messages", icon: "messages", group: "Practice" },
        { href: "/research", label: "Legal Research", icon: "research", group: "Practice" },
        { href: "/billing-readiness", label: "Billing Readiness", icon: "billing", group: "Billing" },
        { href: "/unbilled", label: "Unbilled Activity", icon: "unbilled", group: "Billing" },
        { href: "/invoices", label: "Invoices", icon: "invoices", group: "Billing" },
        { href: "/payments", label: "Payments", icon: "payments", group: "Billing" },
        { href: "/ar", label: "Accounts Receivable", icon: "receivables", group: "Billing" },
        { href: "/retainers", label: "Retainers", icon: "retainers", group: "Billing" },
        { href: "/trust-ledger", label: "Trust Ledger", icon: "trust", group: "Billing" },
        { href: "/journal", label: "Journal Entries", icon: "journal", group: "Billing" },
        { href: "/profitability/matters", label: "Matter Profitability", icon: "profitability", group: "Analytics" },
        { href: "/profitability/clients", label: "Client Profitability", icon: "profitability", group: "Analytics" },
        { href: "/profitability/practice-areas", label: "Practice Areas", icon: "profitability", group: "Analytics" },
        { href: "/productivity", label: "Attorney Productivity", icon: "productivity", group: "Analytics" },
        { href: "/reports", label: "Reports", icon: "reports", group: "Analytics" },
        { href: "/data-quality", label: "Data Quality", icon: "quality", group: "Analytics" },
        { href: "/controls", label: "Control Monitor", icon: "controls", group: "Analytics" },
        ...STAFF_FIRM,
      ];
    case "attorney":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Workspace" },
        { href: "/matters", label: "Matters", icon: "matters", group: "Workspace" },
        { href: "/clients", label: "Clients", icon: "clients", group: "Workspace" },
        ...STAFF_WORKSPACE,
        { href: "/time", label: "Time and Billing", icon: "time", group: "Practice" },
        { href: "/expenses", label: "Expenses", icon: "expenses", group: "Practice" },
        { href: "/messages", label: "Messages", icon: "messages", group: "Practice" },
        { href: "/research", label: "Legal Research", icon: "research", group: "Practice" },
        { href: "/reports", label: "Reports", icon: "reports", group: "Practice" },
        ...STAFF_FIRM,
      ];
    case "paralegal":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Workspace" },
        { href: "/matters", label: "My Matters", icon: "matters", group: "Workspace" },
        ...STAFF_WORKSPACE,
        { href: "/time", label: "My Time", icon: "time", group: "Practice" },
        { href: "/time/new", label: "Enter Time", icon: "time", group: "Practice" },
        { href: "/expenses", label: "My Expenses", icon: "expenses", group: "Practice" },
        { href: "/expenses/new", label: "Enter Expense", icon: "expenses", group: "Practice" },
        { href: "/messages", label: "Messages", icon: "messages", group: "Practice" },
        { href: "/research", label: "Legal Research", icon: "research", group: "Practice" },
        ...STAFF_FIRM,
      ];
    case "billing_staff":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Workspace" },
        { href: "/matters", label: "Matters", icon: "matters", group: "Workspace" },
        { href: "/clients", label: "Clients", icon: "clients", group: "Workspace" },
        { href: "/calendar", label: "Calendar", icon: "calendar", group: "Workspace" },
        { href: "/documents", label: "Documents", icon: "documents", group: "Workspace" },
        { href: "/billing-readiness", label: "Billing Readiness", icon: "billing", group: "Billing" },
        { href: "/unbilled", label: "Unbilled Activity", icon: "unbilled", group: "Billing" },
        { href: "/expenses/review", label: "Expense Review", icon: "review", group: "Billing" },
        { href: "/invoices", label: "Invoices", icon: "invoices", group: "Billing" },
        { href: "/invoices/new", label: "Prepare Invoice", icon: "invoices", group: "Billing" },
        { href: "/payments", label: "Payments", icon: "payments", group: "Billing" },
        { href: "/ar", label: "Accounts Receivable", icon: "receivables", group: "Billing" },
        { href: "/retainers", label: "Retainers", icon: "retainers", group: "Billing" },
        { href: "/trust-ledger", label: "Trust Ledger", icon: "trust", group: "Billing" },
        { href: "/journal", label: "Journal Entries", icon: "journal", group: "Billing" },
        { href: "/profitability/matters", label: "Matter Profitability", icon: "profitability", group: "Analytics" },
        { href: "/profitability/clients", label: "Client Profitability", icon: "profitability", group: "Analytics" },
        { href: "/profitability/practice-areas", label: "Practice Areas", icon: "profitability", group: "Analytics" },
        { href: "/productivity", label: "Productivity", icon: "productivity", group: "Analytics" },
        { href: "/reports", label: "Reports", icon: "reports", group: "Analytics" },
        { href: "/data-quality", label: "Data Quality", icon: "quality", group: "Analytics" },
        { href: "/controls", label: "Control Monitor", icon: "controls", group: "Analytics" },
        ...STAFF_FIRM,
      ];
    case "client":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/matters", label: "My Matters", icon: "matters" },
        { href: "/portal", label: "Milestones", icon: "tasks" },
        { href: "/portal/billing", label: "My Invoices & Payments", icon: "invoices" },
        { href: "/settings", label: "Settings", icon: "settings" },
      ];
    default:
      return [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }];
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
