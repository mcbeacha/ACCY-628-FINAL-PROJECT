import { requireUser } from "@/lib/auth";
import { canViewProfitability } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { FormulaHelp } from "@/components/analytics/AnalyticsNotice";
import { EmptyState } from "@/components/EmptyState";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { formatMargin } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { toCsv, csvHref } from "@/lib/csv";
import { redirect } from "next/navigation";

export default async function PracticeProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewProfitability(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw, { from: sp.from, to: sp.to });
  const rows = bundle.practices;

  const csv = toCsv(
    rows.map((r) => ({
      practice_area: r.practiceArea,
      matters: r.matterCount,
      hours: r.totalHours.toFixed(2),
      invoiced: r.invoicedRevenue.toFixed(2),
      collected: r.collectedRevenue.toFixed(2),
      labor: r.laborCost.toFixed(2),
      expenses: r.directExpense.toFixed(2),
      gross_profit: r.grossProfit.toFixed(2),
      margin: r.grossMargin == null ? "N/A" : r.grossMargin.toFixed(1),
      avg_matter_value: r.avgMatterValue.toFixed(2),
      avg_days_to_pay: r.avgDaysToPay == null ? "" : r.avgDaysToPay.toFixed(1),
      write_down_pct: r.writeDownPct == null ? "" : r.writeDownPct.toFixed(1),
      write_off_pct: r.writeOffPct == null ? "" : r.writeOffPct.toFixed(1),
    }))
  );

  return (
    <>
      <PageHeader
        title="Practice-Area Profitability"
        description="Compare practice areas using the same documented revenue and cost definitions."
        actions={
          <a className="btn btn-sm btn-outline" href={csvHref(csv)} download="practice-area-profitability.csv">
            Export CSV
          </a>
        }
      />
      <div className="flex gap-2">
        <FormulaHelp formulaKey="grossProfit" />
        <FormulaHelp formulaKey="collectionRate" />
      </div>
      <form className="flex flex-wrap gap-2 items-end">
        <input type="date" name="from" className="input input-bordered input-sm" defaultValue={sp.from || ""} />
        <input type="date" name="to" className="input input-bordered input-sm" defaultValue={sp.to || ""} />
        <button className="btn btn-sm btn-primary" type="submit">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No practice-area data." />
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Practice area</th>
                  <th>Matters</th>
                  <th>Hours</th>
                  <th>Invoiced</th>
                  <th>Collected</th>
                  <th>Labor</th>
                  <th>Expenses</th>
                  <th>GP</th>
                  <th>Margin</th>
                  <th>Avg matter $</th>
                  <th>Avg days pay</th>
                  <th>WD %</th>
                  <th>WO %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.practiceArea}>
                    <td className="font-medium">{r.practiceArea}</td>
                    <td>{r.matterCount}</td>
                    <td>{r.totalHours.toFixed(1)}</td>
                    <td>{formatCurrency(r.invoicedRevenue)}</td>
                    <td>{formatCurrency(r.collectedRevenue)}</td>
                    <td>{formatCurrency(r.laborCost)}</td>
                    <td>{formatCurrency(r.directExpense)}</td>
                    <td className="font-medium">{formatCurrency(r.grossProfit)}</td>
                    <td>{formatMargin(r.grossMargin)}</td>
                    <td>{formatCurrency(r.avgMatterValue)}</td>
                    <td>{r.avgDaysToPay == null ? "—" : r.avgDaysToPay.toFixed(1)}</td>
                    <td>{r.writeDownPct == null ? "—" : `${r.writeDownPct.toFixed(1)}%`}</td>
                    <td>{r.writeOffPct == null ? "—" : `${r.writeOffPct.toFixed(1)}%`}</td>
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
