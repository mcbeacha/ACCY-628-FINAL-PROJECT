export type EmployeeRate = {
  id: string;
  user_id: string;
  billing_rate: number;
  internal_cost_rate: number;
  effective_start_date: string;
  effective_end_date: string | null;
  active_status: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  matter_id: string;
  employee_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  billing_rate: number;
  internal_cost_rate: number;
  billable_status: string;
  billing_description: string | null;
  internal_notes: string | null;
  approval_status: string;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  invoice_status: string;
  invoice_id: string | null;
  locked_status: boolean;
  created_by: string | null;
  created_at: string;
  // joined
  matters?: { id: string; matter_number: string; matter_name: string; clients?: { organization_name?: string | null; first_name?: string | null; last_name?: string | null } | null } | null;
  employee?: { id: string; full_name: string } | null;
};

export type ExpenseEntry = {
  id: string;
  matter_id: string;
  expense_date: string;
  expense_type: string;
  vendor_name: string | null;
  amount: number;
  client_reimbursable: boolean;
  description: string;
  receipt_reference: string | null;
  approval_status: string;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  invoice_status: string;
  invoice_id: string | null;
  locked_status: boolean;
  needs_extra_review: boolean;
  created_by: string | null;
  created_at: string;
  matters?: { id: string; matter_number: string; matter_name: string; clients?: unknown } | null;
  creator?: { full_name: string } | null;
};

export type RetainerAccount = {
  id: string;
  matter_id: string;
  initial_required_amount: number;
  replenishment_threshold: number;
  current_balance: number;
  account_status: string;
  created_by: string | null;
  created_at: string;
  matters?: {
    id: string;
    matter_number: string;
    matter_name: string;
    clients?: { organization_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
  } | null;
};

export type RetainerTransaction = {
  id: string;
  retainer_account_id: string;
  matter_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  reference_number: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  related_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  matters?: { matter_number: string; matter_name: string; clients?: unknown } | null;
};

export function calcBillableAmount(hours: number, rate: number, billableStatus: string) {
  if (billableStatus !== "Billable") return 0;
  return Math.round(hours * rate * 100) / 100;
}

export function calcLaborCost(hours: number, costRate: number) {
  return Math.round(hours * costRate * 100) / 100;
}

export function hoursFromTimes(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return null;
  return Math.round((mins / 60) * 100) / 100;
}
