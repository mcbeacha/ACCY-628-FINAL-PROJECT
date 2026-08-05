import type { UserRole } from "./types";

export const APP_NAME = "Rebel Law Group";
export const APP_SUBTITLE = "Legal Engagement and Matter Management";
export const ACADEMIC_NOTICE =
  "This application uses fictional data and was created for an academic project.";

export const ROLE_LABELS: Record<UserRole, string> = {
  managing_partner: "Managing Partner",
  attorney: "Attorney",
  paralegal: "Paralegal / Legal Staff",
  billing_staff: "Billing / Accounting Staff",
  client: "Client",
};

export const CLIENT_TYPES = [
  "Individual",
  "Business",
  "Nonprofit",
  "Government",
  "Other",
] as const;

export const CLIENT_STATUSES = [
  "Prospective",
  "Active",
  "Inactive",
  "Closed",
] as const;

export const PRACTICE_AREAS = [
  "Personal Injury",
  "Business Law",
  "Contract Law",
  "Employment Law",
  "Family Law",
  "Estate Planning",
  "Probate",
  "Real Estate",
  "Criminal Defense",
  "Civil Litigation",
  "Other",
] as const;

export const MATTER_STATUSES = [
  "Draft",
  "Pending Approval",
  "Active",
  "On Hold",
  "Closing",
  "Closed",
  "Canceled",
] as const;

export const BILLING_METHODS = [
  "Hourly",
  "Fixed Fee",
  "Retainer-Funded Hourly",
  "Contingency",
  "Hybrid",
  "Pro Bono",
] as const;

export const BILLING_FREQUENCIES = [
  "Monthly",
  "Biweekly",
  "At Milestone",
  "At Matter Completion",
  "As Incurred",
  "Not Yet Determined",
] as const;

export const APPROVAL_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "Needs Review",
  "Returned for Correction",
] as const;

export const ASSIGNMENT_ROLES = [
  "Lead Attorney",
  "Supporting Attorney",
  "Paralegal",
  "Legal Assistant",
  "Billing Contact",
  "Reviewer",
] as const;

export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Waiting",
  "Completed",
  "Canceled",
] as const;

export const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export const TIME_BILLABLE_STATUSES = ["Billable", "Nonbillable", "No Charge"] as const;
export const ENTRY_APPROVAL_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;
export const TIME_INVOICE_STATUSES = ["Unbilled", "Selected for Billing", "Billed"] as const;

export const EXPENSE_TYPES = [
  "Filing Fee",
  "Court Cost",
  "Expert Witness",
  "Medical Records",
  "Travel",
  "Mileage",
  "Parking",
  "Lodging",
  "Meals",
  "Copying",
  "Postage",
  "Research",
  "Outside Counsel",
  "Deposition",
  "Other",
] as const;

export const RETAINER_TXN_TYPES = [
  "Deposit",
  "Applied to Fees",
  "Applied to Expenses",
  "Refund",
  "Adjustment Increase",
  "Adjustment Decrease",
] as const;

export const EXPENSE_RECEIPT_THRESHOLD = 75;
export const EXPENSE_HIGH_VALUE_THRESHOLD = 1000;

export const THEMES = [
  "corporate",
  "business",
  "luxury",
  "night",
  "winter",
  "emerald",
  "nord",
  "dim",
] as const;

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "Active":
    case "Approved":
    case "Completed":
    case "Ready":
      return "badge-success";
    case "Pending Approval":
    case "On Hold":
    case "Needs Review":
    case "Waiting":
    case "Missing Information":
    case "Prospective":
      return "badge-warning";
    case "Canceled":
    case "Rejected":
    case "Returned for Correction":
      return "badge-error";
    case "Draft":
    case "Closed":
    case "Inactive":
    case "Not Started":
    default:
      return "badge-ghost";
  }
}

export function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "Urgent":
    case "Critical":
      return "badge-error";
    case "High":
      return "badge-warning";
    case "Low":
      return "badge-ghost";
    default:
      return "badge-info";
  }
}
