/**
 * Role-aware calendar events and filter presets.
 *
 * Each demo identity sees a calendar shaped for their work — not one shared firm
 * dump. Filters offered on the Calendar page match the event types that role
 * actually uses. Replace the mock arrays with API data later without changing
 * CalendarClient.
 */
import type { UserRole } from "@/lib/types";

/** ISO date string offset from today by whole days (local calendar helper). */
function dayOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type CalendarEventType =
  | "Hearing"
  | "Deposition"
  | "Client Meeting"
  | "Filing Deadline"
  | "Statute Deadline"
  | "Internal Meeting"
  | "CLE"
  | "Document Due"
  | "Payment Due"
  | "Invoice Review"
  | "Billing Cutoff"
  | "Retainer Alert"
  | "Signature Needed"
  | "Milestone";

export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  matterRef: string;
  /** Roles that see this event on their calendar. */
  roles: UserRole[];
};

export type RoleCalendarConfig = {
  title: string;
  description: string;
  /** Filter chips shown for this role (order preserved). */
  filterTypes: CalendarEventType[];
};

export const ROLE_CALENDAR_CONFIG: Record<UserRole, RoleCalendarConfig> = {
  managing_partner: {
    title: "Firm Calendar",
    description:
      "Partner-level hearings, client strategy, critical deadlines, approvals, and firm events.",
    filterTypes: [
      "Hearing",
      "Client Meeting",
      "Filing Deadline",
      "Statute Deadline",
      "Invoice Review",
      "Internal Meeting",
      "CLE",
    ],
  },
  attorney: {
    title: "Calendar",
    description:
      "Hearings, depositions, client meetings, filing deadlines, and firm events.",
    filterTypes: [
      "Hearing",
      "Deposition",
      "Client Meeting",
      "Filing Deadline",
      "Statute Deadline",
      "Internal Meeting",
      "CLE",
    ],
  },
  paralegal: {
    title: "Staff Calendar",
    description:
      "Filing and document deadlines, deposition support, court dates, and assigned matter work.",
    filterTypes: [
      "Filing Deadline",
      "Document Due",
      "Deposition",
      "Hearing",
      "Client Meeting",
      "Internal Meeting",
    ],
  },
  billing_staff: {
    title: "Billing Calendar",
    description:
      "Billing cutoffs, invoice reviews, payment due dates, retainer alerts, and close deadlines.",
    filterTypes: [
      "Billing Cutoff",
      "Invoice Review",
      "Payment Due",
      "Retainer Alert",
      "Internal Meeting",
    ],
  },
  client: {
    title: "My Calendar",
    description:
      "Your meetings with counsel, hearings on your matters, document requests, and payment dates.",
    filterTypes: [
      "Client Meeting",
      "Hearing",
      "Document Due",
      "Signature Needed",
      "Milestone",
      "Payment Due",
    ],
  },
};

const event = (
  partial: Omit<CalendarEvent, "roles"> & { roles: UserRole[] }
): CalendarEvent => partial;

/**
 * Firm-wide mock calendar. Filter with eventsForRole() — do not render the
 * full list for every identity.
 */
