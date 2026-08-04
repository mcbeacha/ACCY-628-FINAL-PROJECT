import type { Client, Matter } from "./types";

export type ReadinessStatus = "Ready" | "Missing Information" | "Needs Review";

export type BillingReadinessRow = {
  matter: Matter;
  client: Client | null;
  missing: string[];
  status: ReadinessStatus;
};

export function evaluateBillingReadiness(
  matter: Matter,
  client: Client | null
): BillingReadinessRow {
  const missing: string[] = [];

  if (!client) missing.push("Client record");
  if (!client?.billing_email && !client?.email) {
    missing.push("Billing contact email");
  }
  if (!matter.billing_method) missing.push("Billing method");
  if (!matter.responsible_attorney_id) missing.push("Responsible attorney");
  if (matter.approval_status !== "Approved") missing.push("Approved engagement");
  if (matter.payment_terms_days === null || matter.payment_terms_days === undefined) {
    missing.push("Payment terms");
  }

  switch (matter.billing_method) {
    case "Hourly":
      if (matter.hourly_rate === null || matter.hourly_rate === undefined) {
        missing.push("Hourly rate");
      }
      break;
    case "Fixed Fee":
      if (matter.fixed_fee_amount === null || matter.fixed_fee_amount === undefined) {
        missing.push("Fixed fee amount");
      }
      break;
    case "Retainer-Funded Hourly":
      if (matter.hourly_rate === null || matter.hourly_rate === undefined) {
        missing.push("Hourly rate");
      }
      if (
        matter.initial_retainer_amount === null ||
        matter.initial_retainer_amount === undefined
      ) {
        missing.push("Initial retainer amount");
      }
      break;
    case "Contingency":
      if (
        matter.contingency_percentage === null ||
        matter.contingency_percentage === undefined
      ) {
        missing.push("Contingency percentage");
      }
      break;
    case "Hybrid":
      if (
        (matter.hourly_rate === null || matter.hourly_rate === undefined) &&
        (matter.fixed_fee_amount === null || matter.fixed_fee_amount === undefined)
      ) {
        missing.push("Hybrid rate or fee terms");
      }
      break;
    case "Pro Bono":
      break;
    default:
      break;
  }

  if (
    matter.billing_method &&
    ["Hourly", "Retainer-Funded Hourly", "Hybrid"].includes(matter.billing_method) &&
    (matter.matter_budget === null || matter.matter_budget === undefined)
  ) {
    missing.push("Matter budget (recommended)");
  }

  let status: ReadinessStatus = "Ready";
  if (matter.approval_status === "Needs Review") {
    status = "Needs Review";
  } else if (missing.length > 0) {
    status = "Missing Information";
  }

  return { matter, client, missing, status };
}
