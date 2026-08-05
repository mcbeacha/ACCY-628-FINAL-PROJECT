import { requireUser } from "@/lib/auth";
import { canViewProductivity } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { FormulaHelp } from "@/components/analytics/AnalyticsNotice";
import { EmptyState } from "@/components/EmptyState";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { formatCurrency } from "@/lib/format";
import { toCsv, csvHref } from "@/lib/csv";
import { redirect } from "next/navigation";

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewProductivity(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const from = sp.from || null;
  const to = sp.to || null;
  const bundle = computeAnalytics(raw, { from, to });
  const rows = bundle.attorneys;

  const csv = toCsv(
    rows.map((r) => ({
      name: r.fullName,
      role: r.role,
      available_weekly_hours: r.availableWeeklyHours,
      total_hours: r.totalHours.toFixed(2),
      approved_hours: r.approvedHours.toFixed(2),
      billable_hours: r.billableHours.toFixed(2),
      nonbillable_hours: r.nonbillableHours.toFixed(2),
      hours_billed: r.hoursBilled.toFixed(2),
      billable_value: r.billableValue.toFixed(2),
      invoiced_value: r.invoicedValue.toFixed(2),
      collected_value: r.collectedValue.toFixed(2),
      labor_cost: r.laborCost.toFixed(2),
      utilization_pct: r.utilization == null ? "N/A" : r.utilization.toFixed(1),
      billing_realization_pct: r.billingRealization == null ? "N/A" : r.billingRealization.toFixed(1),
      active_matters: r.assignedActiveMatters,
      open_tasks: r.openTasks,
      overdue_tasks: r.overdueTasks,
    }))
  );

  return (
    <>
      <PageHeader
        title="Attorney & Timekeeper Productivity"
        description="Hours, utilization, and value metrics. Not a performance ranker — every metric is labeled."
        actions={
          <a className="btn btn-sm btn-outline" href={csvHref(csv)} download="attorney-productivity.csv">
            Export CSV
          </a>
        }
      />
      <div className="flex flex-wrap gap-2">
        <FormulaHelp formulaKey="utilization" />
        <FormulaHelp formulaKey="billingRealization" />
        <FormulaHelp formulaKey="directLaborCost" />
      </div>
      <form className="flex flex-wrap gap-2 items-end">
        <input type="date" name="from" className="input input-bordered input-sm" defaultValue={sp.from || ""} />
        <input type="date" name="to" className="input input-bordered input-sm" defaultValue={sp.to || ""} />
        <button className="btn btn-sm btn-primary" type="submit">
          Apply period
        </button>
      </form>
      <p className="text-xs opacity-70 max-w-3xl">
        Utilization uses each employee&apos;s available weekly hours (default 40) × weeks in the
        selected period (or 4 weeks if no dates). Invoiced/collected value for attorneys attributes fee metrics of
        matters they lead as responsible attorney. Generated {new Date().toLocaleString()}.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No timekeeper profiles found." />
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Timekeeper</th>
                  <th>Role</th>
                  <th>Avail hrs/wk</th>
                  <th>Recorded</th>
                  <th>Approved</th>
                  <th>Billable</th>
                  <th>Nonbill</th>
                  <th>Billed hrs</th>
                  <th>Billable $</th>
                  <th>Invoiced $</th>
                  <th>Collected $</th>
                  <th>Labor cost</th>
                  <th>Util %</th>
                  <th>Bill real. %</th>
                  <th>Matters</th>
                  <th>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="font-medium">{r.fullName}</td>
                    <td className="text-xs">{r.role}</td>
                    <td>{r.availableWeeklyHours}</td>
                    <td>{r.totalHours.toFixed(1)}</td>
                    <td>{r.approvedHours.toFixed(1)}</td>
                    <td>{r.billableHours.toFixed(1)}</td>
                    <td>{r.nonbillableHours.toFixed(1)}</td>
                    <td>{r.hoursBilled.toFixed(1)}</td>
                    <td>{formatCurrency(r.billableValue)}</td>
                    <td>{formatCurrency(r.invoicedValue)}</td>
                    <td>{formatCurrency(r.collectedValue)}</td>
                    <td>{formatCurrency(r.laborCost)}</td>
                    <td>{r.utilization == null ? "—" : `${r.utilization.toFixed(1)}%`}</td>
                    <td>
                      {r.billingRealization == null ? "—" : `${r.billingRealization.toFixed(1)}%`}
                    </td>
                    <td>{r.assignedActiveMatters}</td>
                    <td className="text-xs">
                      {r.openTasks} open
                      {r.overdueTasks ? ` · ${r.overdueTasks} overdue` : ""}
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
