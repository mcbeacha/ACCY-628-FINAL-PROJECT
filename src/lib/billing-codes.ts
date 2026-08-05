/** Firm-wide activity codes for time billing (XXXX in MT-#####-XXXX). */

export type BillingActivity = {
  code: string;
  label: string;
};

export const BILLING_ACTIVITIES: BillingActivity[] = [
  { code: "1001", label: "Legal Research" },
  { code: "1002", label: "Drafting / Document Preparation" },
  { code: "1003", label: "Client Communication" },
  { code: "1004", label: "Court / Hearing Appearance" },
  { code: "1005", label: "Discovery / Document Review" },
  { code: "1006", label: "Negotiation / Settlement" },
  { code: "1007", label: "Internal Strategy / Case Planning" },
  { code: "1008", label: "Travel (billable when applicable)" },
  { code: "1009", label: "Administrative Legal Support" },
  { code: "1010", label: "Other Billable Legal Work" },
];

const ACTIVITY_CODES = new Set(BILLING_ACTIVITIES.map((a) => a.code));

export function buildBillingCode(matterNumber: string, activityCode: string): string {
  return `${matterNumber}-${activityCode}`;
}

export function getBillingActivity(code: string | null | undefined): BillingActivity | undefined {
  if (!code) return undefined;
  return BILLING_ACTIVITIES.find((a) => a.code === code);
}

/** Last `-XXXX` segment when it matches a known activity code. */
export function parseActivityCode(billingCode: string | null | undefined): string | null {
  if (!billingCode) return null;
  const parts = billingCode.split("-");
  const last = parts[parts.length - 1];
  if (!last || !ACTIVITY_CODES.has(last)) return null;
  return last;
}

/**
 * Match Enter Time’s matter + activity model.
 * Prefer filtering by matter id in the page; use this for activity / billing-code checks.
 */
export function matchesMatterActivity(
  billingCode: string | null | undefined,
  matterNumber: string | null | undefined,
  activityCode: string | null | undefined
): boolean {
  if (activityCode) {
    const parsed = parseActivityCode(billingCode);
    if (parsed !== activityCode) return false;
  }
  if (matterNumber) {
    if (!billingCode) return false;
    return billingCode === matterNumber || billingCode.startsWith(`${matterNumber}-`);
  }
  return true;
}
