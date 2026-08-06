/**
 * Front-end workspace data for the attorney experience.
 *
 * The Supabase schema covers clients, matters, tasks, time, expenses, and
 * billing. Deadlines, documents, calendar events, messages, notifications, the
 * firm directory, and resource links are not persisted yet, so they are
 * modelled here with realistic fictional records.
 *
 * Every export is plain data plus small selector helpers so a real API layer
 * can replace the constants without touching the components that render them.
 */

import type { UserRole } from "@/lib/types";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar";

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type FocusKind =
  | "task"
  | "deadline"
  | "court"
  | "meeting"
  | "document"
  | "client";

export type FocusItem = {
  id: string;
  kind: FocusKind;
  title: string;
  matterRef: string;
  clientName: string;
  /** ISO date (YYYY-MM-DD) */
  dueDate: string;
  /** Optional wall-clock label, e.g. "9:30 AM" */
  dueTime?: string;
  priority: Priority;
  status: string;
  href: string;
};

export type WorkspaceDeadline = {
  id: string;
  title: string;
  matterRef: string;
  matterName: string;
  deadlineType:
    | "Court Filing"
    | "Statute of Limitations"
    | "Discovery"
    | "Hearing"
    | "Client Deliverable"
    | "Internal Review";
  dueDate: string;
  priority: Priority;
};

export type TaskLane = "To Do" | "In Progress" | "Waiting" | "Review" | "Completed";

export type WorkspaceTask = {
  id: string;
  name: string;
  matterRef: string;
  matterName: string;
  /** Present when the task is backed by a real matter row. */
  matterId?: string | null;
  assignee: string;
  dueDate: string;
  priority: Priority;
  lane: TaskLane;
  practiceArea: string;
};

export type ActivityKind =
  | "document_uploaded"
  | "document_edited"
  | "task_completed"
  | "status_changed"
  | "time_logged"
  | "message_received"
  | "note_added"
  | "deadline_created";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  actor: string;
  description: string;
  matterRef: string;
  /** Minutes before "now", rendered as a relative label. */
  minutesAgo: number;
};

export type {
  CalendarEvent,
  CalendarEventType,
};

export {
  CALENDAR_EVENTS,
  eventsForRole,
  eventsOnDate,
  calendarConfigForRole,
  filterTypesForRole,
} from "@/lib/calendar";

export type DocumentRecord = {
  id: string;
  name: string;
  fileType: "PDF" | "DOCX" | "XLSX" | "PPTX" | "MSG";
  matterRef: string;
  clientName: string;
  folder: string;
  uploadedBy: string;
  uploadedOn: string;
  modifiedOn: string;
  version: number;
  sizeKb: number;
  status: "Final" | "Awaiting Review" | "Draft" | "Shared" | "Template";
};

export type DirectoryPerson = {
  id: string;
  name: string;
  title: string;
  department: string;
  practiceArea: string;
  office: "Oxford" | "Jackson" | "Memphis" | "Remote";
  email: string;
  phone: string;
  availability: "Available" | "In Court" | "In a Meeting" | "Out of Office";
  initials: string;
};

export type ResourceLink = {
  id: string;
  category: string;
  title: string;
  description: string;
  href: string;
};

export type NotificationKind =
  | "deadline"
  | "overdue_task"
  | "client_message"
  | "document_review"
  | "matter_assignment"
  | "court_update"
  | "time_reminder"
  | "announcement";

export type WorkspaceNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  minutesAgo: number;
  unread: boolean;
};

export type SearchCategory =
  | "Matters"
  | "Clients"
  | "Documents"
  | "Tasks"
  | "Contacts"
  | "Attorneys";

export type SearchRecord = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  href: string;
};

export type TimekeepingSummary = {
  hoursToday: number;
  hoursWeek: number;
  billableMonth: number;
  nonBillableMonth: number;
  monthlyGoal: number;
};

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Midnight today, so server render and client hydration agree within a day. */
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO date string offset from today by whole days. */
export function dayOffset(days: number): string {
  const d = today();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days between today and an ISO date. Negative means overdue. */
export function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - today().getTime()) / 86_400_000);
}

/** Compact relative label such as "12m ago" or "3d ago". */
export function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function priorityRank(priority: Priority): number {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority];
}

/* -------------------------------------------------------------------------- */
/* Fictional records                                                          */
/* -------------------------------------------------------------------------- */

export const FOCUS_ITEMS: FocusItem[] = [
  {
    id: "focus-1",
    kind: "court",
    title: "Motion hearing — Northvale Logistics",
    matterRef: "2026-0114",
    clientName: "Northvale Logistics",
    dueDate: dayOffset(0),
    dueTime: "9:30 AM",
    priority: "Critical",
    status: "Confirmed",
    href: "/calendar",
  },
  {
    id: "focus-2",
    kind: "deadline",
    title: "File response to summary judgment motion",
    matterRef: "2026-0114",
    clientName: "Northvale Logistics",
    dueDate: dayOffset(0),
    dueTime: "4:00 PM",
    priority: "Critical",
    status: "In Progress",
    href: "/tasks",
  },
  {
    id: "focus-3",
    kind: "document",
    title: "Review revised master services agreement",
    matterRef: "2026-0131",
    clientName: "Harbor Brook Partners",
    dueDate: dayOffset(0),
    priority: "High",
    status: "Awaiting Review",
    href: "/documents",
  },
  {
    id: "focus-4",
    kind: "meeting",
    title: "Client strategy call — Cedar Ridge Development",
    matterRef: "2026-0127",
    clientName: "Cedar Ridge Development",
    dueDate: dayOffset(0),
    dueTime: "2:00 PM",
    priority: "Medium",
    status: "Scheduled",
    href: "/calendar",
  },
  {
    id: "focus-5",
    kind: "client",
    title: "Respond to inquiry about settlement posture",
    matterRef: "2026-0108",
    clientName: "Delta Freight Systems",
    dueDate: dayOffset(0),
    priority: "High",
    status: "Awaiting Response",
    href: "/messages",
  },
  {
    id: "focus-6",
    kind: "task",
    title: "Finalize deposition outline for R. Alvarez",
    matterRef: "2026-0108",
    clientName: "Delta Freight Systems",
    dueDate: dayOffset(0),
    priority: "Medium",
    status: "To Do",
    href: "/tasks",
  },
];

