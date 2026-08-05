import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { SectionHeader } from "@/components/workspace/SectionHeader";
import { clientDisplayName, formatCurrency, formatDate } from "@/lib/format";
import {
  CLIENT_COMMUNICATIONS,
  CONFLICT_CHECKS,
  DOCUMENTS,
  MATTER_CONTACTS,
  MATTER_NOTES,
  PREFERRED_CONTACT_METHOD,
  relativeTime,
} from "@/lib/workspace-mock";
import type { Client, Matter } from "@/lib/types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_status: string;
  invoice_date: string | null;
  due_date: string | null;
  invoice_total: number | null;
  balance_due: number | null;
};

const CLOSED_STATUSES = ["Closed", "Canceled"];

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, supabase } = await requireUser();

  if (profile.role === "paralegal") {
    redirect("/dashboard");
  }

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  if (profile.role === "client" && client.portal_user_id !== profile.id) {
    notFound();
  }

  const { data: matters } = await supabase
    .from("matters")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const matterRows = (matters || []) as Matter[];
  const activeMatters = matterRows.filter((m) => !CLOSED_STATUSES.includes(m.matter_status));
  const closedMatters = matterRows.filter((m) => CLOSED_STATUSES.includes(m.matter_status));
  const c = client as Client;
  const isClientUser = profile.role === "client";

  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_status, invoice_date, due_date, invoice_total, balance_due")
    .eq("client_id", id)
    .order("invoice_date", { ascending: false });
  const invoices = (invoiceData || []) as InvoiceRow[];
  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.invoice_total ?? 0), 0);
  const outstanding = invoices.reduce((sum, i) => sum + Number(i.balance_due ?? 0), 0);
  const openInvoices = invoices.filter((i) => Number(i.balance_due ?? 0) > 0);

  return (
    <>
      <PageHeader
        title={clientDisplayName(c)}
        description={
          isClientUser
            ? "Your client profile (simplified view)."
            : `Client ${c.client_number} · ${c.client_type}`
        }
        actions={
          !isClientUser ? (
            <Link href={`/matters/new?client_id=${c.id}`} className="btn btn-primary btn-sm">
              New matter
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card bg-base-100 border border-base-300 shadow-sm lg:col-span-2">
          <div className="card-body">
            <h2 className="card-title text-base">Profile</h2>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="opacity-60">Client number</dt>
                <dd className="font-medium">{c.client_number}</dd>
              </div>
              <div>
                <dt className="opacity-60">Type</dt>
                <dd className="font-medium">{c.client_type}</dd>
              </div>
              {!isClientUser && (
                <div>
                  <dt className="opacity-60">Status</dt>
                  <dd>
                    <StatusBadge status={c.client_status} />
                  </dd>
                </div>
              )}
              <div>
                <dt className="opacity-60">Company or organization</dt>
                <dd className="font-medium">{c.organization_name || "—"}</dd>
              </div>
              <div>
                <dt className="opacity-60">Primary contact</dt>
                <dd className="font-medium">
                  {c.primary_contact_name ||
                    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="opacity-60">Email</dt>
                <dd className="font-medium">{c.email || "—"}</dd>
              </div>
              <div>
                <dt className="opacity-60">Phone</dt>
                <dd className="font-medium">{c.phone || "—"}</dd>
              </div>
              {!isClientUser && (
                <div>
                  <dt className="opacity-60">Billing email</dt>
                  <dd className="font-medium">{c.billing_email || "—"}</dd>
                </div>
              )}
              <div>
                <dt className="opacity-60">Preferred communication</dt>
                <dd className="font-medium">{PREFERRED_CONTACT_METHOD}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="opacity-60">Address</dt>
                <dd className="font-medium">
                  {[c.address_line_1, c.address_line_2, c.city, c.state, c.postal_code]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="opacity-60">Created</dt>
                <dd className="font-medium">{formatDate(c.created_at)}</dd>
              </div>
              <div>
                <dt className="opacity-60">Active matters</dt>
                <dd className="font-medium">{activeMatters.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Active matters</h2>
            {activeMatters.length === 0 ? (
              <EmptyState title="No active matters for this client." />
            ) : (
              <ul className="space-y-3">
                {activeMatters.map((m) => (
                  <li key={m.id} className="text-sm">
                    <Link href={`/matters/${m.id}`} className="link link-hover font-medium">
                      {m.matter_number} · {m.matter_name}
                    </Link>
                    <div className="mt-1">
                      <StatusBadge status={m.matter_status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {closedMatters.length > 0 && (
              <>
                <div className="divider my-2" />
                <h3 className="text-sm font-semibold">Closed matters</h3>
                <ul className="space-y-2 mt-1">
                  {closedMatters.map((m) => (
                    <li key={m.id} className="text-sm opacity-70">
                      <Link href={`/matters/${m.id}`} className="link link-hover">
                        {m.matter_number} · {m.matter_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {!isClientUser && (
        <>
          <SectionHeader
            title="Billing summary"
            description="Recorded invoices and balances for this client."
            action={
              <Link href="/ar" className="btn btn-outline btn-sm">
                Accounts receivable
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Invoices issued" value={invoices.length} />
            <StatCard label="Total invoiced" value={formatCurrency(totalInvoiced)} />
            <StatCard
              label="Outstanding balance"
              value={formatCurrency(outstanding)}
              tone={outstanding > 0 ? "warning" : "success"}
            />
            <StatCard label="Open invoices" value={openInvoices.length} />
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Outstanding invoices</h2>
              {openInvoices.length === 0 ? (
                <EmptyState
                  title="No outstanding invoices"
                  description="Every finalized invoice for this client has been paid or written off."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Issued</th>
                        <th>Due</th>
                        <th>Total</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover">
                          <td>
                            <Link href={`/invoices/${invoice.id}`} className="link link-hover">
                              {invoice.invoice_number}
                            </Link>
                          </td>
                          <td className="text-sm">{formatDate(invoice.invoice_date)}</td>
                          <td className="text-sm">{formatDate(invoice.due_date)}</td>
                          <td className="text-sm">{formatCurrency(invoice.invoice_total)}</td>
                          <td className="text-sm font-medium">
                            {formatCurrency(invoice.balance_due)}
                          </td>
                          <td>
                            <StatusBadge status={invoice.invoice_status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Recent communications</h2>
                <ul className="divide-y divide-base-200">
                  {CLIENT_COMMUNICATIONS.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 py-3">
                      <span className="badge badge-ghost badge-sm shrink-0">{entry.channel}</span>
                      <span className="min-w-0 flex-1 text-sm">{entry.summary}</span>
                      <span className="text-xs opacity-60 shrink-0">
                        {relativeTime(entry.minutesAgo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Documents</h2>
                <ul className="divide-y divide-base-200">
                  {DOCUMENTS.slice(0, 5).map((doc) => (
                    <li key={doc.id} className="flex items-start gap-3 py-3">
                      <span className="badge badge-ghost badge-sm shrink-0">{doc.fileType}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{doc.name}</span>
                        <span className="block text-xs opacity-60">
                          {doc.folder} · modified {formatDate(doc.modifiedOn)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href="/documents" className="link text-sm mt-2">
                  Open document library
                </Link>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Notes</h2>
                <ul className="space-y-3">
                  {MATTER_NOTES.map((note) => (
                    <li key={note.id} className="rounded-box border border-base-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{note.author}</span>
                        <span className="text-xs opacity-60">{formatDate(note.date)}</span>
                      </div>
                      <p className="text-sm opacity-80 mt-1">{note.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Conflict-check history</h2>
                <div className="table-wrap">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Run</th>
                        <th>By</th>
                        <th>Scope</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CONFLICT_CHECKS.map((check) => (
                        <tr key={check.id}>
                          <td className="text-sm">{formatDate(check.runOn)}</td>
                          <td className="text-sm">{check.performedBy}</td>
                          <td className="text-sm">{check.scope}</td>
                          <td>
                            <span className="badge badge-ghost badge-sm">{check.result}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Related contacts</h2>
              <div className="table-wrap">
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

          <p className="text-xs opacity-60">
            Communications, documents, notes, conflict-check history, and related contacts are
            fictional placeholders until those records are added to the schema.
          </p>
        </>
      )}
    </>
  );
}