export const CALENDAR_EVENTS: CalendarEvent[] = [
  // —— Shared / attorney docket ——
  event({
    id: "ev-1",
    title: "Motion hearing — Northvale Logistics",
    type: "Hearing",
    date: dayOffset(0),
    startTime: "9:30 AM",
    endTime: "11:00 AM",
    location: "Lafayette County Circuit Court, Courtroom 2",
    matterRef: "2026-0114",
    roles: ["managing_partner", "attorney", "paralegal", "client"],
  }),
  event({
    id: "ev-2",
    title: "Client strategy call — Cedar Ridge",
    type: "Client Meeting",
    date: dayOffset(0),
    startTime: "2:00 PM",
    endTime: "2:45 PM",
    location: "Video conference",
    matterRef: "2026-0127",
    roles: ["attorney", "paralegal"],
  }),
  event({
    id: "ev-3",
    title: "Deposition — R. Alvarez",
    type: "Deposition",
    date: dayOffset(1),
    startTime: "10:00 AM",
    endTime: "3:00 PM",
    location: "Rebel Law Group, Conference Room A",
    matterRef: "2026-0108",
    roles: ["attorney", "paralegal"],
  }),
  event({
    id: "ev-4",
    title: "Discovery responses due",
    type: "Filing Deadline",
    date: dayOffset(2),
    startTime: "5:00 PM",
    endTime: "5:00 PM",
    location: "E-filing portal",
    matterRef: "2026-0108",
    roles: ["attorney", "paralegal", "managing_partner"],
  }),
  event({
    id: "ev-5",
    title: "Preliminary injunction hearing",
    type: "Hearing",
    date: dayOffset(3),
    startTime: "1:15 PM",
    endTime: "3:00 PM",
    location: "U.S. District Court, N.D. Miss.",
    matterRef: "2026-0131",
    roles: ["managing_partner", "attorney", "paralegal"],
  }),
  event({
    id: "ev-6",
    title: "Practice group meeting",
    type: "Internal Meeting",
    date: dayOffset(4),
    startTime: "8:30 AM",
    endTime: "9:15 AM",
    location: "Oxford office",
    matterRef: "—",
    roles: ["managing_partner", "attorney", "paralegal"],
  }),
  event({
    id: "ev-7",
    title: "CLE — Evidence update",
    type: "CLE",
    date: dayOffset(8),
    startTime: "12:00 PM",
    endTime: "1:30 PM",
    location: "Webinar",
    matterRef: "—",
    roles: ["managing_partner", "attorney"],
  }),
  event({
    id: "ev-8",
    title: "Statute of limitations — negligence claim",
    type: "Statute Deadline",
    date: dayOffset(12),
    startTime: "All day",
    endTime: "All day",
    location: "Docket control",
    matterRef: "2026-0096",
    roles: ["managing_partner", "attorney"],
  }),
  event({
    id: "ev-9",
    title: "Quarterly client review — Sunbelt Grocers",
    type: "Client Meeting",
    date: dayOffset(-3),
    startTime: "11:00 AM",
    endTime: "12:00 PM",
    location: "Jackson office",
    matterRef: "2026-0122",
    roles: ["managing_partner", "attorney"],
  }),

  // —— Managing partner ——
  event({
    id: "ev-mp-1",
    title: "Partner approval — August write-off packet",
    type: "Invoice Review",
    date: dayOffset(0),
    startTime: "3:30 PM",
    endTime: "4:00 PM",
    location: "Partner office",
    matterRef: "Billing close",
    roles: ["managing_partner"],
  }),
  event({
    id: "ev-mp-2",
    title: "Northvale board strategy with Jordan Harper",
    type: "Client Meeting",
    date: dayOffset(1),
    startTime: "4:00 PM",
    endTime: "4:45 PM",
    location: "Video conference",
    matterRef: "MT-05001",
    roles: ["managing_partner", "attorney", "client"],
  }),
  event({
    id: "ev-mp-3",
    title: "Firm leadership huddle",
    type: "Internal Meeting",
    date: dayOffset(2),
    startTime: "8:00 AM",
    endTime: "8:45 AM",
    location: "Oxford conference room",
    matterRef: "—",
    roles: ["managing_partner", "billing_staff"],
  }),
  event({
    id: "ev-mp-4",
    title: "Case evaluation partner review — CE-2026-4304",
    type: "Internal Meeting",
    date: dayOffset(5),
    startTime: "10:00 AM",
    endTime: "10:30 AM",
    location: "Intake conference",
    matterRef: "CE-2026-4304",
    roles: ["managing_partner", "paralegal"],
  }),
  event({
    id: "ev-mp-5",
    title: "Critical filing — Northvale response sign-off",
    type: "Filing Deadline",
    date: dayOffset(0),
    startTime: "4:00 PM",
    endTime: "4:00 PM",
    location: "E-filing portal",
    matterRef: "MT-05001",
    roles: ["managing_partner", "attorney"],
  }),

  // —— Paralegal / staff ——
  event({
    id: "ev-pl-1",
    title: "Upload final Alvarez exhibit binder",
    type: "Document Due",
    date: dayOffset(0),
    startTime: "12:00 PM",
    endTime: "12:00 PM",
    location: "Document workspace",
    matterRef: "2026-0108",
    roles: ["paralegal"],
  }),
  event({
    id: "ev-pl-2",
    title: "Deposition prep — medical record order check",
    type: "Deposition",
    date: dayOffset(0),
    startTime: "3:00 PM",
    endTime: "4:00 PM",
    location: "War room",
    matterRef: "2026-0108",
    roles: ["paralegal", "attorney"],
  }),
  event({
    id: "ev-pl-3",
    title: "Court reporter exhibit labels due",
    type: "Document Due",
    date: dayOffset(1),
    startTime: "9:00 AM",
    endTime: "9:00 AM",
    location: "Vendor portal",
    matterRef: "2026-0108",
    roles: ["paralegal"],
  }),
  event({
    id: "ev-pl-4",
    title: "Cedar Ridge zoning memo draft due to attorney",
    type: "Document Due",
    date: dayOffset(3),
    startTime: "5:00 PM",
    endTime: "5:00 PM",
    location: "Matter documents",
    matterRef: "2026-0127",
    roles: ["paralegal", "attorney"],
  }),
  event({
    id: "ev-pl-5",
    title: "Intake follow-up call — new evaluation",
    type: "Client Meeting",
    date: dayOffset(2),
    startTime: "11:00 AM",
    endTime: "11:30 AM",
    location: "Phone",
    matterRef: "CE-2026-9772",
    roles: ["paralegal"],
  }),
  event({
    id: "ev-pl-6",
    title: "Northvale e-filing window opens",
    type: "Filing Deadline",
    date: dayOffset(1),
    startTime: "8:00 AM",
    endTime: "8:00 AM",
    location: "E-filing portal",
    matterRef: "MT-05001",
    roles: ["paralegal", "attorney"],
  }),

  // —— Billing ——
  event({
    id: "ev-bs-1",
    title: "Daily billing cutoff",
    type: "Billing Cutoff",
    date: dayOffset(0),
    startTime: "5:30 PM",
    endTime: "5:30 PM",
    location: "Billing workspace",
    matterRef: "Firm",
    roles: ["billing_staff"],
  }),
  event({
    id: "ev-bs-2",
    title: "Allocate Northvale payment — INV-010016",
    type: "Payment Due",
    date: dayOffset(0),
    startTime: "11:00 AM",
    endTime: "11:30 AM",
    location: "Payments queue",
    matterRef: "MT-05001",
    roles: ["billing_staff"],
  }),
  event({
    id: "ev-bs-3",
    title: "Draft invoice review — Harbor Brook",
    type: "Invoice Review",
    date: dayOffset(1),
    startTime: "2:00 PM",
    endTime: "3:00 PM",
    location: "Invoice workspace",
    matterRef: "2026-0131",
    roles: ["billing_staff", "managing_partner"],
  }),
  event({
    id: "ev-bs-4",
    title: "Retainer below threshold — Cedar Ridge",
    type: "Retainer Alert",
    date: dayOffset(2),
    startTime: "All day",
    endTime: "All day",
    location: "Retainer accounts",
    matterRef: "2026-0127",
    roles: ["billing_staff", "managing_partner"],
  }),
  event({
    id: "ev-bs-5",
    title: "Unsubmitted time blocking three invoices",
    type: "Billing Cutoff",
    date: dayOffset(0),
    startTime: "4:00 PM",
    endTime: "4:00 PM",
    location: "Time review",
    matterRef: "Firm",
    roles: ["billing_staff"],
  }),
  event({
    id: "ev-bs-6",
    title: "Month-end close checklist",
    type: "Billing Cutoff",
    date: dayOffset(6),
    startTime: "All day",
    endTime: "All day",
    location: "Billing workspace",
    matterRef: "Firm",
    roles: ["billing_staff", "managing_partner"],
  }),
  event({
    id: "ev-bs-7",
    title: "AR follow-up calls — past due invoices",
    type: "Payment Due",
    date: dayOffset(3),
    startTime: "9:00 AM",
    endTime: "11:00 AM",
    location: "Collections",
    matterRef: "AR",
    roles: ["billing_staff"],
  }),
  event({
    id: "ev-bs-8",
    title: "Expense receipt chase — vendor charges",
    type: "Invoice Review",
    date: dayOffset(4),
    startTime: "1:00 PM",
    endTime: "2:00 PM",
    location: "Expense review",
    matterRef: "Firm",
    roles: ["billing_staff"],
  }),

  // —— Current client (Nora Vale / Northvale) ——
  event({
    id: "ev-cl-2",
    title: "Upload marked financing consent sections",
    type: "Document Due",
    date: dayOffset(0),
    startTime: "5:00 PM",
    endTime: "5:00 PM",
    location: "Client portal",
    matterRef: "MT-05001",
    roles: ["client"],
  }),
  event({
    id: "ev-cl-3",
    title: "Sign investor consent acknowledgment",
    type: "Signature Needed",
    date: dayOffset(2),
    startTime: "All day",
    endTime: "All day",
    location: "Client portal",
    matterRef: "MT-05001",
    roles: ["client"],
  }),
  event({
    id: "ev-cl-4",
    title: "Board packet financing milestone",
    type: "Milestone",
    date: dayOffset(3),
    startTime: "All day",
    endTime: "All day",
    location: "Matter timeline",
    matterRef: "MT-05001",
    roles: ["client", "attorney"],
  }),
  event({
    id: "ev-cl-5",
    title: "Invoice INV-010016 balance due",
    type: "Payment Due",
    date: dayOffset(5),
    startTime: "All day",
    endTime: "All day",
    location: "Client billing",
    matterRef: "MT-05001",
    roles: ["client", "billing_staff"],
  }),
  event({
    id: "ev-cl-6",
    title: "Hearing update call — motion outcome",
    type: "Client Meeting",
    date: dayOffset(0),
    startTime: "11:30 AM",
    endTime: "12:00 PM",
    location: "Phone",
    matterRef: "2026-0114",
    roles: ["client", "attorney"],
  }),
];

export function calendarConfigForRole(role: UserRole): RoleCalendarConfig {
  return ROLE_CALENDAR_CONFIG[role] ?? ROLE_CALENDAR_CONFIG.attorney;
}

export function eventsForRole(role: UserRole): CalendarEvent[] {
  return CALENDAR_EVENTS.filter((event) => event.roles.includes(role)).sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );
}

export function eventsOnDate(isoDate: string, role?: UserRole): CalendarEvent[] {
  const source = role ? eventsForRole(role) : CALENDAR_EVENTS;
  return source
    .filter((e) => e.date === isoDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function filterTypesForRole(role: UserRole): CalendarEventType[] {
  return calendarConfigForRole(role).filterTypes;
}