export const DEADLINES: WorkspaceDeadline[] = [
  {
    id: "dl-1",
    title: "Response to motion for summary judgment",
    matterRef: "2026-0114",
    matterName: "Northvale Logistics v. Tri-State Carriers",
    deadlineType: "Court Filing",
    dueDate: dayOffset(0),
    priority: "Critical",
  },
  {
    id: "dl-2",
    title: "Serve written discovery responses",
    matterRef: "2026-0108",
    matterName: "Delta Freight Systems — Contract Dispute",
    deadlineType: "Discovery",
    dueDate: dayOffset(2),
    priority: "High",
  },
  {
    id: "dl-3",
    title: "Preliminary injunction hearing",
    matterRef: "2026-0131",
    matterName: "Harbor Brook Partners — Vendor Litigation",
    deadlineType: "Hearing",
    dueDate: dayOffset(3),
    priority: "High",
  },
  {
    id: "dl-4",
    title: "Deliver zoning compliance memorandum",
    matterRef: "2026-0127",
    matterName: "Cedar Ridge Development — Land Use",
    deadlineType: "Client Deliverable",
    dueDate: dayOffset(6),
    priority: "Medium",
  },
  {
    id: "dl-5",
    title: "Statute of limitations — negligence claim",
    matterRef: "2026-0096",
    matterName: "Whitfield Manufacturing — Products Liability",
    deadlineType: "Statute of Limitations",
    dueDate: dayOffset(12),
    priority: "Critical",
  },
  {
    id: "dl-6",
    title: "Internal engagement letter review",
    matterRef: "2026-0140",
    matterName: "Marigold Health — Regulatory Advisory",
    deadlineType: "Internal Review",
    dueDate: dayOffset(15),
    priority: "Low",
  },
];

export const TASKS: WorkspaceTask[] = [
  {
    id: "tk-1",
    name: "Draft response to summary judgment motion",
    matterRef: "2026-0114",
    matterName: "Northvale Logistics v. Tri-State Carriers",
    assignee: "Avery Chen",
    dueDate: dayOffset(0),
    priority: "Critical",
    lane: "In Progress",
    practiceArea: "Litigation",
  },
  {
    id: "tk-2",
    name: "Finalize deposition outline for R. Alvarez",
    matterRef: "2026-0108",
    matterName: "Delta Freight Systems — Contract Dispute",
    assignee: "Avery Chen",
    dueDate: dayOffset(0),
    priority: "Medium",
    lane: "To Do",
    practiceArea: "Litigation",
  },
  {
    id: "tk-3",
    name: "Collect signed engagement letter",
    matterRef: "2026-0140",
    matterName: "Marigold Health — Regulatory Advisory",
    assignee: "Priya Rose",
    dueDate: dayOffset(-2),
    priority: "High",
    lane: "Waiting",
    practiceArea: "Regulatory",
  },
  {
    id: "tk-4",
    name: "Assemble exhibit binder for hearing",
    matterRef: "2026-0131",
    matterName: "Harbor Brook Partners — Vendor Litigation",
    assignee: "Priya Rose",
    dueDate: dayOffset(-1),
    priority: "High",
    lane: "In Progress",
    practiceArea: "Litigation",
  },
  {
    id: "tk-5",
    name: "Update zoning research memorandum",
    matterRef: "2026-0127",
    matterName: "Cedar Ridge Development — Land Use",
    assignee: "Avery Chen",
    dueDate: dayOffset(3),
    priority: "Medium",
    lane: "To Do",
    practiceArea: "Real Estate",
  },
  {
    id: "tk-6",
    name: "Partner review of settlement analysis",
    matterRef: "2026-0108",
    matterName: "Delta Freight Systems — Contract Dispute",
    assignee: "Jordan Harper",
    dueDate: dayOffset(4),
    priority: "High",
    lane: "Review",
    practiceArea: "Litigation",
  },
  {
    id: "tk-7",
    name: "Confirm expert witness availability",
    matterRef: "2026-0096",
    matterName: "Whitfield Manufacturing — Products Liability",
    assignee: "Avery Chen",
    dueDate: dayOffset(7),
    priority: "Low",
    lane: "Waiting",
    practiceArea: "Litigation",
  },
  {
    id: "tk-8",
    name: "File corporate annual report",
    matterRef: "2026-0122",
    matterName: "Sunbelt Grocers — Corporate Maintenance",
    assignee: "Marcus Webb",
    dueDate: dayOffset(-5),
    priority: "Medium",
    lane: "Completed",
    practiceArea: "Corporate",
  },
  {
    id: "tk-9",
    name: "Send closing binder to client",
    matterRef: "2026-0119",
    matterName: "Ridgeline Capital — Asset Purchase",
    assignee: "Avery Chen",
    dueDate: dayOffset(-8),
    priority: "Low",
    lane: "Completed",
    practiceArea: "Corporate",
  },
  {
    id: "tk-10",
    name: "Prepare witness prep schedule",
    matterRef: "2026-0114",
    matterName: "Northvale Logistics v. Tri-State Carriers",
    assignee: "Priya Rose",
    dueDate: dayOffset(5),
    priority: "Medium",
    lane: "To Do",
    practiceArea: "Litigation",
  },
];

