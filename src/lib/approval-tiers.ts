import {
  DEFAULT_FIRM_THRESHOLDS,
  type FirmApprovalThresholds,
} from "@/lib/firm-thresholds";
import type { UserRole } from "@/lib/types";

/** Minimal matter fields needed for the approval matrix. */
export type ApprovalMatterContext = {
  billing_method?: string | null;
  practice_area?: string | null;
  responsible_attorney_id?: string | null;
};

export type ApprovalKind =
  | "time"
  | "expense"
  | "cost"
  | "invoice"
  | "write_off"
  | "matter_engagement"
  | "vendor"
  | "allocation";

export type ApproverRole = "attorney" | "billing_staff" | "managing_partner";

export type ApprovalDecision = {
  requiredRole: ApproverRole;
  elevated: boolean;
  reason: string;
};

function isApproverRole(value: string | null | undefined): value is ApproverRole {
  return value === "attorney" || value === "billing_staff" || value === "managing_partner";
}

/** Contingency fee matters and Personal Injury practice are elevated-risk. */
export function isElevatedMatter(matter: ApprovalMatterContext | null | undefined): boolean {
  if (!matter) return false;
  return (
    matter.billing_method === "Contingency" || matter.practice_area === "Personal Injury"
  );
}

export function requiredApproverRole(input: {
  kind: ApprovalKind;
  matter?: ApprovalMatterContext | null;
  amount?: number | null;
  preparerId?: string | null;
  /** Live firm thresholds; defaults to compile-time constants. */
  thresholds?: FirmApprovalThresholds;
  /**
   * Role stamped at submit time. When present, pending items keep original routing
   * even if firm thresholds change later.
   */
  stampedRequiredRole?: string | null;
}): ApprovalDecision {
  const elevated = isElevatedMatter(input.matter);
  const amount = Number(input.amount || 0);
  const t = input.thresholds ?? DEFAULT_FIRM_THRESHOLDS;

  if (isApproverRole(input.stampedRequiredRole)) {
    const role = input.stampedRequiredRole;
    return {
      requiredRole: role,
      elevated,
      reason:
        role === "managing_partner"
          ? elevated
            ? "Requires Managing Partner (routed at submission; Contingency / PI)"
            : "Requires Managing Partner (routed at submission)"
          : role === "billing_staff"
            ? "Billing may approve (routed at submission)"
            : "Responsible attorney may approve (routed at submission)",
    };
  }

  switch (input.kind) {
    case "time":
      return {
        requiredRole: "attorney",
        elevated,
        reason: elevated
          ? "Responsible attorney reviews time on Contingency / Personal Injury matters"
          : "Responsible attorney reviews submitted time",
      };

    case "expense": {
      const threshold = elevated ? t.elevatedExpenseCostMp : t.routineExpenseCostMp;
      if (amount >= threshold) {
        return {
          requiredRole: "managing_partner",
          elevated,
          reason: elevated
            ? `Contingency / PI expense ≥ $${threshold.toLocaleString()} requires Managing Partner`
            : `Expense ≥ $${threshold.toLocaleString()} requires Managing Partner`,
        };
      }
      return {
        requiredRole: "billing_staff",
        elevated,
        reason: elevated
          ? `Billing may approve Contingency / PI expenses under $${threshold.toLocaleString()}`
          : `Billing may approve expenses under $${threshold.toLocaleString()}`,
      };
    }

    case "cost": {
      const threshold = elevated ? t.elevatedExpenseCostMp : t.routineExpenseCostMp;
      if (amount >= threshold) {
        return {
          requiredRole: "managing_partner",
          elevated,
          reason: elevated
            ? `Contingency / PI cost ≥ $${threshold.toLocaleString()} requires Managing Partner`
            : `Cost ≥ $${threshold.toLocaleString()} requires Managing Partner`,
        };
      }
      return {
        requiredRole: "billing_staff",
        elevated,
        reason: elevated
          ? `Billing may approve Contingency / PI costs under $${threshold.toLocaleString()}`
          : `Billing may approve costs under $${threshold.toLocaleString()}`,
      };
    }

    case "invoice": {
      if (elevated) {
        return {
          requiredRole: "managing_partner",
          elevated: true,
          reason: "Contingency / Personal Injury invoices always require Managing Partner",
        };
      }
      if (amount >= t.routineInvoiceMp) {
        return {
          requiredRole: "managing_partner",
          elevated: false,
          reason: `Invoice ≥ $${t.routineInvoiceMp.toLocaleString()} requires Managing Partner`,
        };
      }
      return {
        requiredRole: "billing_staff",
        elevated: false,
        reason: `Billing may approve routine invoices under $${t.routineInvoiceMp.toLocaleString()} (not self-prepared)`,
      };
    }

    case "write_off":
      return {
        requiredRole: "managing_partner",
        elevated,
        reason: "Write-offs always require Managing Partner approval",
      };

    case "matter_engagement":
      if (elevated) {
        return {
          requiredRole: "managing_partner",
          elevated: true,
          reason: "Contingency / Personal Injury engagements require Managing Partner",
        };
      }
      return {
        requiredRole: "attorney",
        elevated: false,
        reason: "Responsible attorney may approve routine engagement terms",
      };

    case "vendor":
    case "allocation":
      return {
        requiredRole: "managing_partner",
        elevated,
        reason:
          input.kind === "vendor"
            ? "Vendor approval requires Managing Partner"
            : "Cost allocations require Managing Partner",
      };

    default:
      return {
        requiredRole: "managing_partner",
        elevated,
        reason: "Managing Partner approval required",
      };
  }
}

