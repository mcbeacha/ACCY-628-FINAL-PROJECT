import { requireUser } from "@/lib/auth";
import { canViewProfitability } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsNotice, FormulaHelp } from "@/components/analytics/AnalyticsNotice";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { formatMargin } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { toCsv, csvHref } from "@/lib/csv";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClientProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewProfitability(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw, { from: sp.from, to: sp.to });
  const rows = bundle.clients;

  const csv = toCsv(
    rows.map((r) => ({
      client: r.clientName,
      active_matters: r.activeMatters,
      invoiced: r.invoicedRevenue.toFixed(2),
      collected: r.collectedRevenue.toFixed(2),
      outstanding_ar: r.outstandingAR.toFixed(2),
      past_due: r.pastDueAR.toFixed(2),
      labor_cost: r.directLaborCost.toFixed(2),
      expenses: r.directExpense.toFixed(2),
      gross_profit: r.grossProfit.toFixed(2),
      margin: r.grossMargin == null ? "N/A" : r.grossMargin.toFixed(1),
      write_downs: r.writeDowns.toFixed(2),
      write_offs: r.writeOffs.toFixed(2),
      avg_days_to_pay: r.avgDaysToPay == null ? "" : r.avgDaysToPay.toFixed(1),
      retainer: r.retainerBalance.toFixed(2),
      profit_status: r.profitStatus,
    }))
  );

  return (
    <>
      <PageHeader
        title="Client Profitability"
        description="Aggregated performance across each client’s matters."
        actions={
          <a className="btn btn-sm btn-outline" href={csvHref(csv)} download="client-profitability.csv">
            Export CSV
          </a>
        }
      />
      <AnalyticsNotice />
      <div className="flex flex-wrap gap-2">
        <FormulaHelp formulaKey="avgDaysToPay" />
        <FormulaHelp formulaKey="grossMargin" />
      </div>
      <form className="flex flex-wrap gap-2 items-end">
        <input type="date" name="from" className="input input-bordered input-sm" defaultValue={sp.from || ""} />
        <input type="date" name="to" className="input input-bordered input-sm" defaultValue={sp.to || ""} />
        <button className="btn btn-sm btn-primary" type="submit">
          Filter
        </button>
      </form>
      <p className="text-xs opacity-60">
        Avg days to pay uses latest posted payment date − invoice date (invoice-date filter basis when applied).
        Report date: {new Date().toLocaleString()}.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No client profitability rows." />
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Active matters</th>
                  <th>Invoiced</th>
                  <th>Collected</th>
                  <th>AR</th>
                  <th>Past due</th>
                  <th>Labor</th>
                  <th>Expenses</th>
                  <th>GP</th>
                  <th>Margin</th>
                  <th>WD / WO</th>
                  <th>Days to pay</th>
                  <th>Retainer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.clientId}>
                    <td>
                      <Link href={`/clients/${r.clientId}`} className="link link-hover font-medium">
                        {r.clientName}
                      </Link>
                    </td>
                    <td>{r.activeMatters}</td>
                    <td>{formatCurrency(r.invoicedRevenue)}</td>
                    <td>{formatCurrency(r.collectedRevenue)}</td>
                    <td>{formatCurrency(r.outstandingAR)}</td>
                    <td>{formatCurrency(r.pastDueAR)}</td>
                    <td>{formatCurrency(r.directLaborCost)}</td>
                    <td>{formatCurrency(r.directExpense)}</td>
                    <td className="font-medium">{formatCurrency(r.grossProfit)}</td>
                    <td>{formatMargin(r.grossMargin)}</td>
                    <td className="text-xs">
                      {formatCurrency(r.writeDowns)} / {formatCurrency(r.writeOffs)}
                    </td>
                    <td>{r.avgDaysToPay == null ? "—" : r.avgDaysToPay.toFixed(1)}</td>
                    <td>{formatCurrency(r.retainerBalance)}</td>
                    <td>
                      <StatusBadge status={r.profitStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