export const ACTIVITY: ActivityEvent[] = [
  {
    id: "ac-1",
    kind: "document_uploaded",
    actor: "Priya Rose",
    description: "uploaded Exhibit C — carrier inspection log",
    matterRef: "2026-0114",
    minutesAgo: 18,
  },
  {
    id: "ac-2",
    kind: "message_received",
    actor: "Nadia Vale",
    description: "sent a message about settlement posture",
    matterRef: "2026-0108",
    minutesAgo: 55,
  },
  {
    id: "ac-3",
    kind: "task_completed",
    actor: "Marcus Webb",
    description: "completed File corporate annual report",
    matterRef: "2026-0122",
    minutesAgo: 140,
  },
  {
    id: "ac-4",
    kind: "time_logged",
    actor: "Avery Chen",
    description: "logged 2.4 hours of research",
    matterRef: "2026-0127",
    minutesAgo: 190,
  },
  {
    id: "ac-5",
    kind: "status_changed",
    actor: "Jordan Harper",
    description: "moved the matter to Active",
    matterRef: "2026-0140",
    minutesAgo: 420,
  },
  {
    id: "ac-6",
    kind: "deadline_created",
    actor: "Avery Chen",
    description: "added a statute of limitations deadline",
    matterRef: "2026-0096",
    minutesAgo: 1_500,
  },
  {
    id: "ac-7",
    kind: "document_edited",
    actor: "Avery Chen",
    description: "edited Master Services Agreement v4",
    matterRef: "2026-0131",
    minutesAgo: 1_760,
  },
  {
    id: "ac-8",
    kind: "note_added",
    actor: "Priya Rose",
    description: "added a call note from opposing counsel",
    matterRef: "2026-0108",
    minutesAgo: 2_900,
  },
];

export const DOCUMENTS: DocumentRecord[] = [
  {
    id: "doc-1",
    name: "Response to Motion for Summary Judgment (draft)",
    fileType: "DOCX",
    matterRef: "2026-0114",
    clientName: "Northvale Logistics",
    folder: "Pleadings",
    uploadedBy: "Avery Chen",
    uploadedOn: dayOffset(-2),
    modifiedOn: dayOffset(0),
    version: 4,
    sizeKb: 186,
    status: "Draft",
  },
  {
    id: "doc-2",
    name: "Master Services Agreement v4",
    fileType: "PDF",
    matterRef: "2026-0131",
    clientName: "Harbor Brook Partners",
    folder: "Contracts",
    uploadedBy: "Jordan Harper",
    uploadedOn: dayOffset(-6),
    modifiedOn: dayOffset(-1),
    version: 4,
    sizeKb: 742,
    status: "Awaiting Review",
  },
  {
    id: "doc-3",
    name: "Exhibit C — Carrier Inspection Log",
    fileType: "PDF",
    matterRef: "2026-0114",
    clientName: "Northvale Logistics",
    folder: "Exhibits",
    uploadedBy: "Priya Rose",
    uploadedOn: dayOffset(0),
    modifiedOn: dayOffset(0),
    version: 1,
    sizeKb: 2_310,
    status: "Final",
  },
  {
    id: "doc-4",
    name: "Zoning Compliance Memorandum",
    fileType: "DOCX",
    matterRef: "2026-0127",
    clientName: "Cedar Ridge Development",
    folder: "Memoranda",
    uploadedBy: "Avery Chen",
    uploadedOn: dayOffset(-4),
    modifiedOn: dayOffset(-1),
    version: 2,
    sizeKb: 96,
    status: "Awaiting Review",
  },
  {
    id: "doc-5",
    name: "Settlement Analysis Worksheet",
    fileType: "XLSX",
    matterRef: "2026-0108",
    clientName: "Delta Freight Systems",
    folder: "Analysis",
    uploadedBy: "Avery Chen",
    uploadedOn: dayOffset(-9),
    modifiedOn: dayOffset(-2),
    version: 3,
    sizeKb: 58,
    status: "Shared",
  },
  {
    id: "doc-6",
    name: "Engagement Letter — Standard Hourly",
    fileType: "DOCX",
    matterRef: "—",
    clientName: "Firm template",
    folder: "Templates",
    uploadedBy: "Firm Administration",
    uploadedOn: dayOffset(-120),
    modifiedOn: dayOffset(-30),
    version: 7,
    sizeKb: 44,
    status: "Template",
  },
  {
    id: "doc-7",
    name: "Deposition Notice — R. Alvarez",
    fileType: "PDF",
    matterRef: "2026-0108",
    clientName: "Delta Freight Systems",
    folder: "Discovery",
    uploadedBy: "Priya Rose",
    uploadedOn: dayOffset(-11),
    modifiedOn: dayOffset(-11),
    version: 1,
    sizeKb: 121,
    status: "Final",
  },
  {
    id: "doc-8",
    name: "Client correspondence — settlement posture",
    fileType: "MSG",
    matterRef: "2026-0108",
    clientName: "Delta Freight Systems",
    folder: "Correspondence",
    uploadedBy: "Nadia Vale",
    uploadedOn: dayOffset(0),
    modifiedOn: dayOffset(0),
    version: 1,
    sizeKb: 18,
    status: "Shared",
  },
  {
    id: "doc-9",
    name: "Closing Binder — Ridgeline Capital",
    fileType: "PDF",
    matterRef: "2026-0119",
    clientName: "Ridgeline Capital",
    folder: "Closing",
    uploadedBy: "Marcus Webb",
    uploadedOn: dayOffset(-18),
    modifiedOn: dayOffset(-18),
    version: 1,
    sizeKb: 5_480,
    status: "Final",
  },
  {
    id: "doc-10",
    name: "Motion in Limine — template",
    fileType: "DOCX",
    matterRef: "—",
    clientName: "Firm template",
    folder: "Templates",
    uploadedBy: "Firm Administration",
    uploadedOn: dayOffset(-200),
    modifiedOn: dayOffset(-45),
    version: 3,
    sizeKb: 61,
    status: "Template",
  },
];

