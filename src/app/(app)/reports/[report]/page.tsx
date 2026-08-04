/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsNotice } from "@/components/analytics/AnalyticsNotice";
import { EmptyState } from "@/components/EmptyState";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { arBucket, n } from "@/lib/analytics";
import { formatCurrency, formatDate, clientDisplayName } from "@/lib/format";
import { toCsv, csvHref } from "@/lib/csv";
import { calcBillableAmount } from "@/lib/phase2-types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const TITLES: Record<string, string> = {
  "matter-profitability": "Matter Profitability Report",
  "client-profitability": "Client Profitability Report",
  "practice-area": "Practice Area Profitability Report",
  "attorney-productivity": "Attorney Productivity Report",
  "time-entries": "Time Entry Report",
  expenses: "Expense Report",
  "invoice-register": "Invoice Register",
  "ar-aging": "Accounts Receivable Aging Report",
  "payment-register": "Payment Register",
  "retainer-ledger": "Retainer Ledger Report",
  "journal-entries": "Journal Entry Report",
  "write-downs-offs": "Write-Down and Write-Off Report",
  unbilled: "Unbilled Activity Report",
  "budget-variance": "Matter Budget Variance Report",
};

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { report } = await params;
  const sp = await searchParams;
  if (!TITLES[report]) notFound();

  const { profile, supabase } = await requireUser();
  if (!canViewReports(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw, { from: sp.from, to: sp.to });
  const generated = new Date().toLocaleString();

  // Optional audit of sensitive report views
  try {
    if (sp.export === "1") {
      await supabase.from("financial_activity").insert({
        action_type: "report_export",
        record_type: "report",
        record_id: null,
        matter_id: null,
        action_description: `Report export requested: ${TITLES[report]}`,
        performed_by: profile.id,
      });
    }
  } catch {
    /* non-blocking */
  }

  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let csvRows: Record<string, unknown>[] = [];
  let totalsNote = "";

  const from = sp.from;
  const to = sp.to;
  const inRange = (d: string | null | undefined) => {
    if (!d) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  if (report === "matter-profitability") {
    tableHeaders = ["Matter", "Client", "Invoiced", "Collected", "Labor", "Exp", "GP", "Margin", "Status"];
    csvRows = bundle.matters.map((r) => ({
      matter: r.matterNumber,
      client: r.clientName,
      invoiced: r.invoicedRevenue,
      collected: r.collectedRevenue,
      labor: r.directLaborCost,
      expenses: r.directExpense,
      gp: r.grossProfit,
      margin: r.grossMargin,
      status: r.profitStatus,
    }));
    tableRows = bundle.matters.map((r) => [
      r.matterNumber,
      r.clientName,
      formatCurrency(r.invoicedRevenue),
      formatCurrency(r.collectedRevenue),
      formatCurrency(r.directLaborCost),
      formatCurrency(r.directExpense),
      formatCurrency(r.grossProfit),
      r.grossMargin == null ? "N/A" : `${r.grossMargin.toFixed(1)}%`,
      r.profitStatus,
    ]);
    totalsNote = `Matters: ${bundle.matters.length} · Total GP: ${formatCurrency(bundle.matters.reduce((s, m) => s + m.grossProfit, 0))}`;
  } else if (report === "client-profitability") {
    tableHeaders = ["Client", "Invoiced", "Collected", "AR", "GP", "Margin", "Days to pay"];
    csvRows = bundle.clients.map((r) => ({
      client: r.clientName,
      invoiced: r.invoicedRevenue,
      collected: r.collectedRevenue,
      ar: r.outstandingAR,
      gp: r.grossProfit,
      margin: r.grossMargin,
      days_to_pay: r.avgDaysToPay,
    }));
    tableRows = bundle.clients.map((r) => [
      r.clientName,
      formatCurrency(r.invoicedRevenue),
      formatCurrency(r.collectedRevenue),
      formatCurrency(r.outstandingAR),
      formatCurrency(r.grossProfit),
      r.grossMargin == null ? "N/A" : `${r.grossMargin.toFixed(1)}%`,
      r.avgDaysToPay == null ? "—" : r.avgDaysToPay.toFixed(1),
    ]);
  } else if (report === "practice-area") {
    tableHeaders = ["Practice", "Matters", "Invoiced", "Collected", "GP", "Margin"];
    csvRows = bundle.practices.map((r) => ({
      practice: r.practiceArea,
      matters: r.matterCount,
      invoiced: r.invoicedRevenue,
      collected: r.collectedRevenue,
      gp: r.grossProfit,
      margin: r.grossMargin,
    }));
    tableRows = bundle.practices.map((r) => [
      r.practiceArea,
      String(r.matterCount),
      formatCurrency(r.invoicedRevenue),
      formatCurrency(r.collectedRevenue),
      formatCurrency(r.grossProfit),
      r.grossMargin == null ? "N/A" : `${r.grossMargin.toFixed(1)}%`,
    ]);
  } else if (report === "attorney-productivity") {
    tableHeaders = ["Name", "Billable hrs", "Util %", "Billable $", "Labor cost", "Open tasks"];
    csvRows = bundle.attorneys.map((r) => ({
      name: r.fullName,
      billable_hours: r.billableHours,
      utilization: r.utilization,
      billable_value: r.billableValue,
      labor_cost: r.laborCost,
      open_tasks: r.openTasks,
    }));
    tableRows = bundle.attorneys.map((r) => [
      r.fullName,
      r.billableHours.toFixed(1),
      r.utilization == null ? "—" : `${r.utilization.toFixed(1)}%`,
      formatCurrency(r.billableValue),
      formatCurrency(r.laborCost),
      String(r.openTasks),
    ]);
  } else if (report === "time-entries") {
    const rows = raw.time.filter((t: any) => inRange(t.work_date));
    tableHeaders = ["Date", "Matter", "Employee", "Hours", "Billable", "Rate", "Cost rate", "Status", "Invoice"];
    csvRows = rows.map((t: any) => ({
      work_date: t.work_date,
      matter_id: t.matter_id,
      employee_id: t.employee_id,
      hours: t.hours,
      billable_status: t.billable_status,
      billing_rate: t.billing_rate,
      internal_cost_rate: t.internal_cost_rate,
      approval_status: t.approval_status,
      invoice_status: t.invoice_status,
      description: t.billing_description,
    }));
    const pmap = new Map(raw.profiles.map((p: any) => [p.id, p.full_name]));
    const mmap = new Map(raw.matterRows.map((m: any) => [m.id, m.matter_number]));
    tableRows = rows.map((t: any) => [
      formatDate(t.work_date),
      mmap.get(t.matter_id) || t.matter_id.slice(0, 8),
      pmap.get(t.employee_id) || "—",
      String(t.hours),
      t.billable_status,
      formatCurrency(n(t.billing_rate)),
      formatCurrency(n(t.internal_cost_rate)),
      t.approval_status,
      t.invoice_status,
    ]);
    totalsNote = `Entries: ${rows.length} · Hours: ${rows.reduce((s: number, t: any) => s + n(t.hours), 0).toFixed(2)}`;
  } else if (report === "expenses") {
    const rows = raw.expenses.filter((e: any) => inRange(e.expense_date));
    tableHeaders = ["Date", "Matter", "Type", "Amount", "Reimb", "Approval", "Invoice"];
    csvRows = rows.map((e: any) => ({
      expense_date: e.expense_date,
      matter_id: e.matter_id,
      type: e.expense_type,
      amount: e.amount,
      reimbursable: e.client_reimbursable,
      approval: e.approval_status,
      invoice: e.invoice_status,
      description: e.description,
    }));
    const mmap = new Map(raw.matterRows.map((m: any) => [m.id, m.matter_number]));
    tableRows = rows.map((e: any) => [
      formatDate(e.expense_date),
      mmap.get(e.matter_id) || "—",
      e.expense_type,
      formatCurrency(n(e.amount)),
      e.client_reimbursable ? "Yes" : "No",
      e.approval_status,
      e.invoice_status,
    ]);
    totalsNote = `Total: ${formatCurrency(rows.reduce((s: number, e: any) => s + n(e.amount), 0))}`;
  } else if (report === "invoice-register") {
    const rows = raw.invoices.filter((i: any) => inRange(i.invoice_date));
    tableHeaders = ["Invoice", "Date", "Due", "Status", "Total", "Paid", "Balance"];
    csvRows = rows.map((i: any) => ({
      invoice_number: i.invoice_number,
      invoice_date: i.invoice_date,
      due_date: i.due_date,
      status: i.invoice_status,
      total: i.invoice_total,
      payments: i.payments_applied,
      retainer: i.retainer_applied,
      balance: i.balance_due,
    }));
    tableRows = rows.map((i: any) => [
      i.invoice_number,
      formatDate(i.invoice_date),
      formatDate(i.due_date),
      i.invoice_status,
      formatCurrency(n(i.invoice_total)),
      formatCurrency(n(i.payments_applied) + n(i.retainer_applied)),
      formatCurrency(n(i.balance_due)),
    ]);
    totalsNote = `Invoices: ${rows.length} · Balance: ${formatCurrency(rows.reduce((s: number, i: any) => s + n(i.balance_due), 0))}`;
  } else if (report === "ar-aging") {
    const rows = raw.invoices.filter(
      (i: any) => i.finalized_at && n(i.balance_due) > 0 && !["Paid", "Canceled", "Written Off"].includes(i.invoice_status)
    );
    tableHeaders = ["Invoice", "Due", "Balance", "Aging", "Status"];
    csvRows = rows.map((i: any) => ({
      invoice_number: i.invoice_number,
      due_date: i.due_date,
      balance: i.balance_due,
      aging: arBucket(i.due_date, n(i.balance_due), i.invoice_status),
      status: i.invoice_status,
    }));
    tableRows = rows.map((i: any) => [
      i.invoice_number,
      formatDate(i.due_date),
      formatCurrency(n(i.balance_due)),
      arBucket(i.due_date, n(i.balance_due), i.invoice_status),
      i.invoice_status,
    ]);
    totalsNote = `Open AR: ${formatCurrency(rows.reduce((s: number, i: any) => s + n(i.balance_due), 0))}`;
  } else if (report === "payment-register") {
    const rows = raw.payments.filter((p: any) => inRange(p.payment_date));
    tableHeaders = ["Payment", "Date", "Method", "Total", "Unapplied", "Status"];
    csvRows = rows.map((p: any) => ({
      payment_number: p.payment_number,
      payment_date: p.payment_date,
      method: p.payment_method,
      total: p.total_amount,
      unapplied: p.unapplied_amount,
      status: p.payment_status,
      reference: p.reference_number,
    }));
    tableRows = rows.map((p: any) => [
      p.payment_number,
      formatDate(p.payment_date),
      p.payment_method,
      formatCurrency(n(p.total_amount)),
      formatCurrency(n(p.unapplied_amount)),
      p.payment_status,
    ]);
  } else if (report === "retainer-ledger") {
    const { data: txns } = await supabase
      .from("retainer_transactions")
      .select("*, retainer_accounts(current_balance), matters(matter_number)")
      .order("transaction_date", { ascending: false })
      .limit(200);
    const rows = (txns || []).filter((t: any) => inRange(t.transaction_date));
    tableHeaders = ["Date", "Matter", "Type", "Amount", "Status", "Description"];
    csvRows = rows.map((t: any) => ({
      date: t.transaction_date,
      matter: t.matters?.matter_number,
      type: t.transaction_type,
      amount: t.amount,
      status: t.approval_status,
      description: t.description,
    }));
    tableRows = rows.map((t: any) => [
      formatDate(t.transaction_date),
      t.matters?.matter_number || "—",
      t.transaction_type,
      formatCurrency(n(t.amount)),
      t.approval_status,
      t.description || "—",
    ]);
  } else if (report === "journal-entries") {
    const rows = raw.journalEntries.filter((j: any) => inRange(j.entry_date));
    tableHeaders = ["JE #", "Date", "Source", "Description", "Status"];
    csvRows = rows.map((j: any) => ({
      number: j.journal_entry_number,
      date: j.entry_date,
      source: j.source_type,
      description: j.description,
      status: j.posting_status,
    }));
    tableRows = rows.map((j: any) => [
      j.journal_entry_number,
      formatDate(j.entry_date),
      j.source_type,
      j.description || "—",
      j.posting_status,
    ]);
  } else if (report === "write-downs-offs") {
    const { data: adjs } = await supabase.from("billing_adjustments").select("*").limit(200);
    const adjRows = (adjs || []).filter((a: any) => !from || true);
    tableHeaders = ["Type", "Matter/Inv", "Original", "Amount", "Status", "Reason"];
    csvRows = [
      ...adjRows.map((a: any) => ({
        kind: "Write-Down/Adj",
        amount: a.adjustment_amount,
        original: a.original_amount,
        status: a.approval_status,
        reason: a.reason,
      })),
      ...raw.writeOffs.map((w: any) => ({
        kind: "Write-Off",
        amount: w.amount,
        original: "",
        status: w.approval_status,
        reason: w.reason,
      })),
    ];
    tableRows = [
      ...adjRows.map((a: any) => [
        a.adjustment_type,
        (a.invoice_id || a.matter_id || "").toString().slice(0, 8),
        formatCurrency(n(a.original_amount)),
        formatCurrency(n(a.adjustment_amount)),
        a.approval_status,
        a.reason || "—",
      ]),
      ...raw.writeOffs.map((w: any) => [
        "Write-Off",
        (w.invoice_id || "").slice(0, 8),
        "—",
        formatCurrency(n(w.amount)),
        w.approval_status,
        w.reason || "—",
      ]),
    ];
  } else if (report === "unbilled") {
    const t = raw.time.filter(
      (x: any) =>
        x.approval_status === "Approved" &&
        x.invoice_status === "Unbilled" &&
        x.billable_status === "Billable"
    );
    const e = raw.expenses.filter(
      (x: any) =>
        x.approval_status === "Approved" && x.client_reimbursable && x.invoice_status === "Unbilled"
    );
    tableHeaders = ["Kind", "Date", "Matter", "Amount", "Description"];
    const mmap = new Map(raw.matterRows.map((m: any) => [m.id, m.matter_number]));
    csvRows = [
      ...t.map((x: any) => ({
        kind: "Time",
        date: x.work_date,
        matter: mmap.get(x.matter_id),
        amount: calcBillableAmount(n(x.hours), n(x.billing_rate), x.billable_status),
        description: x.billing_description,
      })),
      ...e.map((x: any) => ({
        kind: "Expense",
        date: x.expense_date,
        matter: mmap.get(x.matter_id),
        amount: x.amount,
        description: x.description,
      })),
    ];
    tableRows = [
      ...t.map((x: any) => [
        "Time",
        formatDate(x.work_date),
        mmap.get(x.matter_id) || "—",
        formatCurrency(calcBillableAmount(n(x.hours), n(x.billing_rate), x.billable_status)),
        x.billing_description || "—",
      ]),
      ...e.map((x: any) => [
        "Expense",
        formatDate(x.expense_date),
        mmap.get(x.matter_id) || "—",
        formatCurrency(n(x.amount)),
        x.description || "—",
      ]),
    ];
  } else if (report === "budget-variance") {
    const rows = bundle.matters.filter((m) => m.budget != null && m.budget > 0);
    tableHeaders = ["Matter", "Budget", "Consumed", "Remaining", "Variance", "Flag"];
    csvRows = rows.map((m) => ({
      matter: m.matterNumber,
      budget: m.budget,
      consumed: m.budgetConsumed,
      remaining: m.budgetRemaining,
      variance: m.budgetVariance,
      flag: m.budgetFlag,
    }));
    tableRows = rows.map((m) => [
      m.matterNumber,
      formatCurrency(m.budget || 0),
      formatCurrency(m.budgetConsumed),
      formatCurrency(m.budgetRemaining || 0),
      formatCurrency(m.budgetVariance || 0),
      m.budgetFlag,
    ]);
  }

  const csv = toCsv(csvRows);
  const filtersLabel = `Date from: ${from || "all"} · to: ${to || "all"} · Role: ${profile.role}`;

  return (
    <>
      <PageHeader
        title={TITLES[report]}
        description={`Generated ${generated}. ${filtersLabel}`}
        actions={
          <div className="flex gap-2">
            <Link href="/reports" className="btn btn-ghost btn-sm">
              All reports
            </Link>
            <a
              className="btn btn-sm btn-outline"
              href={csvHref(csv || "empty")}
              download={`${report}.csv`}
            >
              Export CSV
            </a>
          </div>
        }
      />
      <AnalyticsNotice />
      <form className="flex flex-wrap gap-2 items-end mb-2">
        <input type="date" name="from" className="input input-bordered input-sm" defaultValue={from || ""} />
        <input type="date" name="to" className="input input-bordered input-sm" defaultValue={to || ""} />
        <button type="submit" className="btn btn-sm btn-primary">
          Apply filters
        </button>
      </form>
      {totalsNote && <p className="text-sm font-medium">{totalsNote}</p>}
      {tableRows.length === 0 ? (
        <EmptyState title="No rows for this report and filter set." />
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  {tableHeaders.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="text-sm">
                        {cell}
                      </td>
                    ))}
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