/**
 * Whether the current viewer may approve this artifact under the matrix.
 * Managing Partner can always approve (escalation authority).
 */
export function viewerCanApprove(input: {
  kind: ApprovalKind;
  viewerRole: UserRole;
  viewerId: string;
  matter?: ApprovalMatterContext | null;
  amount?: number | null;
  preparerId?: string | null;
  thresholds?: FirmApprovalThresholds;
  stampedRequiredRole?: string | null;
}): { allowed: boolean; decision: ApprovalDecision; blockedReason?: string } {
  const decision = requiredApproverRole({
    kind: input.kind,
    matter: input.matter,
    amount: input.amount,
    preparerId: input.preparerId,
    thresholds: input.thresholds,
    stampedRequiredRole: input.stampedRequiredRole,
  });

  if (input.viewerRole === "managing_partner") {
    return { allowed: true, decision };
  }

  // Self-prepared routine invoices escalate to MP even under the dollar threshold.
  if (
    input.kind === "invoice" &&
    decision.requiredRole === "billing_staff" &&
    input.preparerId &&
    input.preparerId === input.viewerId
  ) {
    return {
      allowed: false,
      decision: {
        requiredRole: "managing_partner",
        elevated: decision.elevated,
        reason: "Self-prepared invoices require Managing Partner (segregation of duties)",
      },
      blockedReason: "Self-prepared invoices require Managing Partner (segregation of duties)",
    };
  }

  // Costs: no self-approval
  if (
    (input.kind === "cost" || input.kind === "expense") &&
    input.preparerId &&
    input.preparerId === input.viewerId
  ) {
    return {
      allowed: false,
      decision,
      blockedReason: "You cannot approve an entry you submitted",
    };
  }

  if (decision.requiredRole === "managing_partner") {
    return {
      allowed: false,
      decision,
      blockedReason: decision.reason,
    };
  }

  if (decision.requiredRole === "billing_staff") {
    if (input.viewerRole === "billing_staff") {
      return { allowed: true, decision };
    }
    return {
      allowed: false,
      decision,
      blockedReason: decision.reason,
    };
  }

  // requiredRole === attorney (MP already returned above)
  if (input.viewerRole !== "attorney") {
    return {
      allowed: false,
      decision,
      blockedReason: decision.reason,
    };
  }

  const responsibleId = input.matter?.responsible_attorney_id;
  if (responsibleId && responsibleId !== input.viewerId) {
    return {
      allowed: false,
      decision,
      blockedReason: "Only the responsible attorney (or Managing Partner) may approve this item",
    };
  }
  // If responsible attorney is unset, allow any attorney for demo continuity on routine matters.
  return { allowed: true, decision };
}

export function approvalBadgeLabel(decision: ApprovalDecision): string {
  if (decision.requiredRole === "managing_partner") {
    return decision.elevated
      ? "Requires Managing Partner (Contingency / PI)"
      : "Requires Managing Partner";
  }
  if (decision.requiredRole === "billing_staff") {
    return "Billing may approve";
  }
  return "Responsible attorney may approve";
}