export const DIRECTORY: DirectoryPerson[] = [
  {
    id: "p-1",
    name: "Jordan Harper",
    title: "Managing Partner",
    department: "Firm Leadership",
    practiceArea: "Litigation",
    office: "Oxford",
    email: "jharper@rebellaw.demo",
    phone: "(662) 555-0142",
    availability: "In a Meeting",
    initials: "JH",
  },
  {
    id: "p-2",
    name: "Avery Chen",
    title: "Attorney",
    department: "Litigation",
    practiceArea: "Litigation",
    office: "Oxford",
    email: "achen@rebellaw.demo",
    phone: "(662) 555-0188",
    availability: "Available",
    initials: "AC",
  },
  {
    id: "p-3",
    name: "Priya Rose",
    title: "Paralegal",
    department: "Litigation Support",
    practiceArea: "Litigation",
    office: "Oxford",
    email: "prose@rebellaw.demo",
    phone: "(662) 555-0163",
    availability: "Available",
    initials: "PR",
  },
  {
    id: "p-4",
    name: "Marcus Webb",
    title: "Associate Attorney",
    department: "Corporate",
    practiceArea: "Corporate",
    office: "Jackson",
    email: "mwebb@rebellaw.demo",
    phone: "(601) 555-0119",
    availability: "In Court",
    initials: "MW",
  },
  {
    id: "p-5",
    name: "Dana Okafor",
    title: "Billing Manager",
    department: "Finance",
    practiceArea: "Firm Administration",
    office: "Oxford",
    email: "billing@rebellaw.demo",
    phone: "(662) 555-0170",
    availability: "Available",
    initials: "DO",
  },
  {
    id: "p-6",
    name: "Elena Cruz",
    title: "Legal Assistant",
    department: "Litigation Support",
    practiceArea: "Litigation",
    office: "Memphis",
    email: "ecruz@rebellaw.demo",
    phone: "(901) 555-0134",
    availability: "Out of Office",
    initials: "EC",
  },
  {
    id: "p-7",
    name: "Samuel Boyd",
    title: "Attorney",
    department: "Real Estate",
    practiceArea: "Real Estate",
    office: "Jackson",
    email: "sboyd@rebellaw.demo",
    phone: "(601) 555-0155",
    availability: "Available",
    initials: "SB",
  },
  {
    id: "p-8",
    name: "Renee Patel",
    title: "Office Administrator",
    department: "Firm Administration",
    practiceArea: "Firm Administration",
    office: "Remote",
    email: "rpatel@rebellaw.demo",
    phone: "(662) 555-0101",
    availability: "Available",
    initials: "RP",
  },
];

export const RESOURCES: ResourceLink[] = [
  {
    id: "r-1",
    category: "Firm Policies",
    title: "Conflict of Interest Policy",
    description: "Screening standards and the intake conflict-check workflow.",
    href: "/resources",
  },
  {
    id: "r-2",
    category: "Firm Policies",
    title: "Employee Handbook",
    description: "Employment terms, benefits, and workplace expectations.",
    href: "/resources",
  },
  {
    id: "r-3",
    category: "Court Rules",
    title: "Mississippi Rules of Civil Procedure",
    description: "Current civil procedure rules with local court variations.",
    href: "/resources",
  },
  {
    id: "r-4",
    category: "Court Rules",
    title: "N.D. Miss. Local Rules",
    description: "Federal district local rules and judge-specific standing orders.",
    href: "/resources",
  },
  {
    id: "r-5",
    category: "Court Forms",
    title: "Civil Cover Sheet Packet",
    description: "Fillable state and federal civil filing forms.",
    href: "/resources",
  },
  {
    id: "r-6",
    category: "Legal Templates",
    title: "Engagement Letter Library",
    description: "Hourly, flat fee, and contingency engagement templates.",
    href: "/documents",
  },
  {
    id: "r-7",
    category: "Brief Bank",
    title: "Summary Judgment Briefs",
    description: "Prior briefing organized by claim type and court.",
    href: "/documents",
  },
  {
    id: "r-8",
    category: "Contract Clauses",
    title: "Clause Library",
    description: "Indemnity, limitation of liability, and arbitration language.",
    href: "/documents",
  },
  {
    id: "r-9",
    category: "CLE Materials",
    title: "2026 CLE Catalog",
    description: "Approved coursework and credit tracking for the year.",
    href: "/resources",
  },
  {
    id: "r-10",
    category: "Technology Guides",
    title: "E-Filing Quick Reference",
    description: "Step-by-step guidance for state and federal e-filing.",
    href: "/resources",
  },
  {
    id: "r-11",
    category: "Technology Guides",
    title: "Timekeeping Best Practices",
    description: "Contemporaneous entry standards and narrative guidance.",
    href: "/time",
  },
  {
    id: "r-12",
    category: "Marketing Resources",
    title: "Firm Brand Kit",
    description: "Letterhead, presentation templates, and logo usage rules.",
    href: "/resources",
  },
];

