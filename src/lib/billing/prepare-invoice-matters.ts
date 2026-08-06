/**
 * Billing-local helpers for Prepare Invoice matter dropdown only.
 * Pure functions — no database writes.
 */

export const PREPARE_INVOICE_MATTER_STATUSES = [
  "Active",
  "On Hold",
  "Closing",
  "Closed",
] as const;

/** Bogus value previously used as matter_status; it is an engagement approval_status. */
export const INVALID_MATTER_STATUS_APPROVED = "Approved";

export type PrepareInvoiceClientLabelInput = {
  client_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  primary_contact_name?: string | null;
};

export type OrdinaryMethodInput = {
  billing_method: string | null | undefined;
  fixed_fee_amount?: number | null;
  hourly_rate?: number | null;
};

export function prepareInvoiceClientLabel(
  client: PrepareInvoiceClientLabelInput | null | undefined
): string {
  if (!client) return "Unknown client";

  const personName = [client.first_name, client.last_name].filter(Boolean).join(" ");
  const orgName = (client.organization_name || "").trim();
  const contact = (client.primary_contact_name || "").trim();
  const isIndividual = client.client_type === "Individual";

  if (isIndividual) {
    return personName || "Unnamed client";
  }

  if (orgName) return orgName;
  if (personName) return personName;
  if (contact) return contact;

  if (!client.client_type && personName) return personName;

  return orgName || contact || personName || "Unknown client";
}

export function isMatterStatusEligibleForPrepareInvoice(
  matterStatus: string | null | undefined
): boolean {
  if (!matterStatus) return false;
  return (PREPARE_INVOICE_MATTER_STATUSES as readonly string[]).includes(matterStatus);
}

/**
 * Ordinary invoice methods for the Prepare Invoice dropdown.
 * Contingency and Pro Bono are excluded.
 */
export function isOrdinaryInvoiceMethod(input: OrdinaryMethodInput): boolean {
  const method = (input.billing_method || "").trim();
  if (!method) return false;

  if (method === "Contingency" || method === "Pro Bono") return false;

  if (method === "Hourly" || method === "Retainer-Funded Hourly") return true;

  if (method === "Fixed Fee") {
    return Number(input.fixed_fee_amount) > 0;
  }

  if (method === "Hybrid") {
    const hasHourly =
      input.hourly_rate !== null &&
      input.hourly_rate !== undefined &&
      Number(input.hourly_rate) > 0;
    const hasFixed = Number(input.fixed_fee_amount) > 0;
    return hasHourly || hasFixed;
  }

  return false;
}

export function formatPrepareInvoiceMatterOption(input: {
  matter_number: string;
  matter_name: string;
  client?: PrepareInvoiceClientLabelInput | null;
}): string {
  const clientLabel = prepareInvoiceClientLabel(input.client);
  return `${input.matter_number} — ${clientLabel} — ${input.matter_name}`;
}

export type CreateDraftGateInput = {
  matterSelected: boolean;
  billingMethod: string | null | undefined;
  fixedFeeAmountOnMatter?: number | null;
  hourlyRateOnMatter?: number | null;
  invoiceDate: string;
  dueDate: string;
  invoiceTotal: number;
  hasSelectedTimeOrExpense: boolean;
  fixedFeeLineAmount: number;
};

export function canEnableCreateDraftInvoice(input: CreateDraftGateInput): boolean {
  if (!input.matterSelected) return false;
  if (
    !isOrdinaryInvoiceMethod({
      billing_method: input.billingMethod,
      fixed_fee_amount: input.fixedFeeAmountOnMatter,
      hourly_rate: input.hourlyRateOnMatter,
    })
  ) {
    return false;
  }
  if (!input.invoiceDate || !input.dueDate) return false;
  if (input.dueDate < input.invoiceDate) return false;
  if (input.invoiceTotal <= 0) return false;
  const hasLine =
    input.hasSelectedTimeOrExpense || Number(input.fixedFeeLineAmount) > 0;
  if (!hasLine) return false;
  return true;
}

export function hasEligibleInvoiceActivity(input: {
  timeCount: number;
  expenseCount: number;
  fixedFeeLineAmount: number;
}): boolean {
  return (
    input.timeCount > 0 ||
    input.expenseCount > 0 ||
    Number(input.fixedFeeLineAmount) > 0
  );
}
