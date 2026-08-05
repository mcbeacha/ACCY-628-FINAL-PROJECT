import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { AnalyticsNotice } from "@/components/analytics/AnalyticsNotice";
import { ExecutiveCharts } from "./ExecutiveCharts";
import { AttorneyDocumentRequestForm } from "@/components/document-requests/AttorneyDocumentRequestForm";
import { AttorneyDocumentRequestList } from "@/components/document-requests/AttorneyDocumentRequestList";
import { ParalegalDocumentQueue } from "@/components/document-requests/ParalegalDocumentQueue";
import { ClientDocumentTasks } from "@/components/document-requests/ClientDocumentTasks";
import { clientDisplayName, formatCurrency, formatDate, isOverdue } from "@/lib/format";
import { evaluateBillingReadiness } from "@/lib/billing-readiness";
import { calcBillableAmount } from "@/lib/phase2-types";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { weeksInRange } from "@/lib/analytics";
import type { Client, Matter, MatterTask, Profile } from "@/lib/types";
import Link from "next/link";

function startOfWeekISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();

  if (profile.role === "managing_partner") {
    return <PartnerDashboard supabase={supabase} />;
  }
  if (profile.role === "attorney") {
    return <AttorneyDashboard supabase={supabase} profile={profile} />;
  }
  if (profile.role === "paralegal") {
    return <StaffDashboard supabase={supabase} profile={profile} />;
  }
  if (profile.role === "billing_staff") {
    return <BillingDashboard supabase={supabase} />;
  }
  return <ClientDashboard supabase={supabase} profile={profile} />;
}

