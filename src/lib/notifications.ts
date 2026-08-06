/**
 * Per-person notification feed for the header bell.
 *
 * Each demo identity sees the alerts that belong to their own work. Message
 * alerts are not stored here — NotificationCenter derives those from the live
 * conversation store so the bell always agrees with the Messages inbox.
 * Replace these arrays with API data when a notifications service exists.
 */
import type { UserRole } from "@/lib/types";
import type { WorkspaceNotification } from "@/lib/workspace-mock";

export type PersonNotification = WorkspaceNotification & {
  /** Where clicking the notification takes the user. */
  href: string;
};

const PARTNER_NOTIFICATIONS: PersonNotification[] = [
  {
    id: "mp-1",
    kind: "document_review",
    title: "Approval waiting",
    detail: "Northvale response filing needs partner sign-off before 4:00 PM",
    minutesAgo: 20,
    unread: true,
    href: "/inbox",
  },
  {
    id: "mp-2",
    kind: "deadline",
    title: "Write-off packet due",
    detail: "Two August write-offs must be approved before billing closes",
    minutesAgo: 95,
    unread: true,
    href: "/billing-readiness",
  },
  {
    id: "mp-3",
    kind: "matter_assignment",
    title: "Case evaluation submitted",
    detail: "Priya Rose completed intake for CE-2026-4304",
    minutesAgo: 240,
    unread: true,
    href: "/case-evaluations",
  },
  {
    id: "mp-4",
    kind: "court_update",
    title: "Court update",
    detail: "Harbor Brook hearing moved to Courtroom 2 on Thursday",
    minutesAgo: 700,
    unread: false,
    href: "/calendar",
  },
  {
    id: "mp-5",
    kind: "announcement",
    title: "Firm announcement",
    detail: "Quarterly practice group meeting moved to Thursday",
    minutesAgo: 2_600,
    unread: false,
    href: "/dashboard",
  },
  {
    id: "mp-6",
    kind: "deadline",
    title: "Statute watch",
    detail: "Whitfield products claim — statute calendar within 12 days",
    minutesAgo: 80,
    unread: true,
    href: "/calendar",
  },
  {
    id: "mp-7",
    kind: "document_review",
    title: "Time review backlog",
    detail: "3 submitted time entries await partner authorization",
    minutesAgo: 130,
    unread: true,
    href: "/time/review",
  },
  {
    id: "mp-8",
    kind: "matter_assignment",
    title: "New matter activated",
    detail: "Vendor MSA Template Suite is Active with Jordan Harper as lead",
    minutesAgo: 900,
    unread: false,
    href: "/matters",
  },
];

const ATTORNEY_NOTIFICATIONS: PersonNotification[] = [
  {
    id: "at-1",
    kind: "deadline",
    title: "Filing due today",
    detail: "Response to summary judgment motion — MT-05001",
    minutesAgo: 25,
    unread: true,
    href: "/matters",
  },
  {
    id: "at-2",
    kind: "document_review",
    title: "Document review requested",
    detail: "Master Services Agreement v4 needs your sign-off",
    minutesAgo: 150,
    unread: true,
    href: "/documents",
  },
  {
    id: "at-3",
    kind: "overdue_task",
    title: "Task overdue",
    detail: "Assemble the exhibit binder for the Harbor Brook hearing",
    minutesAgo: 320,
    unread: true,
    href: "/tasks",
  },
  {
    id: "at-4",
    kind: "court_update",
    title: "Court update",
    detail: "Alvarez deposition moved to 9:30 AM Thursday",
    minutesAgo: 880,
    unread: false,
    href: "/calendar",
  },
  {
    id: "at-5",
    kind: "time_reminder",
    title: "Timekeeping reminder",
    detail: "3 draft time entries are waiting to be submitted",
    minutesAgo: 1_800,
    unread: false,
    href: "/time",
  },
  {
    id: "at-6",
    kind: "deadline",
    title: "Privilege log due in 2 days",
    detail: "Harbor Brook Partners — Vendor Litigation",
    minutesAgo: 55,
    unread: true,
    href: "/calendar",
  },
  {
    id: "at-7",
    kind: "matter_assignment",
    title: "Client message needs reply",
    detail: "Nora Vale asked about board packet financing tabs",
    minutesAgo: 95,
    unread: true,
    href: "/messages",
  },
  {
    id: "at-8",
    kind: "document_review",
    title: "Paralegal packet ready",
    detail: "Exhibit set for Northvale hearing is ready for attorney review",
    minutesAgo: 200,
    unread: false,
    href: "/document-requests",
  },
];

