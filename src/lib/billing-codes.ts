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

export function buildBillingCode(matterNumber: string, activityCode: string): string {
  return `${matterNumber}-${activityCode}`;
}

export function getBillingActivity(code: string | null | undefined): BillingActivity | undefined {
  if (!code) return undefined;
  return BILLING_ACTIVITIES.find((a) => a.code === code);
}
