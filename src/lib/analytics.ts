/**
 * Phase 2C profitability & operational analytics.
 * Formulas are documented for academic transparency (fictional data only).
 */

export const FORMULAS = {
  matterRevenue:
    "ASC 606 Step 5 proxy: Sum of finalized invoice totals (invoice_total) for the matter, excluding Draft and Canceled invoices. Revenue is recognized when (or as) performance obligations are satisfied—not when retainers are received. Pre-billing write-downs are already reflected in invoice lines. Payments and unapplied retainers are not revenue.",
  collectedRevenue:
    "Cash / applied consideration: Sum of payments_applied + retainer_applied on finalized invoices (capped by invoice total). Retainer application settles contract liability against earned revenue; it is not double-counted as new invoiced revenue.",
  directLaborCost:
    "Sum of (approved hours × preserved internal_cost_rate) on approved time entries. Client billing rate is not used.",
  directMatterExpense:
    "Sum of approved expense amounts on the matter (firm cost). Reimbursable lines that appear on invoices also appear in matter revenue so the net is transparent.",
  grossProfit: "Matter Revenue − Direct Labor Cost − Direct Matter Expense",
  grossMargin:
    "Gross Profit ÷ Matter Revenue × 100. When Matter Revenue is zero: Not Available.",
  cashProfit:
    "Collected Revenue − Direct Labor Cost − Direct Matter Expense (cash contribution, not accrual gross profit).",
  utilization:
    "Billable Hours ÷ (Available Weekly Hours × Weeks in period) × 100. Available hours default to 40/week (from employee profile). Unfiltered views use a 4-week window.",
  billingRealization:
    "Invoiced legal fees (Time + Fixed Fee lines on finalized invoices, net write-downs) ÷ Standard Billable Value × 100. Standard Billable Value = approved billable hours × preserved billing_rate. Excludes reimbursable expenses.",
  collectionRealization: "Collected fees allocated to invoices ÷ Invoiced fees × 100",
  collectionRate:
    "Collected Amount (payments applied + retainer applied) ÷ Finalized Invoice Amount × 100. Default basis: invoice_date range filter.",
  avgDaysToPay:
    "For fully Paid invoices: average of (last payment date − invoice date). Partially paid invoices use the latest posted payment date when included.",
  budgetConsumed: "Direct labor cost + direct matter expenses + approved vendor costs + allocated costs",
  budgetRemaining: "Matter budget − budget consumed",
  budgetVariance: "Matter budget − actual cost (positive = under budget)",
} as const;

export type ProfitStatus =
  | "Strong"
  | "Acceptable"
  | "Low Margin"
  | "Loss"
  | "Insufficient Data";

/** Transparent margin thresholds (documented for the panel). */
export function profitabilityStatus(
  revenue: number,
  grossProfit: number,
  hasAnyActivity: boolean
): ProfitStatus {
  if (!hasAnyActivity || (revenue <= 0 && !hasAnyActivity)) return "Insufficient Data";
  if (revenue <= 0) {
    if (hasAnyActivity) return "Loss";
    return "Insufficient Data";
  }
  const margin = (grossProfit / revenue) * 100;
  if (margin < 0) return "Loss";
  if (margin < 20) return "Low Margin";
  if (margin < 40) return "Acceptable";
  return "Strong";
}

export function marginPct(profit: number, revenue: number): number | null {
  if (revenue <= 0) return null;
  return (profit / revenue) * 100;
}

export function formatMargin(margin: number | null): string {
  if (margin === null || Number.isNaN(margin)) return "Not Available";
  return `${margin.toFixed(1)}%`;
}

export function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function weeksInRange(from: string | null, to: string | null): number {
  // Unfiltered views use a ~month window so utilization stays interpretable for demo datasets
  // that span many months but concentrate productive hours.
  if (!from || !to) return 4;
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  const days = Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
  return Math.max(1, days / 7);
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function arBucket(dueDate: string, balanceDue: number, status: string): string {
  if (balanceDue <= 0 || ["Paid", "Canceled", "Written Off"].includes(status)) {
    return "Settled";
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

export type MatterMetrics = {
  matterId: string;
  matterNumber: string;
  matterName: string;
  clientId: string;
  clientName: string;
  practiceArea: string;
  responsibleId: string | null;
  responsibleName: string;
  billingMethod: string;
  matterStatus: string;
  budget: number | null;
  approvedHours: number;
  billableHours: number;
  billableValue: number;
  standardBillableValue: number;
  invoicedRevenue: number;
  invoicedFees: number;
  collectedRevenue: number;
  collectedFees: number;
  directLaborCost: number;
  directExpense: number;
  reimbursableExpense: number;
  nonreimbursableExpense: number;
  grossProfit: number;
  grossMargin: number | null;
  cashProfit: number;
  outstandingAR: number;
  writeDowns: number;
  writeOffs: number;
  retainerBalance: number;
  budgetConsumed: number;
  budgetRemaining: number | null;
  budgetVariance: number | null;
  budgetFlag: "OK" | "Near Budget" | "Over Budget" | "Missing Budget" | "No Budget";
  profitStatus: ProfitStatus;
  billingRealization: number | null;
  collectionRealization: number | null;
  collectionRate: number | null;
};

export type ClientMetrics = {
  clientId: string;
  clientName: string;
  activeMatters: number;
  matterCount: number;
  invoicedRevenue: number;
  collectedRevenue: number;
  outstandingAR: number;
  pastDueAR: number;
  directLaborCost: number;
  directExpense: number;
  grossProfit: number;
  grossMargin: number | null;
  writeDowns: number;
  writeOffs: number;
  retainerBalance: number;
  avgDaysToPay: number | null;
  profitStatus: ProfitStatus;
};

export type PracticeMetrics = {
  practiceArea: string;
  matterCount: number;
  totalHours: number;
  invoicedRevenue: number;
  collectedRevenue: number;
  laborCost: number;
  directExpense: number;
  grossProfit: number;
  grossMargin: number | null;
  avgMatterValue: number;
  avgDaysToPay: number | null;
  writeDownPct: number | null;
  writeOffPct: number | null;
};

export type AttorneyMetrics = {
  userId: string;
  fullName: string;
  role: string;
  availableWeeklyHours: number;
  totalHours: number;
  approvedHours: number;
  billableHours: number;
  nonbillableHours: number;
  hoursBilled: number;
  billableValue: number;
  invoicedValue: number;
  collectedValue: number;
  laborCost: number;
  assignedActiveMatters: number;
  openTasks: number;
  overdueTasks: number;
  utilization: number | null;
  billingRealization: number | null;
};