/**
 * Notification content now lives in src/lib/notifications.ts so each person
 * sees their own alerts. WorkspaceNotification stays here as the shared type.
 */

export const SEARCH_INDEX: SearchRecord[] = [
  { id: "s-1", category: "Matters", title: "2026-0114 · Northvale Logistics v. Tri-State Carriers", subtitle: "Litigation · Active", href: "/matters" },
  { id: "s-2", category: "Matters", title: "2026-0108 · Delta Freight Systems — Contract Dispute", subtitle: "Litigation · Active", href: "/matters" },
  { id: "s-3", category: "Matters", title: "2026-0131 · Harbor Brook Partners — Vendor Litigation", subtitle: "Litigation · Active", href: "/matters" },
  { id: "s-4", category: "Matters", title: "2026-0127 · Cedar Ridge Development — Land Use", subtitle: "Real Estate · Active", href: "/matters" },
  { id: "s-5", category: "Clients", title: "Northvale Logistics", subtitle: "Business client · 3 active matters", href: "/clients" },
  { id: "s-6", category: "Clients", title: "Harbor Brook Partners", subtitle: "Business client · 2 active matters", href: "/clients" },
  { id: "s-7", category: "Clients", title: "Cedar Ridge Development", subtitle: "Business client · 1 active matter", href: "/clients" },
  { id: "s-8", category: "Documents", title: "Master Services Agreement v4", subtitle: "PDF · Harbor Brook Partners", href: "/documents" },
  { id: "s-9", category: "Documents", title: "Exhibit C — Carrier Inspection Log", subtitle: "PDF · Northvale Logistics", href: "/documents" },
  { id: "s-10", category: "Documents", title: "Zoning Compliance Memorandum", subtitle: "DOCX · Cedar Ridge Development", href: "/documents" },
  { id: "s-11", category: "Tasks", title: "Draft response to summary judgment motion", subtitle: "Due today · Critical", href: "/tasks" },
  { id: "s-12", category: "Tasks", title: "Assemble exhibit binder for hearing", subtitle: "Overdue · High", href: "/tasks" },
  { id: "s-13", category: "Contacts", title: "Nadia Vale", subtitle: "Client contact · Northvale Logistics", href: "/clients" },
  { id: "s-14", category: "Contacts", title: "Casey Brook", subtitle: "Client contact · Harbor Brook Partners", href: "/clients" },
  { id: "s-15", category: "Attorneys", title: "Jordan Harper", subtitle: "Managing Partner · Litigation", href: "/directory" },
  { id: "s-16", category: "Attorneys", title: "Avery Chen", subtitle: "Attorney · Litigation", href: "/directory" },
  { id: "s-17", category: "Attorneys", title: "Samuel Boyd", subtitle: "Attorney · Real Estate", href: "/directory" },
];

export const TIMEKEEPING: TimekeepingSummary = {
  hoursToday: 3.4,
  hoursWeek: 22.8,
  billableMonth: 96.5,
  nonBillableMonth: 18.2,
  monthlyGoal: 140,
};

export const SEARCH_CATEGORY_ORDER: SearchCategory[] = [
  "Matters",
  "Clients",
  "Documents",
  "Tasks",
  "Contacts",
  "Attorneys",
];

/* -------------------------------------------------------------------------- */
/* Matter and client workspace detail                                         */
/* -------------------------------------------------------------------------- */

export type MatterProfile = {
  matterType: string;
  priority: Priority;
  court: string;
  judge: string;
  opposingCounsel: string;
  caseSummary: string;
};

/** Litigation context the schema does not capture yet. */
export const MATTER_PROFILE: MatterProfile = {
  matterType: "Commercial litigation — breach of contract",
  priority: "High",
  court: "Lafayette County Circuit Court",
  judge: "Hon. Marissa Ellison",
  opposingCounsel: "Grayson & Pike LLP — T. Grayson",
  caseSummary:
    "The client seeks damages arising from a failed carrier agreement. Discovery is substantially complete and the parties are briefing summary judgment. Mediation is scheduled after the dispositive motion ruling.",
};

export type TimelineEntryType =
  | "Matter Opened"
  | "Communication"
  | "Document"
  | "Court Filing"
  | "Hearing"
  | "Deposition"
  | "Deadline"
  | "Note"
  | "Status Change";

export type TimelineEntry = {
  id: string;
  type: TimelineEntryType;
  title: string;
  detail: string;
  date: string;
};

