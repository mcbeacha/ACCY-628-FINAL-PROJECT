import type { Client, Matter } from "@/lib/types";

/**
 * ASC 606 (Revenue from Contracts with Customers) — Rebel Law Group demo model.
 *
 * Educational implementation for ACCY 628. Maps law-firm engagements to the
 * FASB five-step model and drives billing readiness / engagement UI.
 */

export const ASC606_STEPS = [
  {
    step: 1,
    title: "Identify the contract with the customer",
    lawFirmMeaning:
      "Approved engagement letter / matter terms with a client who has agreed to the fee arrangement.",
  },
  {
    step: 2,
    title: "Identify the performance obligations",
    lawFirmMeaning:
      "Promise(s) to transfer legal services (usually one series of legal services over time; hybrid may split fee types).",
  },
  {
    step: 3,
    title: "Determine the transaction price",
    lawFirmMeaning:
      "Expected consideration: hourly rates, fixed fee, contingency % (variable), subject to maximum charge and write-downs.",
  },
  {
    step: 4,
    title: "Allocate the transaction price to performance obligations",
    lawFirmMeaning:
      "Allocate among distinct promises when hybrid; otherwise the single legal-services PO carries the full price.",
  },
  {
    step: 5,
    title: "Recognize revenue when (or as) performance obligations are satisfied",
    lawFirmMeaning:
      "Recognize as services are transferred — typically over time for legal services — measured when invoices are finalized. Retainers are contract liabilities until applied.",
  },
] as const;

export type Asc606Status = "Compliant" | "Needs Attention" | "Not Ready";

export type Asc606PerformanceObligation = {
  id: string;
  label: string;
  satisfaction: "Over time" | "Point in time";
  recognitionTrigger: string;
  allocationBasis: string;
};

export type Asc606Gap = {
  step: 1 | 2 | 3 | 4 | 5;
  code: string;
  message: string;
  severity: "high" | "medium" | "low";
};

export type Asc606Assessment = {
  status: Asc606Status;
  score: number;
  gaps: Asc606Gap[];
  performanceObligations: Asc606PerformanceObligation[];
  recognitionPattern: string;
  variableConsideration: string;
  contractLiabilityNote: string;
  transactionPriceSummary: string;
};

function hasAmount(v: number | null | undefined): boolean {
  return v != null && Number(v) > 0;
}

function hasText(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim());
}

/** Build performance obligations implied by the engagement billing method. */
export function identifyPerformanceObligations(
  matter: Pick<Matter, "billing_method" | "fixed_fee_amount" | "hourly_rate" | "contingency_percentage">
): Asc606PerformanceObligation[] {
  const method = matter.billing_method || "";
  const pos: Asc606PerformanceObligation[] = [];

  if (method === "Fixed Fee") {
    pos.push({
      id: "po-fixed-legal-services",
      label: "Legal services (fixed fee)",
      satisfaction: "Over time",
      recognitionTrigger:
        "Recognize as work progresses; demo proxy = finalize invoice for completed period/milestone.",
      allocationBasis: "Standalone fixed fee amount",
    });
    return pos;
  }

  if (method === "Contingency") {
    pos.push({
      id: "po-contingency-legal-services",
      label: "Legal services (contingency)",
      satisfaction: "Over time",
      recognitionTrigger:
        "Variable consideration constrained until recovery is highly probable; recognize when contingency fee is billable/finalized.",
      allocationBasis: "Contingency % × expected recovery (constrained)",
    });
    return pos;
  }

  if (method === "Pro Bono") {
    pos.push({
      id: "po-pro-bono",
      label: "Pro bono legal services",
      satisfaction: "Over time",
      recognitionTrigger: "No client transaction price; no client revenue under ASC 606.",
      allocationBasis: "N/A — $0 transaction price",
    });
    return pos;
  }

  if (method === "Hybrid") {
    if (hasAmount(matter.hourly_rate)) {
      pos.push({
        id: "po-hybrid-hourly",
        label: "Legal services (hourly component)",
        satisfaction: "Over time",
        recognitionTrigger: "As approved time is invoiced and finalized.",
        allocationBasis: "Hours × rates (stand-alone selling price proxy)",
      });
    }
    if (hasAmount(matter.fixed_fee_amount)) {
      pos.push({
        id: "po-hybrid-fixed",
        label: "Legal services (fixed-fee component)",
        satisfaction: "Over time",
        recognitionTrigger: "As fixed-fee milestones/periods are invoiced and finalized.",
        allocationBasis: "Fixed fee stand-alone amount",
      });
    }
    if (pos.length === 0) {
      pos.push({
        id: "po-hybrid-unspecified",
        label: "Hybrid legal services (terms incomplete)",
        satisfaction: "Over time",
        recognitionTrigger: "Cannot allocate until hourly and/or fixed components are set.",
        allocationBasis: "Missing",
      });
    }
    return pos;
  }

  // Hourly / Retainer-Funded Hourly / default
  pos.push({
    id: "po-hourly-legal-services",
    label:
      method === "Retainer-Funded Hourly"
        ? "Legal services (retainer-funded hourly)"
        : "Legal services (hourly)",
    satisfaction: "Over time",
    recognitionTrigger:
      "As services are transferred (approved billable time) and consideration is invoiced/finalized. Retainer draws reduce contract liability; they are not revenue by themselves.",
    allocationBasis: "100% to the single legal-services performance obligation",
  });
  return pos;
}

