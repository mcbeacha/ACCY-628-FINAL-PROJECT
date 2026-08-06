/** Engagement approval gates for creating and finalizing invoices. */

export const ENGAGEMENT_BILLING_BLOCKED_MESSAGE =
  "Billing is blocked until the engagement is approved.";

const BILLABLE_MATTER_STATUSES = new Set(["Active", "Approved", "Closed"]);

export type MatterEngagementFields = {
  approval_status?: string | null;
  matter_status?: string | null;
};

/** True when the matter engagement may be used for Prepare Invoice / Finalize. */
export function isMatterEngagementBillable(matter: MatterEngagementFields | null | undefined) {
  if (!matter) return false;
  if (matter.approval_status !== "Approved") return false;
  const status = matter.matter_status || "";
  if (!BILLABLE_MATTER_STATUSES.has(status)) return false;
  if (status === "Canceled") return false;
  return true;
}
