import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/Badges";
import { SwitchDemoClientButton } from "@/components/client-portal/SwitchDemoClientButton";
import { RoleCalendarPreview } from "@/components/workspace/RoleCalendarPreview";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import {
  clientFacingInvoiceStatus,
  requireCurrentClientPortal,
} from "@/lib/client-portal-data";
import { clientDisplayName, formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";

export default async function ClientPortalDashboardPage() {
  const bundle = await requireCurrentClientPortal();
  const { client, matters, invoices, payments, retainers, tasks, paralegal } = bundle;

  const activeMatters = matters.filter((m) => m.matter_status === "Active");
  const openBalance = invoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const retainerBalance = retainers.reduce((s, r) => s + Number(r.current_balance), 0);
  const openInvoices = invoices.filter((i) => Number(i.balance_due) > 0);
  const nextDue = [...openInvoices].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const upcomingMilestones = tasks.filter(
    (t) => !["Completed", "Canceled"].includes(t.task_status)
  );
  const lead =
    activeMatters[0]?.responsible ||
    matters[0]?.responsible ||
    null;

  return (
    <>
      <PageHeader
        title="Client Dashboard"
        description={`Welcome back, ${clientDisplayName(client)}. Review your matters, invoices, payments, and upcoming milestones below.`}
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">Client account</p>
            <h2 className="font-display text-2xl font-semibold">{clientDisplayName(client)}</h2>
            <p className="text-sm opacity-70 mt-1">
              {client.client_number}
              {lead ? ` · Lead attorney: ${lead.full_name}` : ""}
              {paralegal ? ` · Client contact: ${paralegal.full_name}` : ""}
            </p>
          </div>
          <SwitchDemoClientButton
            target="potential_client"
            className="btn btn-ghost btn-sm"
          >
            Not a Current Client? Explore Rebel Law Group
          </SwitchDemoClientButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {openBalance > 0 ? (
          <Link href="/client-portal/pay" className="btn btn-primary">
            Pay Outstanding Balance ({formatCurrency(openBalance)})
          </Link>
        ) : (
          <Link href="/client-portal/payments" className="btn btn-primary">
            View Payment History
          </Link>
        )}
        <Link href="/client-portal/invoices" className="btn btn-outline">
          View My Invoices
        </Link>
        <Link href="/client-portal/matters" className="btn btn-outline">
          View My Matters
        </Link>
        <Link href="/calendar" className="btn btn-outline">
          My Calendar
        </Link>
        <Link href="/client-portal/retainers" className="btn btn-outline">
          Review Retainer Activity
        </Link>
        <Link href="/client-portal/contact" className="btn btn-outline">
          Contact My Legal Team
        </Link>
      </div>

      <RoleCalendarPreview role="client" title="My upcoming dates" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active matters" value={activeMatters.length} href="/client-portal/matters" />
        <StatCard
          label="Balance due"
          value={formatCurrency(openBalance)}
          tone={openBalance > 0 ? "warning" : "success"}
          href="/client-portal/invoices"
        />
        <StatCard
          label="Next payment due"
          value={nextDue ? formatDate(nextDue.due_date) : "—"}
          href="/client-portal/pay"
        />
        <StatCard
          label="Retainer balance"
          value={formatCurrency(retainerBalance)}
          href="/client-portal/retainers"
        />
        <StatCard
          label="Upcoming milestones"
          value={upcomingMilestones.length}
          href="/client-portal/milestones"
        />
        <StatCard
          label="Payments on file"
          value={payments.length}
          href="/client-portal/payments"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-base">Recent invoices</h2>
              <Link href="/client-portal/invoices" className="link text-sm">
                All invoices
              </Link>
            </div>
            <ul className="space-y-2">
              {invoices.slice(0, 5).map((inv) => (
                <li key={inv.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <Link href={`/client-portal/invoices/${inv.id}`} className="link link-hover font-medium">
                    {inv.invoice_number}
                  </Link>
                  <span className="opacity-70">{formatCurrency(Number(inv.balance_due))}</span>
                  <StatusBadge status={clientFacingInvoiceStatus(inv)} />
                </li>
              ))}
              {!invoices.length && <li className="text-sm opacity-60">No finalized invoices yet.</li>}
            </ul>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-base">Active matters</h2>
              <Link href="/client-portal/matters" className="link text-sm">
                All matters
              </Link>
            </div>
            <ul className="space-y-2">
              {activeMatters.slice(0, 5).map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <Link href={`/client-portal/matters/${m.id}`} className="link link-hover font-medium">
                    {m.matter_name}
                  </Link>
                  <StatusBadge status={m.matter_status} />
                </li>
              ))}
              {!activeMatters.length && (
                <li className="text-sm opacity-60">No active matters right now.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