async function PartnerDashboard({
  supabase,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw);

  const [{ data: clients }, { data: matters }, { data: tasks }, { data: activity }] =
    await Promise.all([
      supabase.from("clients").select("*"),
      supabase
        .from("matters")
        .select("*, clients(*)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("matter_tasks")
        .select("*, matters(matter_name, matter_number)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("matter_activity")
        .select("*, performer:profiles!matter_activity_performed_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const clientRows = (clients || []) as Client[];
  const matterRows = (matters || []) as Matter[];
  const taskRows = (tasks || []) as MatterTask[];

  const activeClients = clientRows.filter((c) => c.client_status === "Active").length;
  const activeMatters = matterRows.filter((m) => m.matter_status === "Active").length;
  const awaiting = matterRows.filter(
    (m) =>
      m.approval_status === "Pending Approval" || m.matter_status === "Pending Approval"
  );
  const missingLead = matterRows.filter(
    (m) =>
      !m.responsible_attorney_id &&
      m.matter_status !== "Closed" &&
      m.matter_status !== "Canceled"
  );
  const missingEngagement = matterRows.filter(
    (m) =>
      m.matter_status !== "Closed" &&
      (!m.billing_method || !m.scope_summary || !m.payment_terms_days)
  );
  const approaching = matterRows.filter((m) => {
    if (!m.expected_end_date) return false;
    if (["Closed", "Canceled"].includes(m.matter_status)) return false;
    const end = new Date(`${m.expected_end_date}T00:00:00`).getTime();
    const now = Date.now();
    const days = (end - now) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  });

  const byStatus = countBy(matterRows.map((m) => m.matter_status));
  const byBilling = countBy(matterRows.map((m) => m.billing_method || "Not set"));

  const totalInvoiced = bundle.matters.reduce((s, m) => s + m.invoicedRevenue, 0);
  const totalCollected = bundle.matters.reduce((s, m) => s + m.collectedRevenue, 0);
  const outstandingAR = bundle.matters.reduce((s, m) => s + m.outstandingAR, 0);
  const pastDueAR = bundle.clients.reduce((s, c) => s + c.pastDueAR, 0);
  const grossProfit = bundle.matters.reduce((s, m) => s + m.grossProfit, 0);
  const grossMargin = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : null;
  const unbilledTimeAmt = raw.time
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) =>
        t.approval_status === "Approved" &&
        t.invoice_status === "Unbilled" &&
        t.billable_status === "Billable"
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce(
      (s: number, t: any) =>
        s + calcBillableAmount(Number(t.hours), Number(t.billing_rate), t.billable_status),
      0
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unbilledExpAmt = raw.expenses
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) =>
        e.approval_status === "Approved" && e.client_reimbursable && e.invoice_status === "Unbilled"
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s: number, e: any) => s + Number(e.amount), 0);
  const lowRetainers = raw.retainers.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.account_status === "Below Threshold"
  ).length;
  const overBudget = bundle.matters.filter((m) => m.budgetFlag === "Over Budget").length;
  const nearBudget = bundle.matters.filter((m) => m.budgetFlag === "Near Budget").length;
  const invAwaiting = raw.invoices.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => i.approval_status === "Submitted"
  ).length;
  const disputedInv = raw.invoices.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => i.invoice_status === "Disputed"
  ).length;
  const submittedTime = raw.time.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.approval_status === "Submitted"
  ).length;

  const collectionTrend = bundle.monthly.map((m) => ({
    month: m.month,
    rate: m.invoiced > 0 ? (m.collected / m.invoiced) * 100 : 0,
  }));
  const utilData = bundle.attorneys
    .filter((a) => a.utilization != null)
    .map((a) => ({
      name: a.fullName.split(" ")[0] || a.fullName,
      utilization: Number((a.utilization || 0).toFixed(1)),
    }));
  const matterProfitSorted = [...bundle.matters]
    .sort((a, b) => a.grossProfit - b.grossProfit)
    .slice(0, 6)
    .map((m) => ({ name: m.matterNumber, grossProfit: m.grossProfit }));

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        description="Actionable firm metrics from saved operational data (fictional academic simulation)."
      />
      <AnalyticsNotice />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced revenue" value={formatCurrency(totalInvoiced)} href="/invoices" />
        <StatCard label="Collected revenue" value={formatCurrency(totalCollected)} href="/ar" />
        <StatCard
          label="Outstanding AR"
          value={formatCurrency(outstandingAR)}
          tone={outstandingAR ? "warning" : "default"}
          href="/ar"
        />
        <StatCard
          label="Past-due AR"
          value={formatCurrency(pastDueAR)}
          tone={pastDueAR ? "error" : "default"}
          href="/ar"
        />
        <StatCard label="Gross profit" value={formatCurrency(grossProfit)} href="/profitability/matters" />
        <StatCard
          label="Gross margin"
          value={grossMargin == null ? "N/A" : `${grossMargin.toFixed(1)}%`}
          href="/profitability/matters"
        />
        <StatCard label="Unbilled approved time" value={formatCurrency(unbilledTimeAmt)} href="/unbilled" />
        <StatCard label="Unbilled approved expenses" value={formatCurrency(unbilledExpAmt)} href="/unbilled" />
        <StatCard
          label="Retainers below threshold"
          value={lowRetainers}
          tone={lowRetainers ? "warning" : "success"}
          href="/retainers"
        />
        <StatCard
          label="Matters over budget"
          value={overBudget}
          tone={overBudget ? "error" : "default"}
          href="/profitability/matters"
        />
        <StatCard
          label="Matters near budget"
          value={nearBudget}
          tone={nearBudget ? "warning" : "default"}
        />
        <StatCard
          label="Invoices awaiting approval"
          value={invAwaiting}
          tone={invAwaiting ? "warning" : "default"}
          href="/invoices"
        />
        <StatCard label="Active matters" value={activeMatters} href="/matters" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/costs" className="btn btn-sm btn-primary">
          Cost &amp; resources
        </Link>
        <Link href="/profitability/matters" className="btn btn-sm btn-outline">
          Matter profitability
        </Link>
        <Link href="/ar" className="btn btn-sm btn-outline">
          AR aging
        </Link>
        <Link href="/data-quality" className="btn btn-sm btn-outline">
          Data quality ({missingLead.length + (unbilledTimeAmt === 0 ? 0 : 0)})
        </Link>
        <Link href="/controls" className="btn btn-sm btn-outline">
          Controls
        </Link>
        <Link href="/reports" className="btn btn-sm btn-outline">
          Reports
        </Link>
        <Link href="/invoices" className="btn btn-sm btn-outline">
          Invoices
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active clients" value={activeClients} href="/clients" />
        <StatCard
          label="Matters awaiting approval"
          value={awaiting.length}
          tone={awaiting.length ? "warning" : "default"}
          href="/matters"
        />
        <StatCard
          label="Missing lead attorney"
          value={missingLead.length}
          tone={missingLead.length ? "error" : "success"}
          href="/data-quality"
        />
        <StatCard
          label="Submitted time to review"
          value={submittedTime}
          tone={submittedTime ? "warning" : "default"}
          href="/time/review"
        />
        <StatCard
          label="Disputed invoices"
          value={disputedInv}
          tone={disputedInv ? "warning" : "default"}
          href="/invoices"
        />
      </div>
      <ExecutiveCharts
        monthly={bundle.monthly}
        practices={bundle.practices.map((p) => ({
          practiceArea: p.practiceArea,
          grossProfit: p.grossProfit,
        }))}
        arAging={bundle.arAging}
        utilization={utilData}
        collectionTrend={collectionTrend}
        writeTrend={bundle.writeTrend}
        matterProfit={matterProfitSorted}
        byMethod={bundle.revenueByMethod}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Matters by status</h2>
            <StatusList items={byStatus} />
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Matters by billing method</h2>
            <StatusList items={byBilling} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WarningTable
          title="Approaching deadlines (30 days)"
          empty="No matters approaching an expected end date."
          rows={approaching.map((m) => ({
            id: m.id,
            left: m.matter_number,
            mid: m.matter_name,
            right: formatDate(m.expected_end_date),
          }))}
        />
        <WarningTable
          title="Missing engagement information"
          empty="No open matters are missing core engagement fields."
          rows={missingEngagement.map((m) => ({
            id: m.id,
            left: m.matter_number,
            mid: m.matter_name,
            right: m.billing_method || "No method",
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Recent tasks</h2>
            <TaskMiniList tasks={taskRows} />
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Recent matter activity</h2>
            <ul className="space-y-3">
              {(activity || []).length === 0 && (
                <li className="text-sm opacity-60">No activity yet.</li>
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(activity || []).map((a: any) => (
                <li key={a.id} className="text-sm border-b border-base-200 pb-2">
                  <div className="font-medium">{a.action_description}</div>
                  <div className="text-xs opacity-60">
                    {a.performer?.full_name || "System"} · {formatDate(a.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

async function AttorneyDashboard({
  supabase,
  profile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  profile: Profile;
}) {
  const weekStart = startOfWeekISO();
  const { data: matters } = await supabase
    .from("matters")
    .select("*, clients(*)")
    .order("updated_at", { ascending: false });
  const matterRows = (matters || []) as Matter[];

  const { data: tasks } = await supabase
    .from("matter_tasks")
    .select("*, matters(matter_name, matter_number)")
    .eq("assigned_to", profile.id)
    .order("due_date", { ascending: true });
  const taskRows = (tasks || []) as MatterTask[];

  const [{ data: myTime }, { data: myExp }, { data: retainers }, { data: matterInvoices }] = await Promise.all([
    supabase.from("time_entries").select("*").eq("employee_id", profile.id),
    supabase.from("expense_entries").select("*").eq("created_by", profile.id).order("expense_date", { ascending: false }).limit(5),
    supabase.from("retainer_accounts").select("*, matters(matter_number, matter_name)").in("account_status", ["Below Threshold", "Exhausted"]),
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_status, balance_due, due_date, matter_id, finalized_at")
      .order("due_date", { ascending: false })
      .limit(30),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeRows = (myTime || []) as any[];
  const weekTime = timeRows.filter((t) => t.work_date >= weekStart);
  const hoursWeek = weekTime.reduce((s, t) => s + Number(t.hours), 0);
  const billableWeek = weekTime
    .filter((t) => t.billable_status === "Billable")
    .reduce((s, t) => s + Number(t.hours), 0);
  const draftTime = timeRows.filter((t) => t.approval_status === "Draft").length;
  const rejectedTime = timeRows.filter((t) => t.approval_status === "Rejected").length;
  const unsubmitted = timeRows.filter((t) => t.approval_status === "Draft").length;
  const unbilledMine = timeRows
    .filter((t) => t.approval_status === "Approved" && t.invoice_status === "Unbilled" && t.billable_status === "Billable")
    .reduce((s, t) => s + calcBillableAmount(Number(t.hours), Number(t.billing_rate), t.billable_status), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthIso = monthStart.toISOString().slice(0, 10);
  const billableMonth = timeRows
    .filter(
      (t) =>
        t.work_date >= monthIso &&
        t.approval_status === "Approved" &&
        t.billable_status === "Billable"
    )
    .reduce((s, t) => s + Number(t.hours), 0);
  // utilization: this month billable / (available_weekly * weeks this month so far)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avail = Number((profile as any).available_weekly_hours) || 40;
  const weeksM = weeksInRange(monthIso, new Date().toISOString().slice(0, 10));
  const utilEst = weeksM > 0 ? (billableMonth / (avail * weeksM)) * 100 : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invMine = (matterInvoices || []) as any[];
  const pastDueMine = invMine.filter(
    (i) =>
      Number(i.balance_due) > 0 &&
      i.finalized_at &&
      new Date(`${i.due_date}T00:00:00`) < new Date(new Date().toDateString())
  );
  // budget warnings
  const budgetWarnings = matterRows.filter((m) => m.matter_budget && Number(m.matter_budget) > 0);

  const active = matterRows.filter((m) => m.matter_status === "Active");
  const openTasks = taskRows.filter((t) => !["Completed", "Canceled"].includes(t.task_status));
  const overdue = openTasks.filter((t) => isOverdue(t.due_date, t.task_status));
  const upcoming = matterRows.filter((m) => {
    if (!m.expected_end_date) return false;
    const days =
      (new Date(`${m.expected_end_date}T00:00:00`).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 21;
  });
  const needsUpdate = matterRows.filter((m) =>
    ["Draft", "Pending Approval", "Needs Review", "On Hold"].includes(m.matter_status) ||
    m.approval_status === "Needs Review"
  );

  return (
    <>
      <PageHeader
        title="Attorney Workspace"
        description="Request documents from clients, then track assigned matters, open work, and timekeeping."
      />
      <AttorneyDocumentRequestForm profile={profile} compact />
      <AttorneyDocumentRequestList profile={profile} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned active matters" value={active.length} href="/matters" />
        <StatCard label="Open tasks" value={openTasks.length} href="/tasks" />
        <StatCard
          label="Overdue tasks"
          value={overdue.length}
          tone={overdue.length ? "error" : "success"}
          href="/tasks"
        />
        <StatCard label="Upcoming deadlines" value={upcoming.length} tone="warning" href="/matters" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hours entered this week" value={hoursWeek.toFixed(2)} href="/time" />
        <StatCard label="Billable hours this week" value={billableWeek.toFixed(2)} href="/time" />
        <StatCard label="Billable hours this month" value={billableMonth.toFixed(2)} href="/time" />
        <StatCard
          label="Utilization estimate (month)"
          value={utilEst == null ? "—" : `${utilEst.toFixed(1)}%`}
          href="/time"
        />
        <StatCard label="Draft / unsubmitted time" value={unsubmitted} href="/time" />
        <StatCard
          label="Rejected time entries"
          value={rejectedTime}
          tone={rejectedTime ? "error" : "default"}
          href="/time"
        />
        <StatCard label="My unbilled approved time" value={formatCurrency(unbilledMine)} href="/time" />
        <StatCard label="Matter invoices (visible)" value={invMine.length} href="/invoices" />
        <StatCard
          label="Past-due balances (visible)"
          value={pastDueMine.length}
          tone={pastDueMine.length ? "error" : "default"}
          href="/invoices"
        />
        <StatCard
          label="Past-due $ (assigned matters)"
          value={formatCurrency(pastDueMine.reduce((s, i) => s + Number(i.balance_due), 0))}
          tone={pastDueMine.length ? "warning" : "default"}
          href="/invoices"
        />
        <StatCard label="Matters with budgets set" value={budgetWarnings.length} href="/matters" />
        <StatCard label="Draft time entries" value={draftTime} href="/time" />
      </div>
      <p className="text-xs opacity-60">
        Utilization uses available weekly hours (default 40) × weeks this month — management estimate only.
      </p>
      {invMine.length > 0 && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-base">Billing status (assigned matters)</h2>
              <Link href="/invoices" className="link text-sm">View invoices</Link>
            </div>
            <ul className="text-sm space-y-2">
              {invMine.slice(0, 6).map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <Link href={`/invoices/${i.id}`} className="link link-hover">
                    {i.invoice_number}
                  </Link>
                  <span>
                    <StatusBadge status={i.invoice_status} />{" "}
                    {formatCurrency(Number(i.balance_due))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {(retainers || []).length > 0 && (
        <div className="alert alert-warning text-sm">
          <span>
            Low retainers on assigned matters:{" "}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(retainers || []).map((r: any) => r.matters?.matter_number).filter(Boolean).join(", ") || "see Retainers with finance"}
          </span>
        </div>
      )}
      {(myExp || []).length > 0 && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Recent expenses</h2>
            <ul className="space-y-2 text-sm">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(myExp || []).map((e: any) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{formatDate(e.expense_date)} · {e.expense_type}</span>
                  <span className="font-medium">{formatCurrency(Number(e.amount))}</span>
                </li>
              ))}
            </ul>
            <Link href="/expenses" className="link text-sm">View all expenses</Link>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Assigned matters</h2>
            {matterRows.length === 0 ? (
              <EmptyState title="You do not currently have any assigned matters." />
            ) : (
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Matter</th>
                      <th>Client</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matterRows.slice(0, 8).map((m) => (
                      <tr key={m.id}>
                        <td>
                          <Link className="link link-hover font-medium" href={`/matters/${m.id}`}>
                            {m.matter_number}
                          </Link>
                          <div className="text-xs opacity-60">{m.matter_name}</div>
                        </td>
                        <td className="text-sm">{clientDisplayName(m.clients as Client)}</td>
                        <td>
                          <StatusBadge status={m.matter_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Open tasks</h2>
            <TaskMiniList tasks={openTasks.slice(0, 8)} />
          </div>
        </div>
      </div>
      {needsUpdate.length > 0 && (
        <div className="card bg-base-100 border border-warning/40 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Matters awaiting an attorney update</h2>
            <ul className="space-y-2">
              {needsUpdate.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 text-sm">
                  <Link href={`/matters/${m.id}`} className="link link-hover">
                    {m.matter_number} · {m.matter_name}
                  </Link>
                  <StatusBadge status={m.matter_status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

async function StaffDashboard({
  supabase,
  profile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  profile: Profile;
}) {
  const weekStart = startOfWeekISO();
  const { data: tasks } = await supabase
    .from("matter_tasks")
    .select("*, matters(id, matter_name, matter_number)")
    .eq("assigned_to", profile.id)
    .order("due_date", { ascending: true });
  const taskRows = (tasks || []) as MatterTask[];
  const open = taskRows.filter((t) => !["Completed", "Canceled"].includes(t.task_status));
  const overdue = open.filter((t) => isOverdue(t.due_date, t.task_status));
  const dueSoon = open.filter((t) => {
    if (!t.due_date || isOverdue(t.due_date, t.task_status)) return false;
    const days =
      (new Date(`${t.due_date}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  });
  const waiting = open.filter((t) => t.task_status === "Waiting");

  const { data: matters } = await supabase
    .from("matters")
    .select("id, matter_number, matter_name, matter_status")
    .order("updated_at", { ascending: false });

  const [{ data: myTime }, { data: myExp }] = await Promise.all([
    supabase.from("time_entries").select("*").eq("employee_id", profile.id),
    supabase.from("expense_entries").select("id, approval_status").eq("created_by", profile.id),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeRows = (myTime || []) as any[];
  const hoursWeek = timeRows.filter((t) => t.work_date >= weekStart).reduce((s, t) => s + Number(t.hours), 0);
  const draftTime = timeRows.filter((t) => t.approval_status === "Draft").length;
  const rejected = timeRows.filter((t) => t.approval_status === "Rejected").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submittedExp = (myExp || []).filter((e: any) => e.approval_status === "Submitted").length;

  return (
    <>
      <PageHeader
        title="Staff Workspace"
        description="Process document requests from attorneys, collect client materials, and track assigned tasks."
      />
      <ParalegalDocumentQueue profile={profile} mineOnly />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned tasks" value={open.length} href="/tasks" />
        <StatCard label="Due soon" value={dueSoon.length} tone="warning" href="/tasks" />
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "error" : "default"}
          href="/tasks"
        />
        <StatCard label="Waiting on others" value={waiting.length} href="/tasks" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hours entered this week" value={hoursWeek.toFixed(2)} href="/time" />
        <StatCard label="Draft time entries" value={draftTime} href="/time" />
        <StatCard label="Submitted expenses" value={submittedExp} href="/expenses" />
        <StatCard
          label="Rejected entries needing correction"
          value={rejected}
          tone={rejected ? "error" : "default"}
          href="/time"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Assigned tasks</h2>
            <TaskMiniList tasks={open} />
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Assigned matters</h2>
            {(matters || []).length === 0 ? (
              <EmptyState title="You do not currently have any assigned matters." />
            ) : (
              <ul className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(matters || []).map((m: any) => (
                  <li key={m.id} className="flex justify-between text-sm">
                    <Link href={`/matters/${m.id}`} className="link link-hover">
                      {m.matter_number} · {m.matter_name}
                    </Link>
                    <StatusBadge status={m.matter_status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

async function BillingDashboard({
  supabase,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const { data: matters } = await supabase
    .from("matters")
    .select("*, clients(*)")
    .eq("approval_status", "Approved")
    .order("approved_at", { ascending: false });
  const rows = ((matters || []) as Matter[]).map((m) =>
    evaluateBillingReadiness(m, (m.clients as Client) || null)
  );
  const byMethod = countBy(rows.map((r) => r.matter.billing_method || "Not set"));
  const missing = rows.filter((r) => r.status === "Missing Information");
  const ready = rows.filter((r) => r.status === "Ready");

  const [{ data: timeData }, { data: expData }, { data: retData }, { data: txnPend }, { data: invs }, { data: pays }] =
    await Promise.all([
      supabase
        .from("time_entries")
        .select("hours, billing_rate, billable_status, billing_description, approval_status, invoice_status"),
      supabase
        .from("expense_entries")
        .select("amount, description, receipt_reference, approval_status, invoice_status, client_reimbursable"),
      supabase.from("retainer_accounts").select("account_status, current_balance"),
      supabase.from("retainer_transactions").select("id").eq("approval_status", "Submitted"),
      supabase
        .from("invoices")
        .select("id, invoice_status, approval_status, balance_due, due_date, finalized_at"),
      supabase
        .from("payments")
        .select("id, payment_status, unapplied_amount, total_amount"),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeRows = (timeData || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expRows = (expData || []) as any[];
  const unbilledTime = timeRows.filter(
    (t) => t.approval_status === "Approved" && t.invoice_status === "Unbilled" && t.billable_status === "Billable"
  );
  const unbilledExp = expRows.filter(
    (e) => e.approval_status === "Approved" && e.client_reimbursable && e.invoice_status === "Unbilled"
  );
  const missingDesc =
    unbilledTime.filter((t) => !t.billing_description).length +
    unbilledExp.filter((e) => !e.description).length;
  const missingRates = unbilledTime.filter((t) => !Number(t.billing_rate)).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lowRet = ((retData || []) as any[]).filter((r) => r.account_status === "Below Threshold").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invList = (invs || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payList = (pays || []) as any[];
  const draftInv = invList.filter((i) => i.approval_status === "Draft" || i.invoice_status === "Draft").length;
  const pendingInv = invList.filter((i) => i.approval_status === "Submitted").length;
  const draftPays = payList.filter((p) => p.payment_status === "Draft").length;
  const unappliedPay = payList
    .filter((p) => p.payment_status === "Posted")
    .reduce((s, p) => s + Number(p.unapplied_amount), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retAvailable = ((retData || []) as any[])
    .filter((r) => Number(r.current_balance) > 0)
    .reduce((s, r) => s + Number(r.current_balance), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastDueInv = invList.filter(
    (i) =>
      i.finalized_at &&
      Number(i.balance_due) > 0 &&
      new Date(`${i.due_date}T00:00:00`) < today
  );
  const arOpen = invList
    .filter((i) => i.finalized_at && Number(i.balance_due) > 0 && !["Paid", "Written Off", "Canceled"].includes(i.invoice_status))
    .reduce((s, i) => s + Number(i.balance_due), 0);

  return (
    <>
      <PageHeader
        title="Billing & Collections Dashboard"
        description="Unbilled work, draft invoices, AR aging cues, payments, and retainers."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved matters" value={rows.length} href="/matters" />
        <StatCard label="Billing ready" value={ready.length} tone="success" href="/billing-readiness" />
        <StatCard
          label="Missing information"
          value={missing.length}
          tone={missing.length ? "warning" : "default"}
          href="/billing-readiness"
        />
        <StatCard
          label="Recently approved"
          value={rows.filter((r) => r.matter.approved_at).slice(0, 5).length}
          href="/matters"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Draft invoices" value={draftInv} href="/invoices" />
        <StatCard
          label="Invoices awaiting approval"
          value={pendingInv}
          tone={pendingInv ? "warning" : "default"}
          href="/invoices"
        />
        <StatCard
          label="Approved unbilled time"
          value={formatCurrency(
            unbilledTime.reduce(
              (s, t) => s + calcBillableAmount(Number(t.hours), Number(t.billing_rate), t.billable_status),
              0
            )
          )}
          href="/unbilled"
        />
        <StatCard
          label="Approved unbilled expenses"
          value={formatCurrency(unbilledExp.reduce((s, e) => s + Number(e.amount), 0))}
          href="/unbilled"
        />
        <StatCard label="Payments waiting to post" value={draftPays} href="/payments" />
        <StatCard label="Unapplied payments" value={formatCurrency(unappliedPay)} href="/payments" />
        <StatCard
          label="Outstanding AR"
          value={formatCurrency(arOpen)}
          tone={arOpen ? "warning" : "default"}
          href="/ar"
        />
        <StatCard
          label="Past-due invoices"
          value={pastDueInv.length}
          tone={pastDueInv.length ? "error" : "default"}
          href="/ar"
        />
        <StatCard
          label="Retainers available for application"
          value={formatCurrency(retAvailable)}
          href="/retainers"
        />
        <StatCard
          label="Entries missing descriptions"
          value={missingDesc}
          tone={missingDesc ? "warning" : "default"}
          href="/unbilled"
        />
        <StatCard
          label="Entries missing rates"
          value={missingRates}
          tone={missingRates ? "warning" : "default"}
          href="/unbilled"
        />
        <StatCard
          label="Retainers below threshold"
          value={lowRet}
          tone={lowRet ? "warning" : "success"}
          href="/retainers"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/invoices/new" className="btn btn-sm btn-primary">Prepare invoice</Link>
        <Link href="/payments" className="btn btn-sm btn-outline">Payments</Link>
        <Link href="/ar" className="btn btn-sm btn-outline">AR aging</Link>
        <Link href="/unbilled" className="btn btn-sm btn-outline">Unbilled activity</Link>
      </div>
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="card-title text-base">Matters by billing method</h2>
            <div className="flex gap-2">
              <Link href="/unbilled" className="btn btn-sm btn-outline">
                Unbilled activity
              </Link>
              <Link href="/billing-readiness" className="btn btn-sm btn-primary">
                Open full review
              </Link>
            </div>
          </div>
          <StatusList items={byMethod} />
          {missing.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold mb-2">Needs attention</p>
              <ul className="space-y-2">
                {missing.slice(0, 6).map((r) => (
                  <li key={r.matter.id} className="text-sm">
                    <Link className="link link-hover font-medium" href={`/matters/${r.matter.id}`}>
                      {r.matter.matter_number}
                    </Link>
                    <span className="opacity-70"> — {r.missing.join("; ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

async function ClientDashboard({
  supabase,
  profile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  profile: Profile;
}) {
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("portal_user_id", profile.id)
    .maybeSingle();

  const { data: matters } = await supabase
    .from("matters")
    .select("*, responsible:profiles!matters_responsible_attorney_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  const matterRows = (matters || []) as Matter[];
  const active = matterRows.filter((m) => m.matter_status === "Active");

  const matterIds = matterRows.map((m) => m.id);
  let tasks: MatterTask[] = [];
  if (matterIds.length) {
    const { data } = await supabase
      .from("matter_tasks")
      .select("*")
      .eq("client_visible", true)
      .in("matter_id", matterIds)
      .order("due_date", { ascending: true });
    tasks = (data || []) as MatterTask[];
  }

  let openBal = 0;
  let invCount = 0;
  if (client) {
    const { data: invs } = await supabase
      .from("invoices")
      .select("balance_due, invoice_total")
      .eq("client_id", (client as Client).id)
      .not("finalized_at", "is", null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (invs || []) as any[];
    invCount = list.length;
    openBal = list.reduce((s, i) => s + Number(i.balance_due), 0);
  }

  return (
    <>
      <PageHeader
        title="Client Workspace"
        description="A simplified view of your matters, document requests, invoices, and important dates. This system contains fictional project data only."
      />
      <div className="alert alert-info text-sm">
        <span>
          Signed in as <strong>{profile.full_name}</strong>
          {client ? (
            <>
              {" "}
              · Client profile:{" "}
              <strong>{clientDisplayName(client as Client)}</strong> (
              {(client as Client).client_number})
            </>
          ) : (
            " · No linked client profile yet. Contact the firm administrator for your seed client link."
          )}
        </span>
      </div>
      <ClientDocumentTasks
        profile={profile}
        clientIds={client ? [(client as Client).id] : []}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active matters" value={active.length} href="/portal" />
        <StatCard label="All your matters" value={matterRows.length} href="/portal" />
        <StatCard label="Client-visible milestones" value={tasks.length} href="/portal" />
        <StatCard label="Open invoice balance" value={formatCurrency(openBal)} href="/portal/billing" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/portal/billing" className="btn btn-sm btn-primary">
          Invoices & payments ({invCount})
        </Link>
        <Link href="/portal" className="btn btn-sm btn-outline">
          Full portal
        </Link>
      </div>
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Your matters</h2>
          {matterRows.length === 0 ? (
            <EmptyState title="No active matters are currently available for this client." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matter</th>
                    <th>Status</th>
                    <th>Lead attorney</th>
                    <th>Important dates</th>
                  </tr>
                </thead>
                <tbody>
                  {matterRows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/matters/${m.id}`} className="link link-hover font-medium">
                          {m.matter_name}
                        </Link>
                        <div className="text-xs opacity-60">{m.matter_number}</div>
                      </td>
                      <td>
                        <StatusBadge status={m.matter_status} />
                      </td>
                      <td className="text-sm">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(m as any).responsible?.full_name || "—"}
                      </td>
                      <td className="text-sm">
                        Start {formatDate(m.engagement_start_date)}
                        <br />
                        Expected end {formatDate(m.expected_end_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Client-visible tasks / milestones</h2>
          <TaskMiniList tasks={tasks} clientView />
        </div>
      </div>
    </>
  );
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function StatusList({ items }: { items: [string, number][] }) {
  if (!items.length) return <p className="text-sm opacity-60">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {items.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <StatusBadge status={k} />
          </span>
          <span className="font-semibold">{v}</span>
        </li>
      ))}
    </ul>
  );
}

function WarningTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; left: string; mid: string; right: string }[];
}) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm opacity-60">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 text-sm">
                <Link href={`/matters/${r.id}`} className="link link-hover">
                  {r.left} · {r.mid}
                </Link>
                <span className="opacity-70 shrink-0">{r.right}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TaskMiniList({
  tasks,
  clientView = false,
}: {
  tasks: MatterTask[];
  clientView?: boolean;
}) {
  if (!tasks.length) {
    return (
      <p className="text-sm opacity-60">
        {clientView
          ? "No client-visible milestones are available right now."
          : "No tasks are assigned to you right now."}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {tasks.map((t) => {
        const overdue = isOverdue(t.due_date, t.task_status);
        return (
          <li
            key={t.id}
            className={`text-sm border-b border-base-200 pb-2 ${overdue ? "text-error" : ""}`}
          >
            <div className="font-medium flex flex-wrap gap-2 items-center">
              {t.task_title}
              <StatusBadge status={t.task_status} />
              <PriorityBadge priority={t.priority} />
              {overdue && <span className="badge badge-error">Overdue</span>}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(t as any).matters?.matter_number
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  `${(t as any).matters.matter_number} · `
                : ""}
              Due {formatDate(t.due_date)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
