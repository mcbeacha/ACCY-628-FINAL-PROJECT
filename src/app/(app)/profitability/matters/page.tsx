import { requireUser } from "@/lib/auth";
import { canViewProfitability } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsNotice, FormulaHelp } from "@/components/analytics/AnalyticsNotice";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { formatMargin } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { toCsv, csvHref } from "@/lib/csv";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MatterProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewProfitability(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw, { from: sp.from, to: sp.to });
  let rows = bundle.matters;

  if (sp.client) rows = rows.filter((r) => r.clientId === sp.client);
  if (sp.practice) rows = rows.filter((r) => r.practiceArea === sp.practice);
  if (sp.attorney) rows = rows.filter((r) => r.responsibleId === sp.attorney);
  if (sp.method) rows = rows.filter((r) => r.billingMethod === sp.method);
  if (sp.status) rows = rows.filter((r) => r.matterStatus === sp.status);
  if (sp.profit) rows = rows.filter((r) => r.profitStatus === sp.profit);

  const csv = toCsv(
    rows.map((r) => ({
      matter_number: r.matterNumber,
      matter_name: r.matterName,
      client: r.clientName,
      practice_area: r.practiceArea,
      responsible_attorney: r.responsibleName,
      billing_method: r.billingMethod,
      matter_status: r.matterStatus,
      approved_hours: r.approvedHours.toFixed(2),
      billable_value: r.billableValue.toFixed(2),
      invoiced_revenue: r.invoicedRevenue.toFixed(2),
      collected_revenue: r.collectedRevenue.toFixed(2),
      direct_labor_cost: r.directLaborCost.toFixed(2),
      direct_expenses: r.directExpense.toFixed(2),
      gross_profit: r.grossProfit.toFixed(2),
      gross_margin_pct: r.grossMargin == null ? "N/A" : r.grossMargin.toFixed(1),
      cash_profit: r.cashProfit.toFixed(2),
      outstanding_ar: r.outstandingAR.toFixed(2),
      write_downs: r.writeDowns.toFixed(2),
      write_offs: r.writeOffs.toFixed(2),
      retainer_balance: r.retainerBalance.toFixed(2),
      budget: r.budget ?? "",
      budget_variance: r.budgetVariance ?? "",
      profit_status: r.profitStatus,
    }))
  );

  const practices = [...new Set(bundle.matters.map((m) => m.practiceArea))];
  const methods = [...new Set(bundle.matters.map((m) => m.billingMethod))];
  const attys = bundle.attorneys.filter((a) => a.role === "attorney" || a.role === "managing_partner");
  const activeFilterCount = [
    sp.from,
    sp.to,
    sp.practice,
    sp.method,
    sp.attorney,
    sp.profit,
    sp.status,
  ].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Matter Profitability"
        description="Accrual-style revenue vs labor cost and expenses by matter. Generated for management simulation."
        actions={
          <a className="btn btn-sm btn-outline" href={csvHref(csv)} download="matter-profitability.csv">
            Export CSV
          </a>
        }
      />
      <AnalyticsNotice />
      <div className="flex flex-wrap gap-2 text-xs opacity-80">
        <FormulaHelp formulaKey="matterRevenue" label="Revenue" />
        <FormulaHelp formulaKey="collectedRevenue" label="Collected" />
        <FormulaHelp formulaKey="directLaborCost" label="Labor cost" />
        <FormulaHelp formulaKey="grossProfit" label="Gross profit" />
        <FormulaHelp formulaKey="grossMargin" label="Margin" />
        <FormulaHelp formulaKey="cashProfit" label="Cash profit" />
        <FormulaHelp formulaKey="budgetVariance" label="Budget" />
      </div>

      <form>
        <FilterToolbar
          actions={
            <>
              <button className="btn btn-sm btn-primary" type="submit">
                Apply
              </button>
              <Link href="/profitability/matters" className="btn btn-sm btn-ghost">
                Clear
              </Link>
            </>
          }
          hint={
            activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active · ${rows.length} shown`
              : undefined
          }
        >
          <FilterField label="From" className="w-full sm:w-40">
            <input
              type="date"
              name="from"
              className="input input-bordered input-sm"
              defaultValue={sp.from || ""}
            />
          </FilterField>
          <FilterField label="To" className="w-full sm:w-40">
            <input
              type="date"
              name="to"
              className="input input-bordered input-sm"
              defaultValue={sp.to || ""}
            />
          </FilterField>
          <FilterField label="Practice" className="w-full sm:w-44">
            <select name="practice" className="select select-bordered select-sm" defaultValue={sp.practice || ""}>
              <option value="">All</option>
              {practices.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Billing method" className="w-full sm:w-40">
            <select name="method" className="select select-bordered select-sm" defaultValue={sp.method || ""}>
              <option value="">All</option>
              {methods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Attorney" className="w-full sm:w-44">
            <select name="attorney" className="select select-bordered select-sm" defaultValue={sp.attorney || ""}>
              <option value="">All</option>
              {attys.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Profit status" className="w-full sm:w-40">
            <select name="profit" className="select select-bordered select-sm" defaultValue={sp.profit || ""}>
              <option value="">All</option>
              {["Strong", "Acceptable", "Low Margin", "Loss", "Insufficient Data"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Matter status" className="w-full sm:w-36">
            <input
              name="status"
              className="input input-bordered input-sm"
              defaultValue={sp.status || ""}
              placeholder="Active"
            />
          </FilterField>
        </FilterToolbar>
      </form>

      <p className="text-xs opacity-60">
        Thresholds: Strong ≥40% margin · Acceptable 20–40% · Low Margin 0–20% · Loss &lt;0 · Insufficient Data when no
        activity. Generated {new Date().toLocaleString()}.
      </p>

      {rows.length === 0 ? (
        <EmptyState title="No matters match these filters." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Matter</th>
                  <th>Client</th>
                  <th>Practice</th>
                  <th>Attorney</th>
                  <th>Method</th>
                  <th>Hrs</th>
                  <th>Billable $</th>
                  <th>Invoiced</th>
                  <th>Collected</th>
                  <th>Labor</th>
                  <th>Exp</th>
                  <th>GP</th>
                  <th>Margin</th>
                  <th>AR</th>
                  <th>Budget</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.matterId} className="hover">
                    <td>
                      <Link href={`/matters/${r.matterId}`} className="link link-hover font-medium">
                        {r.matterNumber}
                      </Link>
                      <div className="text-[10px] opacity-60 max-w-[8rem] truncate">{r.matterName}</div>
                    </td>
                    <td className="text-xs">
                      <Link href={`/clients/${r.clientId}`} className="link link-hover">
                        {r.clientName}
                      </Link>
                    </td>
                    <td className="text-xs">{r.practiceArea}</td>
                    <td className="text-xs">{r.responsibleName}</td>
                    <td className="text-xs">{r.billingMethod}</td>
                    <td>{r.approvedHours.toFixed(1)}</td>
                    <td>{formatCurrency(r.billableValue)}</td>
                    <td>{formatCurrency(r.invoicedRevenue)}</td>
                    <td>{formatCurrency(r.collectedRevenue)}</td>
                    <td>{formatCurrency(r.directLaborCost)}</td>
                    <td>{formatCurrency(r.directExpense)}</td>
                    <td className="font-medium">{formatCurrency(r.grossProfit)}</td>
                    <td>{formatMargin(r.grossMargin)}</td>
                    <td>{formatCurrency(r.outstandingAR)}</td>
                    <td className="text-xs">
                      {r.budgetFlag}
                      {r.budgetVariance != null && (
                        <div className="opacity-60">{formatCurrency(r.budgetVariance)}</div>
                      )}
                    </td>
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
