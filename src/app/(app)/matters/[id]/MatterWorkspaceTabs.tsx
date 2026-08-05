"use client";

import { EmptyState } from "@/components/EmptyState";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { SectionHeader } from "@/components/workspace/SectionHeader";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CALENDAR_EVENTS,
  COURT_FILINGS,
  DOCUMENTS,
  MATTER_CONTACTS,
  MATTER_EMAILS,
  MATTER_NOTES,
  MATTER_PROFILE,
  MATTER_TIMELINE,
  daysUntil,
  relativeTime,
  type TimelineEntryType,
} from "@/lib/workspace-mock";
import Link from "next/link";
import { useState } from "react";

/** Tabs in this component are backed by workspace fixtures, not Supabase. */
export const MOCK_MATTER_TABS = [
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
  { id: "calendar", label: "Calendar" },
  { id: "billing", label: "Billing" },
  { id: "notes", label: "Notes" },
  { id: "research", label: "Research" },
  { id: "emails", label: "Emails" },
  { id: "contacts", label: "Contacts" },
  { id: "filings", label: "Court Filings" },
] as const;

const TIMELINE_TYPES: TimelineEntryType[] = [
  "Matter Opened",
  "Communication",
  "Document",
  "Court Filing",
  "Hearing",
  "Deposition",
  "Deadline",
  "Note",
  "Status Change",
];

const SAVED_RESEARCH = [
  {
    id: "res-1",
    title: "Ashcroft Freight Co. v. Beltline Carriers",
    citation: "318 So. 3d 442 (Miss. 2024)",
    note: "Supports our reading of the limitation of liability clause.",
  },
  {
    id: "res-2",
    title: "Restatement (Second) of Contracts § 351",
    citation: "Consequential damages — foreseeability",
    note: "Cited in section III of the summary judgment response.",
  },
  {
    id: "res-3",
    title: "Delta Grain Handlers v. Rivermark Logistics",
    citation: "2025 WL 118842 (N.D. Miss.)",
    note: "Adverse authority; distinguish on the notice provision.",
  },
];

