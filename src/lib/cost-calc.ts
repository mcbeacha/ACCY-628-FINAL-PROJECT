/**
 * Cost & resource calculations (fictional academic data).
 * Labor cost uses preserved internal_cost_rate on time entries — never current profile rates.
 */

export type BudgetFlag = "On Track" | "Near Budget" | "Over Budget" | "Budget Not Set";

export function budgetUsedPercentage(totalCost: number, budget: number | null | undefined): number | null {
  if (budget == null || budget <= 0) return null;
  return (totalCost / budget) * 100;
}

export function budgetFlag(totalCost: number, budget: number | null | undefined): BudgetFlag {
  if (budget == null || budget <= 0) return "Budget Not Set";
  const pct = (totalCost / budget) * 100;
  if (pct >= 100) return "Over Budget";
  if (pct >= 80) return "Near Budget";
  return "On Track";
}

export function budgetRemaining(totalCost: number, budget: number | null | undefined): number | null {
  if (budget == null || budget <= 0) return null;
  return budget - totalCost;
}

export function budgetBadgeClass(flag: BudgetFlag): string {
  switch (flag) {
    case "Over Budget":
      return "badge-error";
    case "Near Budget":
      return "badge-warning";
    case "On Track":
      return "badge-success";
    default:
      return "badge-ghost";
  }
}

export type MatterCostSummary = {
  laborCost: number;
  vendorCost: number;
  directExpenses: number;
  reimbursableExpenses: number;
  nonreimbursableExpenses: number;
  allocatedCost: number;
  totalMatterCost: number;
  billableValue: number;
  expectedClientCharge: number;
};

export type UnifiedCostLike = {
  cost_source: string;
  category_group?: string | null;
  total_cost: number | string;
  expected_client_charge?: number | string | null;
  client_reimbursable?: boolean | null;
  approval_status: string;
  billing_status?: string | null;
};

function n(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(x) ? x : 0;
}

/** Summarize approved costs from the unified cost stream. */
export function summarizeMatterCosts(rows: UnifiedCostLike[]): MatterCostSummary {
  const approved = rows.filter((r) => r.approval_status === "Approved");

  let laborCost = 0;
  let vendorCost = 0;
  let directExpenses = 0;
  let reimbursableExpenses = 0;
  let nonreimbursableExpenses = 0;
  let allocatedCost = 0;
  let billableValue = 0;
  let expectedClientCharge = 0;

  for (const r of approved) {
    const cost = n(r.total_cost);
    const charge = n(r.expected_client_charge);
    expectedClientCharge += charge;

    if (r.cost_source === "Time Entry" || r.cost_source === "Employee Labor") {
      laborCost += cost;
      billableValue += charge;
      continue;
    }
    if (r.cost_source === "Allocation" || r.category_group === "Allocated Costs") {
      allocatedCost += cost;
      continue;
    }
    if (
      r.cost_source === "Vendor Invoice" ||
      r.cost_source === "Contractor Charge"
    ) {
      vendorCost += cost;
      if (r.client_reimbursable) reimbursableExpenses += cost;
      else nonreimbursableExpenses += cost;
      continue;
    }
    // Expense / Travel / Manual
    directExpenses += cost;
    if (r.client_reimbursable) reimbursableExpenses += cost;
    else nonreimbursableExpenses += cost;
  }

  return {
    laborCost,
    vendorCost,
    directExpenses,
    reimbursableExpenses,
    nonreimbursableExpenses,
    allocatedCost,
    totalMatterCost: laborCost + vendorCost + directExpenses + allocatedCost,
    billableValue,
    expectedClientCharge,
  };
}

export function estimatedProfitLabel(hasFinalizedRevenue: boolean): string {
  return hasFinalizedRevenue
    ? "Estimated Matter Profit"
    : "Estimated Profit Based on Current Billings";
}

export function estimatedMargin(
  revenue: number,
  totalCost: number
): number | null {
  if (revenue <= 0) return null;
  return ((revenue - totalCost) / revenue) * 100;
}

export function looksLikeDuplicate(
  a: {
    matter_id: string;
    vendor_id?: string | null;
    employee_id?: string | null;
    cost_date: string;
    total_cost: number;
    description: string;
    receipt_reference?: string | null;
  },
  b: {
    matter_id: string;
    vendor_id?: string | null;
    employee_id?: string | null;
    cost_date: string;
    total_cost: number;
    description: string;
    receipt_reference?: string | null;
  }
): boolean {
  if (a.matter_id !== b.matter_id) return false;
  if (Math.abs(a.total_cost - b.total_cost) > 0.009) return false;
  if (a.cost_date !== b.cost_date) return false;
  const sameParty =
    (a.vendor_id && a.vendor_id === b.vendor_id) ||
    (a.employee_id && a.employee_id === b.employee_id);
  if (!sameParty) return false;
  if (
    a.receipt_reference &&
    b.receipt_reference &&
    a.receipt_reference.trim().toLowerCase() ===
      b.receipt_reference.trim().toLowerCase()
  ) {
    return true;
  }
  const da = a.description.trim().toLowerCase();
  const db = b.description.trim().toLowerCase();
  return da.length > 0 && (da === db || da.includes(db) || db.includes(da));
}