export const MATTER_TIMELINE: TimelineEntry[] = [
  {
    id: "tl-1",
    type: "Matter Opened",
    title: "Matter opened and engagement letter signed",
    detail: "Engagement terms accepted; initial retainer received.",
    date: dayOffset(-210),
  },
  {
    id: "tl-2",
    type: "Communication",
    title: "Initial client intake call",
    detail: "Reviewed contract history and preserved relevant records.",
    date: dayOffset(-205),
  },
  {
    id: "tl-3",
    type: "Court Filing",
    title: "Complaint filed",
    detail: "Filed in Lafayette County Circuit Court, docket 2026-CV-0442.",
    date: dayOffset(-186),
  },
  {
    id: "tl-4",
    type: "Document",
    title: "Document production, volume 1",
    detail: "1,842 pages produced and Bates numbered.",
    date: dayOffset(-120),
  },
  {
    id: "tl-5",
    type: "Deposition",
    title: "Deposition of corporate representative",
    detail: "Full-day deposition; transcript received and summarized.",
    date: dayOffset(-74),
  },
  {
    id: "tl-6",
    type: "Note",
    title: "Settlement posture memo",
    detail: "Recorded the client's authority range ahead of mediation.",
    date: dayOffset(-45),
  },
  {
    id: "tl-7",
    type: "Status Change",
    title: "Matter moved to dispositive motion phase",
    detail: "Discovery closed; briefing schedule entered.",
    date: dayOffset(-30),
  },
  {
    id: "tl-8",
    type: "Deadline",
    title: "Summary judgment response deadline set",
    detail: "Response due with the court's briefing order.",
    date: dayOffset(-14),
  },
  {
    id: "tl-9",
    type: "Hearing",
    title: "Motion hearing scheduled",
    detail: "Set for Courtroom 2 before Judge Ellison.",
    date: dayOffset(0),
  },
];

export type MatterNote = {
  id: string;
  author: string;
  date: string;
  body: string;
};

export const MATTER_NOTES: MatterNote[] = [
  {
    id: "note-1",
    author: "Avery Chen",
    date: dayOffset(-2),
    body: "Opposing counsel signaled willingness to mediate after the summary judgment ruling. Client wants a damages update before committing.",
  },
  {
    id: "note-2",
    author: "Priya Rose",
    date: dayOffset(-9),
    body: "Exhibit binder assembled through Exhibit L. Two inspection photographs still need higher-resolution copies.",
  },
  {
    id: "note-3",
    author: "Jordan Harper",
    date: dayOffset(-21),
    body: "Reviewed the damages model. Recommend limiting consequential damages theory to the two strongest invoices.",
  },
];

export type MatterEmail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  preview: string;
  minutesAgo: number;
};

export const MATTER_EMAILS: MatterEmail[] = [
  {
    id: "em-1",
    from: "Nadia Vale",
    to: "Avery Chen",
    subject: "Question about settlement posture",
    preview: "Before the hearing, can you summarize where we stand on the mediation range?",
    minutesAgo: 55,
  },
  {
    id: "em-2",
    from: "T. Grayson",
    to: "Avery Chen",
    subject: "Joint status report",
    preview: "Attached is our proposed draft of the joint status report for your review.",
    minutesAgo: 900,
  },
  {
    id: "em-3",
    from: "Court Clerk",
    to: "Counsel of record",
    subject: "Courtroom reassignment",
    preview: "The motion hearing has been reassigned to Courtroom 2.",
    minutesAgo: 1_450,
  },
];

export type MatterContact = {
  id: string;
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
};

export const MATTER_CONTACTS: MatterContact[] = [
  {
    id: "mc-1",
    name: "Nadia Vale",
    role: "Client contact",
    organization: "Northvale Logistics",
    email: "nvale@northvale.demo",
    phone: "(662) 555-0311",
  },
  {
    id: "mc-2",
    name: "T. Grayson",
    role: "Opposing counsel",
    organization: "Grayson & Pike LLP",
    email: "tgrayson@graysonpike.demo",
    phone: "(601) 555-0288",
  },
  {
    id: "mc-3",
    name: "Dr. Elaine Sutter",
    role: "Expert witness",
    organization: "Sutter Logistics Consulting",
    email: "esutter@sutterlc.demo",
    phone: "(901) 555-0177",
  },
  {
    id: "mc-4",
    name: "Hon. Marissa Ellison",
    role: "Presiding judge",
    organization: "Lafayette County Circuit Court",
    email: "chambers@lafayettecc.demo",
    phone: "(662) 555-0400",
  },
];

export type CourtFiling = {
  id: string;
  title: string;
  docket: string;
  court: string;
  filedOn: string;
  status: "Filed" | "Pending" | "Draft" | "Served";
};

export const COURT_FILINGS: CourtFiling[] = [
  {
    id: "cf-1",
    title: "Complaint",
    docket: "2026-CV-0442",
    court: "Lafayette County Circuit Court",
    filedOn: dayOffset(-186),
    status: "Filed",
  },
  {
    id: "cf-2",
    title: "Answer and affirmative defenses",
    docket: "2026-CV-0442",
    court: "Lafayette County Circuit Court",
    filedOn: dayOffset(-160),
    status: "Served",
  },
  {
    id: "cf-3",
    title: "Motion for summary judgment (opposing party)",
    docket: "2026-CV-0442",
    court: "Lafayette County Circuit Court",
    filedOn: dayOffset(-28),
    status: "Filed",
  },
  {
    id: "cf-4",
    title: "Response to motion for summary judgment",
    docket: "2026-CV-0442",
    court: "Lafayette County Circuit Court",
    filedOn: dayOffset(0),
    status: "Draft",
  },
];

export type ClientCommunication = {
  id: string;
  channel: "Email" | "Phone" | "Meeting" | "Portal";
  summary: string;
  minutesAgo: number;
};

