import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/Badges";
import { RoleCalendarPreview } from "@/components/workspace/RoleCalendarPreview";
import { SectionHeader } from "@/components/workspace/SectionHeader";
import {
  clientFacingInvoiceStatus,
  requireCurrentClientPortal,
} from "@/lib/client-portal-data";
import { clientDisplayName, formatCurrency, formatDate } from "@/lib/format";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";

export default async function ClientPortalDashboardPage() {
  const bundle = await requireCurrentClientPortal();
  const { client, matters, invoices, payments, retainers, tasks } = bundle;

  const activeMatters = matters.filter((m) => m.matter_status === "Active");
  const openBalance = invoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const retainerBalance = retainers.reduce((s, r) => s + Number(r.current_balance), 0);
  const openInvoices = invoices.filter((i) => Number(i.balance_due) > 0);
  const nextDue = [...openInvoices].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const upcomingMilestones = tasks.filter(
    (t) => !["Completed", "Canceled"].includes(t.task_status)
  );

  return (
    <>
      <PageHeader
        title="Client Workspace"
        description={clientDisplayName(client)}
        actions={
          <>
            <RoleCalendarPreview role="client" />
            {openBalance > 0 ? (
              <Link href="/client-portal/pay" className="btn btn-primary btn-sm">
                Pay {formatCurrency(openBalance)}
              </Link>
            ) : (
              <Link href="/client-portal/payments" className="btn btn-outline btn-sm">
                Payments
              </Link>
            )}
          </>
        }
      />

      <section className="space-y-3">
        <SectionHeader
          title="Quick actions"
          icon={<LayoutGrid className="h-5 w-5" />}
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/client-portal/matters" className="btn btn-outline btn-sm">
            Matters
          </Link>
          <Link href="/client-portal/invoices" className="btn btn-outline btn-sm">
            Invoices
          </Link>
          <Link href="/client-portal/retainers" className="btn btn-outline btn-sm">
            Retainers
          </Link>
          <Link href="/client-portal/milestones" className="btn btn-outline btn-sm">
            Milestones
          </Link>
          <Link href="/client-portal/contact" className="btn btn-outline btn-sm">
            Contact team
          </Link>
        </div>
      </section>

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
          label="Milestones"
          value={upcomingMilestones.length}
          href="/client-portal/milestones"
        />
        <StatCard
          label="Payments"
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
                View all
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
              {!invoices.length && <li className="text-sm opacity-60">No invoices yet.</li>}
            </ul>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-base">Active matters</h2>
              <Link href="/client-portal/matters" className="link text-sm">
                View all
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
                <li className="text-sm opacity-60">No active matters.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