export function evaluateAsc606(
  matter: Matter,
  client: Client | null = null
): Asc606Assessment {
  const gaps: Asc606Gap[] = [];
  const method = matter.billing_method || "";

  // Step 1 — Identify the contract
  if (!client) {
    gaps.push({
      step: 1,
      code: "no_client",
      message: "No client linked — cannot identify a customer contract.",
      severity: "high",
    });
  }
  if (matter.approval_status !== "Approved") {
    gaps.push({
      step: 1,
      code: "not_approved",
      message: "Engagement not approved — ASC 606 requires an enforceable contract.",
      severity: "high",
    });
  }
  if (!method) {
    gaps.push({
      step: 1,
      code: "no_method",
      message: "Billing method missing — contract consideration structure unknown.",
      severity: "high",
    });
  }
  if (!hasText(matter.scope_summary)) {
    gaps.push({
      step: 1,
      code: "no_scope",
      message: "Scope summary missing — weak evidence of agreed rights and obligations.",
      severity: "medium",
    });
  }

  // Step 2 — Performance obligations
  const performanceObligations = identifyPerformanceObligations(matter);
  if (!hasText(matter.scope_summary) && method !== "Pro Bono") {
    gaps.push({
      step: 2,
      code: "po_unclear",
      message: "Without scope, performance obligations are incompletely identified.",
      severity: "medium",
    });
  }

  // Step 3 — Transaction price
  switch (method) {
    case "Hourly":
    case "Retainer-Funded Hourly":
      if (!hasAmount(matter.hourly_rate)) {
        gaps.push({
          step: 3,
          code: "no_hourly",
          message: "Hourly charge missing — transaction price cannot be determined.",
          severity: "high",
        });
      }
      if (!hasAmount(matter.court_hourly_rate) && hasAmount(matter.hourly_rate)) {
        gaps.push({
          step: 3,
          code: "no_court_rate",
          message:
            "Court hourly charge not stored (system may default to 1.5×). Record it for a complete price.",
          severity: "low",
        });
      }
      if (!hasAmount(matter.maximum_fee_amount)) {
        gaps.push({
          step: 3,
          code: "no_max_fee",
          message: "Maximum charge not set — helpful constraint on variable consideration.",
          severity: "medium",
        });
      }
      break;
    case "Fixed Fee":
      if (!hasAmount(matter.fixed_fee_amount)) {
        gaps.push({
          step: 3,
          code: "no_fixed",
          message: "Fixed fee amount missing — transaction price unknown.",
          severity: "high",
        });
      }
      break;
    case "Contingency":
      if (!hasAmount(matter.contingency_percentage)) {
        gaps.push({
          step: 3,
          code: "no_contingency",
          message: "Contingency % missing — variable consideration not determinable.",
          severity: "high",
        });
      }
      if (!hasAmount(matter.estimated_matter_value)) {
        gaps.push({
          step: 3,
          code: "no_est_value",
          message:
            "Estimated matter value missing — needed to estimate (and constrain) variable consideration.",
          severity: "medium",
        });
      }
      break;
    case "Hybrid":
      if (!hasAmount(matter.hourly_rate) && !hasAmount(matter.fixed_fee_amount)) {
        gaps.push({
          step: 3,
          code: "hybrid_price",
          message: "Hybrid engagement needs hourly and/or fixed fee amounts.",
          severity: "high",
        });
      }
      break;
    case "Pro Bono":
      break;
    default:
      if (method) {
        gaps.push({
          step: 3,
          code: "unknown_method",
          message: `Unrecognized billing method “${method}”.`,
          severity: "medium",
        });
      }
  }

  if (method === "Retainer-Funded Hourly" && !hasAmount(matter.initial_retainer_amount)) {
    gaps.push({
      step: 3,
      code: "no_retainer",
      message: "Initial retainer missing for retainer-funded hourly engagement.",
      severity: "high",
    });
  }

  // Step 4 — Allocation
  if (method === "Hybrid") {
    const hasH = hasAmount(matter.hourly_rate);
    const hasF = hasAmount(matter.fixed_fee_amount);
    if (hasH !== hasF) {
      gaps.push({
        step: 4,
        code: "hybrid_alloc",
        message:
          "Hybrid allocation incomplete — set both hourly and fixed components (or change method).",
        severity: "medium",
      });
    }
  }

  // Step 5 — Recognition timing / contract liability clarity
  if (
    (method === "Retainer-Funded Hourly" || hasAmount(matter.initial_retainer_amount)) &&
    matter.payment_terms_days == null
  ) {
    gaps.push({
      step: 5,
      code: "payment_terms",
      message: "Payment terms missing — clarify when consideration becomes due after recognition.",
      severity: "low",
    });
  }

  const high = gaps.filter((g) => g.severity === "high").length;
  const medium = gaps.filter((g) => g.severity === "medium").length;
  const low = gaps.filter((g) => g.severity === "low").length;
  const score = Math.max(0, 100 - high * 25 - medium * 10 - low * 3);

  let status: Asc606Status = "Compliant";
  if (high > 0 || score < 70) status = "Not Ready";
  else if (medium > 0 || score < 90) status = "Needs Attention";

  let recognitionPattern =
    "Over time as legal services are transferred; demo measurement = finalized invoices for satisfied work.";
  let variableConsideration = "None beyond ordinary write-downs before finalization.";
  let transactionPriceSummary = method || "Billing method not set";

  switch (method) {
    case "Hourly":
    case "Retainer-Funded Hourly":
      transactionPriceSummary = hasAmount(matter.hourly_rate)
        ? `Hourly charge ${matter.hourly_rate}${
            hasAmount(matter.court_hourly_rate)
              ? `; court ${matter.court_hourly_rate}`
              : " (court defaults to 1.5× if blank)"
          }${hasAmount(matter.maximum_fee_amount) ? `; max ${matter.maximum_fee_amount}` : ""}`
        : "Hourly price incomplete";
      break;
    case "Fixed Fee":
      recognitionPattern =
        "Over time for the fixed-fee legal services PO; recognize when milestone/period invoices finalize.";
      transactionPriceSummary = hasAmount(matter.fixed_fee_amount)
        ? `Fixed fee ${matter.fixed_fee_amount}`
        : "Fixed fee incomplete";
      break;
    case "Contingency":
      recognitionPattern =
        "Variable consideration constrained until recovery is highly probable; recognize contingency fee when billable and invoice is finalized — not when the case opens.";
      variableConsideration =
        "Contingency fee is variable. Include in transaction price only to the extent it is highly probable a significant reversal will not occur.";
      transactionPriceSummary = hasAmount(matter.contingency_percentage)
        ? `${matter.contingency_percentage}% of recovery${
            hasAmount(matter.estimated_matter_value)
              ? ` (est. value ${matter.estimated_matter_value})`
              : ""
          }`
        : "Contingency % incomplete";
      break;
    case "Hybrid":
      recognitionPattern =
        "Allocate between hourly and fixed POs; recognize each as its services transfer (invoice finalize proxy).";
      transactionPriceSummary = "Hybrid — allocate between hourly and fixed components";
      break;
    case "Pro Bono":
      recognitionPattern = "No client revenue under ASC 606.";
      transactionPriceSummary = "$0 (pro bono)";
      variableConsideration = "N/A";
      break;
  }

  const contractLiabilityNote =
    method === "Retainer-Funded Hourly" || hasAmount(matter.initial_retainer_amount)
      ? "Client retainers are ASC 606 contract liabilities (and trust obligations): cash received is not revenue until services are transferred and amounts are applied to finalized invoices."
      : "No retainer on this engagement. Advances, if later collected, must be booked as contract liabilities until earned.";

  return {
    status,
    score,
    gaps,
    performanceObligations,
    recognitionPattern,
    variableConsideration,
    contractLiabilityNote,
    transactionPriceSummary,
  };
}