export const CLIENT_COMMUNICATIONS: ClientCommunication[] = [
  {
    id: "cc-1",
    channel: "Email",
    summary: "Client asked about settlement posture ahead of the hearing.",
    minutesAgo: 55,
  },
  {
    id: "cc-2",
    channel: "Phone",
    summary: "Discussed document production timing with the client contact.",
    minutesAgo: 2_100,
  },
  {
    id: "cc-3",
    channel: "Meeting",
    summary: "Quarterly matter review with the client's general counsel.",
    minutesAgo: 4_400,
  },
  {
    id: "cc-4",
    channel: "Portal",
    summary: "Client downloaded the latest invoice from the billing portal.",
    minutesAgo: 7_800,
  },
];

export type ConflictCheckRecord = {
  id: string;
  runOn: string;
  performedBy: string;
  scope: string;
  result: "Cleared" | "Cleared with screen" | "Escalated";
};

export const CONFLICT_CHECKS: ConflictCheckRecord[] = [
  {
    id: "cx-1",
    runOn: dayOffset(-210),
    performedBy: "Renee Patel",
    scope: "Client, affiliates, and adverse parties",
    result: "Cleared",
  },
  {
    id: "cx-2",
    runOn: dayOffset(-120),
    performedBy: "Renee Patel",
    scope: "Newly identified third-party carrier",
    result: "Cleared with screen",
  },
];

export const PREFERRED_CONTACT_METHOD = "Email, with phone follow-up for urgent items";

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export function upcomingDeadlines(limit = 5): WorkspaceDeadline[] {
  return [...DEADLINES]
    .filter((d) => daysUntil(d.dueDate) >= 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, limit);
}

export function tasksDueToday(): WorkspaceTask[] {
  return TASKS.filter((t) => t.lane !== "Completed" && daysUntil(t.dueDate) === 0);
}

export function overdueTasks(): WorkspaceTask[] {
  return TASKS.filter((t) => t.lane !== "Completed" && daysUntil(t.dueDate) < 0);
}

export function searchWorkspace(query: string, limit = 8): SearchRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.filter(
    (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
  ).slice(0, limit);
}

/** Jordan Harper attorney-only calendar set (relative to today). */
export function attorneyCalendarEvents(): CalendarEvent[] {
  const roles: UserRole[] = ["attorney"];
  return [
    {
      id: "atty-ev-1",
      title: "Hearing prep call — Vale v. Northbound Motors",
      type: "Client Meeting",
      date: dayOffset(0),
      startTime: "9:00 AM",
      endTime: "9:45 AM",
      location: "Video conference",
      matterRef: "MT-2001",
      roles,
    },
    {
      id: "atty-ev-2",
      title: "Motion hearing — discovery disputes",
      type: "Hearing",
      date: dayOffset(0),
      startTime: "1:30 PM",
      endTime: "3:00 PM",
      location: "Lafayette County Circuit Court, Courtroom 3",
      matterRef: "MT-2001",
      roles,
    },
    {
      id: "atty-ev-3",
      title: "Estate inventory filing deadline",
      type: "Filing Deadline",
      date: dayOffset(2),
      startTime: "5:00 PM",
      endTime: "5:00 PM",
      location: "E-filing portal",
      matterRef: "MT-2003",
      roles,
    },
    {
      id: "atty-ev-4",
      title: "Client update — Cruz estate administration",
      type: "Client Meeting",
      date: dayOffset(3),
      startTime: "10:00 AM",
      endTime: "10:45 AM",
      location: "Oxford office",
      matterRef: "MT-2003",
      roles,
    },
    {
      id: "atty-ev-5",
      title: "Vendor dispute strategy conference",
      type: "Internal Meeting",
      date: dayOffset(4),
      startTime: "8:30 AM",
      endTime: "9:15 AM",
      location: "Rebel Law Group, Conference Room B",
      matterRef: "MT-2002",
      roles,
    },
    {
      id: "atty-ev-6",
      title: "Deposition — Harbor Logistics witness",
      type: "Deposition",
      date: dayOffset(6),
      startTime: "10:00 AM",
      endTime: "2:00 PM",
      location: "Rebel Law Group, Conference Room A",
      matterRef: "MT-2002",
      roles,
    },
    {
      id: "atty-ev-7",
      title: "Court appearance — status conference",
      type: "Hearing",
      date: dayOffset(11),
      startTime: "9:00 AM",
      endTime: "10:00 AM",
      location: "Chancery Court",
      matterRef: "MT-2003",
      roles,
    },
    {
      id: "atty-ev-8",
      title: "CLE — Civil procedure update",
      type: "CLE",
      date: dayOffset(8),
      startTime: "12:00 PM",
      endTime: "1:00 PM",
      location: "Webinar",
      matterRef: "—",
      roles,
    },
    {
      id: "atty-ev-9",
      title: "Statute check — negligence claim window",
      type: "Statute Deadline",
      date: dayOffset(14),
      startTime: "All day",
      endTime: "All day",
      location: "Docket control",
      matterRef: "MT-2001",
      roles,
    },
  ];
}

