import {
  COST_ELEVATED_MP_THRESHOLD,
  COST_ROUTINE_MP_THRESHOLD,
  EXPENSE_ELEVATED_MP_THRESHOLD,
  EXPENSE_HIGH_VALUE_THRESHOLD,
  INVOICE_BILLING_APPROVE_MAX,
} from "@/lib/constants";
import type { UserRole } from "@/lib/types";

/** Firm approval-matrix dollar thresholds (editable by Managing Partner). */
export type FirmApprovalThresholds = {
  routineExpenseCostMp: number;
  elevatedExpenseCostMp: number;
  routineInvoiceMp: number;
};

export const DEFAULT_FIRM_THRESHOLDS: FirmApprovalThresholds = {
  routineExpenseCostMp: EXPENSE_HIGH_VALUE_THRESHOLD,
  elevatedExpenseCostMp: EXPENSE_ELEVATED_MP_THRESHOLD,
  routineInvoiceMp: INVOICE_BILLING_APPROVE_MAX,
};

/** Alias defaults used by cost forms (same as routine expense/cost MP). */
export const defaultRoutineCostThreshold = () => DEFAULT_FIRM_THRESHOLDS.routineExpenseCostMp;

export function canEditApprovalThresholds(role: UserRole | string | null | undefined): boolean {
  return role === "managing_partner";
}

type ThresholdRow = {
  routine_expense_cost_mp?: number | string | null;
  elevated_expense_cost_mp?: number | string | null;
  routine_invoice_mp?: number | string | null;
};

export function mapFirmThresholdRow(row: ThresholdRow | null | undefined): FirmApprovalThresholds {
  if (!row) return { ...DEFAULT_FIRM_THRESHOLDS };
  const routine = Number(row.routine_expense_cost_mp);
  const elevated = Number(row.elevated_expense_cost_mp);
  const invoice = Number(row.routine_invoice_mp);
  return {
    routineExpenseCostMp:
      Number.isFinite(routine) && routine > 0
        ? routine
        : DEFAULT_FIRM_THRESHOLDS.routineExpenseCostMp,
    elevatedExpenseCostMp:
      Number.isFinite(elevated) && elevated > 0
        ? elevated
        : DEFAULT_FIRM_THRESHOLDS.elevatedExpenseCostMp,
    routineInvoiceMp:
      Number.isFinite(invoice) && invoice > 0
        ? invoice
        : DEFAULT_FIRM_THRESHOLDS.routineInvoiceMp,
  };
}

/** Compat: cost elevated/routine map to the shared expense/cost firm fields. */
export function thresholdsForApprovalMatrix(t: FirmApprovalThresholds) {
  return {
    expenseRoutineMp: t.routineExpenseCostMp,
    expenseElevatedMp: t.elevatedExpenseCostMp,
    costRoutineMp: t.routineExpenseCostMp,
    costElevatedMp: t.elevatedExpenseCostMp,
    invoiceRoutineMp: t.routineInvoiceMp,
    // Keep constant aliases available for callers that still expect them
    EXPENSE_HIGH_VALUE_THRESHOLD: t.routineExpenseCostMp,
    EXPENSE_ELEVATED_MP_THRESHOLD: t.elevatedExpenseCostMp,
    COST_ROUTINE_MP_THRESHOLD: t.routineExpenseCostMp,
    COST_ELEVATED_MP_THRESHOLD: t.elevatedExpenseCostMp,
    INVOICE_BILLING_APPROVE_MAX: t.routineInvoiceMp,
  };
}

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export async function getFirmThresholds(supabase: SupabaseLike): Promise<FirmApprovalThresholds> {
  try {
    const { data, error } = await supabase
      .from("firm_approval_thresholds")
      .select("routine_expense_cost_mp, elevated_expense_cost_mp, routine_invoice_mp")
      .limit(1)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_FIRM_THRESHOLDS };
    return mapFirmThresholdRow(data as ThresholdRow);
  } catch {
    return { ...DEFAULT_FIRM_THRESHOLDS };
  }
}

/** Re-export defaults that match historical constants for cost-types consumers. */
export {
  COST_ELEVATED_MP_THRESHOLD,
  COST_ROUTINE_MP_THRESHOLD,
  EXPENSE_ELEVATED_MP_THRESHOLD,
  EXPENSE_HIGH_VALUE_THRESHOLD,
  INVOICE_BILLING_APPROVE_MAX,
};