const PARALEGAL_NOTIFICATIONS: PersonNotification[] = [
  {
    id: "pl-1",
    kind: "deadline",
    title: "Exhibit binder due today",
    detail: "Alvarez deposition binder is needed before the 3:00 PM prep session",
    minutesAgo: 35,
    unread: true,
    href: "/tasks",
  },
  {
    id: "pl-2",
    kind: "document_review",
    title: "Upload requested",
    detail: "Jordan Harper asked for the final medical-record exhibits",
    minutesAgo: 120,
    unread: true,
    href: "/documents",
  },
  {
    id: "pl-3",
    kind: "matter_assignment",
    title: "New intake assignment",
    detail: "You were added to Cedar Ridge Development — Land Use",
    minutesAgo: 430,
    unread: true,
    href: "/case-evaluations",
  },
  {
    id: "pl-4",
    kind: "court_update",
    title: "Docket change",
    detail: "Northvale filing window opens at 8:00 AM tomorrow",
    minutesAgo: 1_200,
    unread: false,
    href: "/calendar",
  },
  {
    id: "pl-5",
    kind: "time_reminder",
    title: "Timekeeping reminder",
    detail: "Yesterday's deposition prep time has not been entered",
    minutesAgo: 1_500,
    unread: false,
    href: "/time/new",
  },
  {
    id: "pl-6",
    kind: "overdue_task",
    title: "Overdue medical records chase",
    detail: "Vendor confirmation still outstanding for Alvarez file",
    minutesAgo: 50,
    unread: true,
    href: "/tasks?filter=overdue",
  },
  {
    id: "pl-7",
    kind: "document_review",
    title: "Client upload received",
    detail: "Northvale financing consent sections waiting to organize",
    minutesAgo: 180,
    unread: true,
    href: "/document-requests",
  },
];

const BILLING_NOTIFICATIONS: PersonNotification[] = [
  {
    id: "bs-1",
    kind: "deadline",
    title: "Billing cutoff at 5:30 PM",
    detail: "4 matters are still short of billing readiness",
    minutesAgo: 15,
    unread: true,
    href: "/billing-readiness",
  },
  {
    id: "bs-2",
    kind: "overdue_task",
    title: "Unapplied payment",
    detail: "Northvale payment needs allocation to INV-010016",
    minutesAgo: 110,
    unread: true,
    href: "/payments",
  },
  {
    id: "bs-3",
    kind: "time_reminder",
    title: "Unsubmitted time blocking billing",
    detail: "12 draft entries are holding up three invoices",
    minutesAgo: 260,
    unread: true,
    href: "/time/review",
  },
  {
    id: "bs-4",
    kind: "document_review",
    title: "Expense review queued",
    detail: "Two vendor charges are waiting for receipts",
    minutesAgo: 640,
    unread: false,
    href: "/expenses/review",
  },
  {
    id: "bs-5",
    kind: "announcement",
    title: "Firm announcement",
    detail: "Month-end close checklist posted for August",
    minutesAgo: 2_400,
    unread: false,
    href: "/dashboard",
  },
  {
    id: "bs-6",
    kind: "deadline",
    title: "Retainer below threshold",
    detail: "Cedar Ridge Development retainer needs replenishment outreach",
    minutesAgo: 40,
    unread: true,
    href: "/retainers",
  },
  {
    id: "bs-7",
    kind: "document_review",
    title: "Draft invoice ready",
    detail: "Harbor Brook draft invoice awaiting final coding check",
    minutesAgo: 175,
    unread: true,
    href: "/invoices",
  },
];

const CLIENT_NOTIFICATIONS: PersonNotification[] = [
  {
    id: "cl-1",
    kind: "document_review",
    title: "Document ready for your review",
    detail: "Marked financing consent sections from Jordan Harper",
    minutesAgo: 45,
    unread: true,
    href: "/inbox",
  },
  {
    id: "cl-2",
    kind: "deadline",
    title: "Signature needed by Friday",
    detail: "Investor consent acknowledgment for MT-05001",
    minutesAgo: 210,
    unread: true,
    href: "/portal",
  },
  {
    id: "cl-3",
    kind: "announcement",
    title: "Invoice posted",
    detail: "INV-010016 is available with the updated balance",
    minutesAgo: 520,
    unread: false,
    href: "/portal/billing",
  },
  {
    id: "cl-4",
    kind: "court_update",
    title: "Matter update",
    detail: "Your Northvale matter moved to the response stage",
    minutesAgo: 1_100,
    unread: false,
    href: "/matters",
  },
  {
    id: "cl-5",
    kind: "deadline",
    title: "Payment reminder",
    detail: "INV-010016 balance is past due — pay from the client portal",
    minutesAgo: 90,
    unread: true,
    href: "/client-portal/pay",
  },
  {
    id: "cl-6",
    kind: "matter_assignment",
    title: "Meeting tomorrow",
    detail: "Board strategy call with Jordan Harper at 4:00 PM",
    minutesAgo: 300,
    unread: true,
    href: "/calendar",
  },
];

const NOTIFICATIONS_BY_ROLE: Record<UserRole, PersonNotification[]> = {
  managing_partner: PARTNER_NOTIFICATIONS,
  attorney: ATTORNEY_NOTIFICATIONS,
  paralegal: PARALEGAL_NOTIFICATIONS,
  billing_staff: BILLING_NOTIFICATIONS,
  client: CLIENT_NOTIFICATIONS,
};

export function notificationsForRole(role: UserRole): PersonNotification[] {
  return NOTIFICATIONS_BY_ROLE[role] ?? ATTORNEY_NOTIFICATIONS;
}