/** Attorney-scoped mock tasks when live matter_tasks are empty. */
export const ATTORNEY_TASKS: WorkspaceTask[] = [
  {
    id: "atty-tk-1",
    name: "Draft opposition to motion to compel",
    matterRef: "MT-2001",
    matterName: "Vale v. Northbound Motors",
    assignee: "Jordan Harper",
    dueDate: dayOffset(-1),
    priority: "High",
    lane: "In Progress",
    practiceArea: "Litigation",
  },
  {
    id: "atty-tk-2",
    name: "Confirm hearing exhibit list with client",
    matterRef: "MT-2001",
    matterName: "Vale v. Northbound Motors",
    assignee: "Jordan Harper",
    dueDate: dayOffset(0),
    priority: "Critical",
    lane: "To Do",
    practiceArea: "Litigation",
  },
  {
    id: "atty-tk-3",
    name: "Prepare estate inventory summary",
    matterRef: "MT-2003",
    matterName: "Cruz estate administration",
    assignee: "Jordan Harper",
    dueDate: dayOffset(1),
    priority: "Medium",
    lane: "Waiting",
    practiceArea: "Estates",
  },
  {
    id: "atty-tk-4",
    name: "Outline settlement demand letter",
    matterRef: "MT-2002",
    matterName: "Harbor Logistics vendor dispute",
    assignee: "Jordan Harper",
    dueDate: dayOffset(2),
    priority: "High",
    lane: "To Do",
    practiceArea: "Litigation",
  },
  {
    id: "atty-tk-5",
    name: "Client status email — case strategy",
    matterRef: "MT-2002",
    matterName: "Harbor Logistics vendor dispute",
    assignee: "Jordan Harper",
    dueDate: dayOffset(0),
    priority: "Critical",
    lane: "In Progress",
    practiceArea: "Litigation",
  },
  {
    id: "atty-tk-6",
    name: "Calendar deposition follow-ups",
    matterRef: "MT-2002",
    matterName: "Harbor Logistics vendor dispute",
    assignee: "Jordan Harper",
    dueDate: dayOffset(-3),
    priority: "Medium",
    lane: "Waiting",
    practiceArea: "Litigation",
  },
];

/** Attorney-scoped activity feed when live matter_activity is empty. */
export const ATTORNEY_ACTIVITY: ActivityEvent[] = [
  {
    id: "atty-ac-1",
    kind: "document_uploaded",
    actor: "Jordan Harper",
    description: "uploaded draft opposition brief for partner review",
    matterRef: "MT-2001",
    minutesAgo: 45,
  },
  {
    id: "atty-ac-2",
    kind: "task_completed",
    actor: "Jordan Harper",
    description: "completed conflict check confirmation for hearing exhibits",
    matterRef: "MT-2001",
    minutesAgo: 120,
  },
  {
    id: "atty-ac-3",
    kind: "note_added",
    actor: "Jordan Harper",
    description: "added note from client call regarding inventory documents",
    matterRef: "MT-2003",
    minutesAgo: 300,
  },
  {
    id: "atty-ac-4",
    kind: "time_logged",
    actor: "Jordan Harper",
    description: "logged 1.8 hours of settlement research",
    matterRef: "MT-2002",
    minutesAgo: 480,
  },
  {
    id: "atty-ac-5",
    kind: "status_changed",
    actor: "Jordan Harper",
    description: "updated matter status notes ahead of motion hearing",
    matterRef: "MT-2001",
    minutesAgo: 900,
  },
  {
    id: "atty-ac-6",
    kind: "deadline_created",
    actor: "Jordan Harper",
    description: "added filing deadline for estate inventory summary",
    matterRef: "MT-2003",
    minutesAgo: 1_200,
  },
  {
    id: "atty-ac-7",
    kind: "document_edited",
    actor: "Jordan Harper",
    description: "edited vendor contract chronology memorandum",
    matterRef: "MT-2002",
    minutesAgo: 2_000,
  },
  {
    id: "atty-ac-8",
    kind: "message_received",
    actor: "Jordan Harper",
    description: "sent message to client confirming exhibit list call",
    matterRef: "MT-2001",
    minutesAgo: 2_800,
  },
];

/** Attorney-scoped focus list when live focus derivation is empty. */
export const ATTORNEY_FOCUS_ITEMS: FocusItem[] = [
  {
    id: "atty-focus-1",
    kind: "court",
    title: "Motion hearing — discovery disputes",
    matterRef: "MT-2001",
    clientName: "Northvale / Vale",
    dueDate: dayOffset(0),
    dueTime: "1:30 PM",
    priority: "Critical",
    status: "Confirmed",
    href: "/calendar",
  },
  {
    id: "atty-focus-2",
    kind: "task",
    title: "Confirm hearing exhibit list with client",
    matterRef: "MT-2001",
    clientName: "Vale",
    dueDate: dayOffset(0),
    dueTime: "Morning",
    priority: "Critical",
    status: "To Do",
    href: "/tasks",
  },
  {
    id: "atty-focus-3",
    kind: "deadline",
    title: "Estate inventory filing deadline",
    matterRef: "MT-2003",
    clientName: "Cruz estate",
    dueDate: dayOffset(2),
    priority: "High",
    status: "Upcoming",
    href: "/calendar",
  },
  {
    id: "atty-focus-4",
    kind: "task",
    title: "Client status email — case strategy",
    matterRef: "MT-2002",
    clientName: "Harbor Logistics",
    dueDate: dayOffset(0),
    priority: "High",
    status: "In Progress",
    href: "/tasks",
  },
  {
    id: "atty-focus-5",
    kind: "meeting",
    title: "Hearing prep call — Vale v. Northbound Motors",
    matterRef: "MT-2001",
    clientName: "Vale",
    dueDate: dayOffset(0),
    dueTime: "9:00 AM",
    priority: "Medium",
    status: "Scheduled",
    href: "/calendar",
  },
];