export function MatterCaseDetails() {
  const upcoming = CALENDAR_EVENTS.filter((e) => daysUntil(e.date) >= 0).slice(0, 3);

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm lg:col-span-2">
      <div className="card-body">
        <h2 className="card-title text-base">Case details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="opacity-60">Matter type</dt>
            <dd className="font-medium">{MATTER_PROFILE.matterType}</dd>
          </div>
          <div>
            <dt className="opacity-60">Priority</dt>
            <dd>
              <PriorityBadge priority={MATTER_PROFILE.priority} />
            </dd>
          </div>
          <div>
            <dt className="opacity-60">Court</dt>
            <dd className="font-medium">{MATTER_PROFILE.court}</dd>
          </div>
          <div>
            <dt className="opacity-60">Judge</dt>
            <dd className="font-medium">{MATTER_PROFILE.judge}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="opacity-60">Opposing counsel</dt>
            <dd className="font-medium">{MATTER_PROFILE.opposingCounsel}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="opacity-60">Case summary</dt>
            <dd className="mt-1">{MATTER_PROFILE.caseSummary}</dd>
          </div>
        </dl>

        <div className="divider my-2" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold mb-2">Upcoming events</h3>
            <ul className="space-y-2 text-sm">
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{event.title}</span>
                    <span className="block text-xs opacity-60">
                      {formatDate(event.date)} · {event.startTime}
                    </span>
                  </span>
                  <span className="badge badge-ghost badge-sm shrink-0">{event.type}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Key contacts</h3>
            <ul className="space-y-2 text-sm">
              {MATTER_CONTACTS.slice(0, 3).map((contact) => (
                <li key={contact.id}>
                  <span className="block font-medium">{contact.name}</span>
                  <span className="block text-xs opacity-60">
                    {contact.role} · {contact.organization}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs opacity-60 mt-3">
          Court, judge, opposing counsel, and event details are fictional placeholders until those
          fields are added to the matter record.
        </p>
      </div>
    </div>
  );
}

export function MatterWorkspaceTabs({ tab }: { tab: string }) {
  const [timelineFilter, setTimelineFilter] = useState<TimelineEntryType | "All">("All");

  if (tab === "documents") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Matter documents"
            description="Pleadings, exhibits, correspondence, and drafts."
            action={
              <Link href="/documents" className="btn btn-outline btn-sm">
                Open document library
              </Link>
            }
          />
          <div className="table-wrap mt-2">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Folder</th>
                  <th>Uploaded by</th>
                  <th>Modified</th>
                  <th>Version</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENTS.slice(0, 6).map((doc) => (
                  <tr key={doc.id} className="hover">
                    <td className="font-medium">{doc.name}</td>
                    <td className="text-sm">{doc.folder}</td>
                    <td className="text-sm">{doc.uploadedBy}</td>
                    <td className="text-sm">{formatDate(doc.modifiedOn)}</td>
                    <td className="text-sm">v{doc.version}</td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "timeline") {
    const entries = [...MATTER_TIMELINE]
      .filter((entry) => timelineFilter === "All" || entry.type === timelineFilter)
      .sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Matter timeline"
            description="Chronological history of everything that happened on this matter."
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className={`btn btn-xs normal-case ${timelineFilter === "All" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setTimelineFilter("All")}
            >
              All
            </button>
            {TIMELINE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`btn btn-xs normal-case ${timelineFilter === type ? "btn-primary" : "btn-outline"}`}
                onClick={() => setTimelineFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>

          {entries.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No timeline entries of this type"
                description="Choose a different activity type to see more history."
              />
            </div>
          ) : (
            <ul className="timeline timeline-vertical timeline-compact mt-4">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <div className="timeline-start text-xs opacity-60">{formatDate(entry.date)}</div>
                  <div className="timeline-middle">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                  </div>
                  <div className="timeline-end timeline-box mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{entry.title}</span>
                      <span className="badge badge-ghost badge-sm">{entry.type}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-1">{entry.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (tab === "calendar") {
    const events = [...CALENDAR_EVENTS].sort((a, b) => a.date.localeCompare(b.date));
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Matter calendar"
            description="Hearings, depositions, meetings, and filing deadlines."
            action={
              <Link href="/calendar" className="btn btn-outline btn-sm">
                Open full calendar
              </Link>
            }
          />
          <ul className="divide-y divide-base-200 mt-2">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start gap-3 py-3">
                <span className="w-32 shrink-0 text-sm opacity-70">{formatDate(event.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-sm">{event.title}</span>
                  <span className="block text-xs opacity-60">
                    {event.startTime} · {event.location}
                  </span>
                </span>
                <span className="badge badge-ghost badge-sm">{event.type}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (tab === "billing") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Billing snapshot"
            description="Illustrative figures. Recorded invoices and payments live in the billing module."
            action={
              <Link href="/invoices" className="btn btn-outline btn-sm">
                View invoices
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mt-2">
            <BillingMetric label="Billed to date" value={formatCurrency(184_250)} />
            <BillingMetric label="Collected" value={formatCurrency(151_900)} />
            <BillingMetric label="Outstanding balance" value={formatCurrency(32_350)} />
            <BillingMetric label="Unbilled work in progress" value={formatCurrency(18_740)} />
          </div>
        </div>
      </div>
    );
  }

  if (tab === "notes") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader title="Matter notes" description="Internal notes from the matter team." />
          <ul className="space-y-3 mt-2">
            {MATTER_NOTES.map((note) => (
              <li key={note.id} className="rounded-box border border-base-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{note.author}</span>
                  <span className="text-xs opacity-60">{formatDate(note.date)}</span>
                </div>
                <p className="text-sm opacity-80 mt-1">{note.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (tab === "research") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Saved research"
            description="Authority saved to this matter."
            action={
              <Link href="/research" className="btn btn-outline btn-sm">
                Open legal research
              </Link>
            }
          />
          <ul className="space-y-3 mt-2">
            {SAVED_RESEARCH.map((item) => (
              <li key={item.id} className="rounded-box border border-base-200 p-3">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs opacity-60">{item.citation}</p>
                <p className="text-sm opacity-80 mt-1">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (tab === "emails") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Matter correspondence"
            description="Email threads linked to this matter."
            action={
              <Link href="/messages" className="btn btn-outline btn-sm">
                Open messages
              </Link>
            }
          />
          <ul className="divide-y divide-base-200 mt-2">
            {MATTER_EMAILS.map((email) => (
              <li key={email.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{email.subject}</span>
                  <span className="text-xs opacity-60">{relativeTime(email.minutesAgo)}</span>
                </div>
                <p className="text-xs opacity-60 mt-0.5">
                  {email.from} → {email.to}
                </p>
                <p className="text-sm opacity-80 mt-1">{email.preview}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (tab === "contacts") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Matter contacts"
            description="Everyone connected to this matter outside the firm."
          />
          <div className="table-wrap mt-2">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {MATTER_CONTACTS.map((contact) => (
                  <tr key={contact.id} className="hover">
                    <td className="font-medium">{contact.name}</td>
                    <td className="text-sm">{contact.role}</td>
                    <td className="text-sm">{contact.organization}</td>
                    <td className="text-sm">
                      <a href={`mailto:${contact.email}`} className="link link-hover">
                        {contact.email}
                      </a>
                    </td>
                    <td className="text-sm">{contact.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "filings") {
    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Court filings"
            description="Docket history for this matter."
          />
          <div className="table-wrap mt-2">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Filing</th>
                  <th>Docket</th>
                  <th>Court</th>
                  <th>Filed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {COURT_FILINGS.map((filing) => (
                  <tr key={filing.id} className="hover">
                    <td className="font-medium">{filing.title}</td>
                    <td className="text-sm">{filing.docket}</td>
                    <td className="text-sm">{filing.court}</td>
                    <td className="text-sm">{formatDate(filing.filedOn)}</td>
                    <td>
                      <StatusBadge status={filing.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-box border border-base-300 p-4">
      <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
