import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DeadlineCalendar, buildDeadlineWindow } from "@/components/DeadlineCalendar";
import { WeeklyUtilizationCard } from "@/components/WeeklyUtilizationCard";
import { CaseEvaluationsMiniList } from "@/components/intake/CaseEvaluationDetailClient";
import { ExecutiveCharts } from "./ExecutiveCharts";
import { clientDisplayName, formatCurrency, formatDate, isOverdue } from "@/lib/format";
import { evaluateBillingReadiness } from "@/lib/billing-readiness";
import { calcBillableAmount } from "@/lib/phase2-types";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { weeksInRange } from "@/lib/analytics";
import { buildDataQualityExceptions } from "@/lib/data-quality";
import { inboxItemsToFocus, inboxMetaForRole, loadInboxItems } from "@/lib/inbox";
import type { CaseEvaluation } from "@/lib/case-evaluations";
import type { Client, Matter, MatterTask, Profile } from "@/lib/types";
import { SectionHeader } from "@/components/workspace/SectionHeader";
import { TodaysFocus } from "@/components/workspace/TodaysFocus";
import { PartnerQuickActions } from "@/components/workspace/PartnerQuickActions";
import { DeadlineCard } from "@/components/workspace/DeadlineCard";
import { ActivityFeed } from "@/components/workspace/ActivityFeed";
import { ActiveMattersPanel } from "@/components/workspace/ActiveMattersPanel";
import { MyTasksPanel } from "@/components/workspace/MyTasksPanel";
import { TimeBillingSummary } from "@/components/workspace/TimeBillingSummary";
import { QuickActions } from "@/components/workspace/QuickActions";
import {
  ACTIVITY,
  FOCUS_ITEMS,
  TASKS as MOCK_TASKS,
  daysUntil,
  upcomingDeadlines,
} from "@/lib/workspace-mock";
import {
  buildTimekeeping,
  focusFromTasks,
  toActivityEvents,
  toMatterCards,
  toWorkspaceTasks,
} from "@/lib/workspace-adapters";
import {
  CalendarClock,
  ChartColumn,
  ClipboardList,
  History,
  LayoutGrid,
  ListChecks,
  Sparkles,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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
    return <PartnerDashboard supabase={supabase} profile={profile} />;
  }
  if (profile.role === "attorney") {
    return <AttorneyDashboard supabase={supabase} profile={profile} />;
  }
  if (profile.role === "paralegal") {
    return <StaffDashboard supabase={supabase} profile={profile} />;
  }
  if (profile.role === "billing_staff") {
    return <BillingDashboard supabase={supabase} profile={profile} />;
  }
  // Client experiences live on dedicated routes (Potential vs Current).
  // Default authenticated client home is the Current Client portal; Potential Client
  // is opened via View App As → Potential Client (/potential-client).
  redirect("/client-portal");
}

async function PartnerDashboard({
  supabase,
  profile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  profile: Profile;
}) {
  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw);
  const inboxItems = await loadInboxItems(supabase, "managing_partner", profile.id);
  const inboxMeta = inboxMetaForRole("managing_partner");

  const [{ data: matters }, { data: activity }] = await Promise.all([
    supabase
      .from("matters")
      .select("*, clients(*)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("matter_activity")
      .select("*, performer:profiles!matter_activity_performed_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const matterRows = (matters || []) as Matter[];

  const activeMatters = matterRows.filter((m) => m.matter_status === "Active").length;
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

  const pastDueAR = bundle.clients.reduce((s, c) => s + c.pastDueAR, 0);
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

  const { data: evals } = await supabase
    .from("case_evaluations")
    .select("*")
    .order("submitted_at", { ascending: false });
  const evalRows = (evals || []) as CaseEvaluation[];
  const monthStartIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const evalsThisMonth = evalRows.filter((e) => e.submitted_at >= monthStartIso);
  const awaitingPartner = evalRows.filter((e) => e.evaluation_status === "Referred to Partner");

  const focusItems = inboxItemsToFocus(inboxItems, 6);
  const { data: rates } = await supabase
    .from("employee_rates")
    .select("*")
    .eq("active_status", true);
  const dqCount = buildDataQualityExceptions(raw, rates).length;
  const mattersAwaitingInbox = inboxItems.filter((i) => i.kind === "matter_approval").length;
  const invoicesAwaitingInbox = inboxItems.filter((i) => i.kind === "invoice_approval").length;

  return (
    <>
      <PageHeader
        title="Partner Workspace"
        description={`Firm-Wide View · ${profile.full_name} — approvals, collections risk, and firm health.`}
        actions={
          <>
            <Link href="/inbox" className="btn btn-primary btn-sm">
              {inboxMeta.title}
              {inboxItems.length > 0 ? ` (${inboxItems.length})` : ""}
            </Link>
            <Link href="/reports" className="btn btn-outline btn-sm">
              Open reports
            </Link>
          </>
        }
      />

      <section className="space-y-3">
        <SectionHeader
          title="Quick actions"
          description="Start the work you do most often as Managing Partner."
          icon={<LayoutGrid className="h-5 w-5" />}
        />
        <PartnerQuickActions />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Items needing approval"
          value={inboxItems.length}
          tone={inboxItems.length ? "warning" : "success"}
          href="/inbox"
        />
        <StatCard
          label="Past-due AR"
          value={formatCurrency(pastDueAR)}
          tone={pastDueAR ? "error" : "default"}
          href="/ar?bucket=past_due"
        />
        <StatCard
          label="Invoices awaiting approval"
          value={invoicesAwaitingInbox}
          tone={invoicesAwaitingInbox ? "warning" : "default"}
          href="/inbox?kind=invoice_approval"
        />
        <StatCard
          label="Matters awaiting approval"
          value={mattersAwaitingInbox}
          tone={mattersAwaitingInbox ? "warning" : "default"}
          href="/inbox?kind=matter_approval"
        />
        <StatCard
          label="Submitted time to review"
          value={submittedTime}
          tone={submittedTime ? "warning" : "default"}
          href="/time/review"
        />
        <StatCard label="Active matters" value={activeMatters} href="/matters?status=Active" />
        <StatCard
          label="Unbilled approved time"
          value={formatCurrency(unbilledTimeAmt)}
          href="/unbilled"
        />
        {dqCount > 0 && (
          <StatCard
            label="Data quality exceptions"
            value={dqCount}
            tone="warning"
            href="/data-quality"
          />
        )}
        {awaitingPartner.length > 0 && (
          <StatCard
            label="Intake awaiting partner"
            value={awaitingPartner.length}
            tone="warning"
            href="/case-evaluations"
          />
        )}
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Today's focus — approvals"
          description="Pending authority work, prioritized for you."
          icon={<Sparkles className="h-5 w-5" />}
          action={
            <Link href="/inbox" className="btn btn-outline btn-sm">
              Open full inbox
            </Link>
          }
        />
        {focusItems.length === 0 ? (
          <EmptyState
            title="You're clear on approvals"
            description="Nothing is waiting in the Approval Inbox right now."
            action={
              <Link href="/inbox" className="btn btn-primary btn-sm">
                Open Approval Inbox
              </Link>
            }
          />
        ) : (
          <TodaysFocus items={focusItems} />
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Firm pulse"
          description="Cash conversion and contribution at a glance."
          icon={<ChartColumn className="h-5 w-5" />}
          action={
            <Link href="/reports" className="btn btn-outline btn-sm">
              View all analytics →
            </Link>
          }
        />
        <ExecutiveCharts
          variant="compact"
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
      </section>

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
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Client intake
              </h2>
              <Link href="/case-evaluations" className="btn btn-ghost btn-xs">
                View all
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                label="New this month"
                value={evalsThisMonth.length}
                href="/case-evaluations"
              />
              <StatCard
                label="Awaiting partner"
                value={awaitingPartner.length}
                tone={awaitingPartner.length ? "warning" : "default"}
                href="/case-evaluations"
              />
            </div>
            <CaseEvaluationsMiniList
              rows={evalRows.slice(0, 4) as never[]}
              emptyTitle="No case evaluations yet."
            />
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
  const inboxItems = await loadInboxItems(supabase, "attorney", profile.id);
  const inboxMeta = inboxMetaForRole("attorney");
  const { data: matters } = await supabase
    .from("matters")
    .select(
      "*, clients(*), responsible:profiles!matters_responsible_attorney_id_fkey(full_name)"
    )
    .order("updated_at", { ascending: false });
  const matterRows = (matters || []) as Matter[];

  const { data: tasks } = await supabase
    .from("matter_tasks")
    .select("*, matters(id, matter_name, matter_number)")
    .eq("assigned_to", profile.id)
    .order("due_date", { ascending: true });
  const taskRows = (tasks || []) as MatterTask[];

  const [{ data: myTime }, { data: myExp }, { data: retainers }, { data: matterInvoices }, { data: oosQueue }] =
    await Promise.all([
    supabase.from("time_entries").select("*").eq("employee_id", profile.id),
    supabase.from("expense_entries").select("*").eq("created_by", profile.id).order("expense_date", { ascending: false }).limit(5),
    supabase.from("retainer_accounts").select("*, matters(matter_number, matter_name)").in("account_status", ["Below Threshold", "Exhausted"]),
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_status, balance_due, due_date, matter_id, finalized_at")
      .order("due_date", { ascending: false })
      .limit(30),
    supabase
      .from("time_entries")
      .select("id")
      .eq("out_of_scope", true)
      .eq("approval_status", "Submitted"),
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
  const oosToAuthorize = (oosQueue || []).length;
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

  const { data: activityRows } = await supabase
    .from("matter_activity")
    .select(
      "*, performer:profiles!matter_activity_performed_by_fkey(full_name), matters(matter_number)"
    )
    .order("created_at", { ascending: false })
    .limit(8);

  // The schema does not store deadlines, focus items, or an activity stream for
  // every event type yet, so those fall back to the shared workspace fixtures.
  const matterCards = toMatterCards(
    matterRows.filter((m) => ["Active", "Closing", "On Hold"].includes(m.matter_status))
  ).slice(0, 6);
  const workspaceTasks = toWorkspaceTasks(taskRows, profile.full_name);
  const myTasks = workspaceTasks.length > 0 ? workspaceTasks : MOCK_TASKS;
  const realActivity = toActivityEvents(activityRows || []);
  const activityEvents = realActivity.length > 0 ? realActivity : ACTIVITY;
  const liveFocus = focusFromTasks(workspaceTasks);
  const focusItems = liveFocus.length > 0 ? [...liveFocus, ...FOCUS_ITEMS].slice(0, 6) : FOCUS_ITEMS;
  const deadlines = upcomingDeadlines(5);
  const timekeeping = buildTimekeeping(timeRows, avail);
  const dueTodayCount = myTasks.filter(
    (t) => t.lane !== "Completed" && daysUntil(t.dueDate) === 0
  ).length;
  const overdueTaskCount = myTasks.filter(
    (t) => t.lane !== "Completed" && daysUntil(t.dueDate) < 0
  ).length;
  const deadlinesThisWeek = deadlines.filter((d) => daysUntil(d.dueDate) <= 7).length;

  const active = matterRows.filter((m) => m.matter_status === "Active");
  const { items: deadlineItems, today: deadlineToday, end: deadlineEnd } = buildDeadlineWindow({
    tasks: taskRows,
    matters: matterRows,
    days: 14,
  });
  const needsUpdate = matterRows.filter((m) =>
    ["Draft", "Pending Approval", "Needs Review", "On Hold"].includes(m.matter_status) ||
    m.approval_status === "Needs Review"
  );

  const { data: referredEvals } = await supabase
    .from("case_evaluations")
    .select("*")
    .eq("assigned_partner_id", profile.id)
    .order("submitted_at", { ascending: false });
  const referred = (referredEvals || []) as CaseEvaluation[];
  const awaitingRec = referred.filter((e) =>
    ["Referred to Partner", "Under Review"].includes(e.evaluation_status)
  );
  const recentlyConverted = referred.filter((e) => e.converted_matter_id).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Attorney Workspace"
        description="Your day at a glance: deadlines, matters, tasks, documents, and timekeeping."
        actions={
          <>
            <Link href="/inbox" className="btn btn-primary btn-sm">
              {inboxMeta.title}
              {inboxItems.length > 0 ? ` (${inboxItems.length})` : ""}
            </Link>
            <Link href="/time/new" className="btn btn-outline btn-sm">
              Log time
            </Link>
            <Link href="/calendar" className="btn btn-outline btn-sm">
              Open calendar
            </Link>
          </>
        }
      />

      <section className="space-y-3">
        <SectionHeader
          title="Quick actions"
          description="Start the work you do most often."
          icon={<LayoutGrid className="h-5 w-5" />}
        />
        <QuickActions />
      </section>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title text-base">Case evaluations referred to me</h2>
            <Link href="/case-evaluations" className="btn btn-sm btn-outline">
              Open intake queue
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Referred to me" value={referred.length} href="/case-evaluations" />
            <StatCard
              label="Awaiting recommendation"
              value={awaitingRec.length}
              tone={awaitingRec.length ? "warning" : "default"}
              href="/case-evaluations"
            />
            <StatCard
              label="Recently converted matters"
              value={recentlyConverted.length}
              href="/case-evaluations"
            />
          </div>
          <CaseEvaluationsMiniList
            rows={referred.slice(0, 6) as never[]}
            emptyTitle="No evaluations are currently referred to you."
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Items needing attention"
          value={inboxItems.length}
          tone={inboxItems.length ? "warning" : "success"}
          href="/inbox"
        />
        <StatCard label="Active matters" value={active.length} href="/matters" />
        <StatCard
          label="Tasks due today"
          value={dueTodayCount}
          tone={dueTodayCount ? "warning" : "default"}
          href="/tasks?filter=due_soon"
        />
        <StatCard
          label="Overdue tasks"
          value={overdueTaskCount}
          tone={overdueTaskCount ? "error" : "success"}
          href="/tasks?filter=overdue"
        />
        <StatCard
          label="Deadlines within 7 days"
          value={deadlinesThisWeek}
          tone="warning"
          href="/calendar"
        />
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Today's focus"
          description="Everything that needs your attention before the day ends."
          icon={<Sparkles className="h-5 w-5" />}
        />
        <TodaysFocus items={focusItems} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <SectionHeader
              title="Upcoming deadlines"
              description="Your next five dates. Anything within three days is highlighted."
              icon={<CalendarClock className="h-5 w-5" />}
            />
            {deadlines.length === 0 ? (
              <EmptyState
                title="No upcoming deadlines"
                description="Deadlines added to your matters will appear here."
              />
            ) : (
              <ul className="space-y-2 mt-2">
                {deadlines.map((deadline) => (
                  <DeadlineCard key={deadline.id} deadline={deadline} />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <SectionHeader
              title="Recent activity"
              description="What changed across your matters."
              icon={<History className="h-5 w-5" />}
            />
            <ActivityFeed events={activityEvents} />
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="My active matters"
          description="Pin the matters you return to most."
          icon={<LayoutGrid className="h-5 w-5" />}
          action={
            <Link href="/matters" className="btn btn-outline btn-sm">
              View all matters
            </Link>
          }
        />
        <ActiveMattersPanel matters={matterCards} />
      </section>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="My tasks"
            description="Filter by what is due, late, or waiting on someone else."
            icon={<ListChecks className="h-5 w-5" />}
            action={
              <Link href="/tasks?filter=open" className="btn btn-outline btn-sm">
                Open task queue
              </Link>
            }
          />
          <div className="mt-2">
            <MyTasksPanel tasks={myTasks} />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <SectionHeader
            title="Time and billing"
            description="Hours logged, billable progress, and quick entry."
            icon={<Timer className="h-5 w-5" />}
            action={
              <Link href={`/time?from=${weekStart}`} className="btn btn-outline btn-sm">
                View my time
              </Link>
            }
          />
          <div className="mt-2">
            <TimeBillingSummary summary={timekeeping} />
          </div>
        </div>
      </div>

      <SectionHeader
        title="Practice metrics"
        description="Detail behind the summary above, drawn from recorded time and billing data."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hours entered this week"
          value={hoursWeek.toFixed(2)}
          href={`/time?from=${weekStart}`}
        />
        <StatCard
          label="Billable hours this week"
          value={billableWeek.toFixed(2)}
          href={`/time?from=${weekStart}&billable=Billable`}
        />
        <StatCard
          label="Billable hours this month"
          value={billableMonth.toFixed(2)}
          href={`/time?from=${monthIso}&billable=Billable`}
        />
        <StatCard
          label="Utilization estimate (month)"
          value={utilEst == null ? "—" : `${utilEst.toFixed(1)}%`}
          href={`/time?from=${monthIso}`}
        />
        <StatCard label="Draft / unsubmitted time" value={unsubmitted} href="/time?status=Draft" />
        <StatCard
          label="Rejected time entries"
          value={rejectedTime}
          tone={rejectedTime ? "error" : "default"}
          href="/time?status=Rejected"
        />
        <StatCard label="My unbilled approved time" value={formatCurrency(unbilledMine)} href="/time?status=Approved" />
        <StatCard label="Matter invoices (visible)" value={invMine.length} href="/invoices" />
        <StatCard
          label="Past-due balances (visible)"
          value={pastDueMine.length}
          tone={pastDueMine.length ? "error" : "default"}
          href="/invoices"
        />
        <StatCard
          label="Out-of-scope to authorize"
          value={oosToAuthorize}
          tone={oosToAuthorize ? "warning" : "default"}
          href="/time/review"
        />
        <StatCard
          label="Past-due $ (assigned matters)"
          value={formatCurrency(pastDueMine.reduce((s, i) => s + Number(i.balance_due), 0))}
          tone={pastDueMine.length ? "warning" : "default"}
          href="/invoices"
        />
        <StatCard label="Matters with budgets set" value={budgetWarnings.length} href="/matters" />
        <StatCard label="Draft time entries" value={draftTime} href="/time?status=Draft" />
      </div>

      <WeeklyUtilizationCard
        weekStart={weekStart}
        availableHours={avail}
        totalHours={hoursWeek}
        billableHours={billableWeek}
        timeHref={`/time?from=${weekStart}`}
      />
      <p className="text-xs opacity-60 -mt-2">
        Month utilization ({utilEst == null ? "—" : `${utilEst.toFixed(1)}%`}): billable this month ÷
        (available weekly × weeks elapsed). Same available-hours source as the weekly meter above.
      </p>

      <DeadlineCalendar
        items={deadlineItems}
        today={deadlineToday}
        end={deadlineEnd}
        title="Coming up — next 7–14 days"
        emptyTitle="No due tasks, court dates, or filing deadlines in the next 14 days."
      />

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
  const inboxItems = await loadInboxItems(supabase, "paralegal", profile.id);
  const inboxMeta = inboxMetaForRole("paralegal");
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
    .select(
      "id, matter_number, matter_name, matter_status, next_court_date, next_filing_deadline, expected_end_date"
    )
    .order("updated_at", { ascending: false });

  const matterRows = (matters || []) as Matter[];
  const { items: deadlineItems, today: deadlineToday, end: deadlineEnd } = buildDeadlineWindow({
    tasks: taskRows,
    matters: matterRows,
    days: 14,
  });

  const [{ data: myTime }, { data: myExp }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*, matters(id, matter_number, matter_name)")
      .eq("employee_id", profile.id),
    supabase.from("expense_entries").select("id, approval_status").eq("created_by", profile.id),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeRows = (myTime || []) as any[];
  const weekRows = timeRows.filter((t) => t.work_date >= weekStart);
  const hoursWeek = weekRows.reduce((s, t) => s + Number(t.hours), 0);
  const billableWeek = weekRows
    .filter((t) => t.billable_status === "Billable")
    .reduce((s, t) => s + Number(t.hours), 0);
  const draftTime = timeRows.filter((t) => t.approval_status === "Draft").length;
  const rejected = timeRows.filter((t) => t.approval_status === "Rejected").length;
  const oosPending = timeRows.filter(
    (t) => t.out_of_scope && t.approval_status === "Submitted"
  ).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submittedExp = (myExp || []).filter((e: any) => e.approval_status === "Submitted").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableWeekly = Number((profile as any).available_weekly_hours) || 40;

  const hoursByMatterMap = new Map<
    string,
    { id: string; matter_number: string; matter_name: string; hours: number; billable: number }
  >();
  for (const t of weekRows) {
    const mid = String(t.matter_id);
    const existing = hoursByMatterMap.get(mid);
    const h = Number(t.hours) || 0;
    const billableHours = t.billable_status === "Billable" ? h : 0;
    if (existing) {
      existing.hours += h;
      existing.billable += billableHours;
    } else {
      hoursByMatterMap.set(mid, {
        id: t.matters?.id || mid,
        matter_number: t.matters?.matter_number || "—",
        matter_name: t.matters?.matter_name || "Unknown matter",
        hours: h,
        billable: billableHours,
      });
    }
  }
  const hoursByMatter = Array.from(hoursByMatterMap.values()).sort((a, b) => b.hours - a.hours);

  const deadlines = upcomingDeadlines(5);

  const { data: intakeEvals } = await supabase
    .from("case_evaluations")
    .select("*")
    .order("submitted_at", { ascending: false });
  const intake = (intakeEvals || []) as CaseEvaluation[];
  const newEvals = intake.filter((e) => e.evaluation_status === "New");
  const needContact = intake.filter((e) =>
    ["New", "Under Review", "Contact Attempted"].includes(e.evaluation_status)
  );
  const followUpDue = intake.filter((e) => {
    if (!e.follow_up_due_at) return false;
    if (["Accepted", "Declined", "Closed"].includes(e.evaluation_status)) return false;
    return new Date(e.follow_up_due_at).getTime() <= Date.now() + 1000 * 60 * 60 * 24;
  });
  const referredOut = intake.filter((e) => e.evaluation_status === "Referred to Partner");
  const scheduled = intake.filter((e) => e.evaluation_status === "Consultation Scheduled");

  return (
    <>
      <PageHeader
        title="Paralegal/Legal Staff Workspace"
        description="Your assigned tasks, due dates, matter support work, and timekeeping."
        actions={
          <Link href="/inbox" className="btn btn-primary btn-sm">
            {inboxMeta.title}
            {inboxItems.length > 0 ? ` (${inboxItems.length})` : ""}
          </Link>
        }
      />

      <section className="space-y-3">
        <SectionHeader
          title="Quick actions"
          description="Start the work you do most often."
          icon={<LayoutGrid className="h-5 w-5" />}
        />
        <QuickActions />
      </section>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title text-base">New Case Evaluations</h2>
            <Link href="/case-evaluations" className="btn btn-sm btn-primary">
              Intake queue
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="New case evaluations" value={newEvals.length} href="/case-evaluations" />
            <StatCard
              label="Needing contact"
              value={needContact.length}
              tone={needContact.length ? "warning" : "default"}
              href="/case-evaluations"
            />
            <StatCard
              label="Due for follow-up"
              value={followUpDue.length}
              tone={followUpDue.length ? "warning" : "default"}
              href="/case-evaluations"
            />
            <StatCard label="Referred to partners" value={referredOut.length} href="/case-evaluations" />
            <StatCard label="Scheduled consultations" value={scheduled.length} href="/case-evaluations" />
          </div>
          <CaseEvaluationsMiniList
            rows={intake.slice(0, 8) as never[]}
            emptyTitle="No assigned case evaluations yet. Submissions from the Client page appear here."
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Items needing attention"
          value={inboxItems.length}
          tone={inboxItems.length ? "warning" : "success"}
          href="/inbox"
        />
        <StatCard label="Assigned tasks" value={open.length} href="/tasks?filter=open" />
        <StatCard label="Due soon" value={dueSoon.length} tone="warning" href="/tasks?filter=due_soon" />
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "error" : "default"}
          href="/tasks?filter=overdue"
        />
        <StatCard label="Waiting on others" value={waiting.length} href="/tasks?filter=waiting" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hours entered this week"
          value={hoursWeek.toFixed(2)}
          href={`/time?from=${weekStart}`}
        />
        <StatCard label="Draft time entries" value={draftTime} href="/time?status=Draft" />
        <StatCard
          label="Out-of-scope awaiting attorney"
          value={oosPending}
          tone={oosPending ? "warning" : "default"}
          href="/time?status=Submitted&oos=1"
        />
        <StatCard
          label="Rejected entries needing correction"
          value={rejected}
          tone={rejected ? "error" : "default"}
          href="/time?status=Rejected"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Submitted expenses" value={submittedExp} href="/expenses?status=Submitted" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <SectionHeader
              title="Upcoming deadlines"
              description="Your next five dates. Anything within three days is highlighted."
              icon={<CalendarClock className="h-5 w-5" />}
            />
            {deadlines.length === 0 ? (
              <EmptyState
                title="No upcoming deadlines"
                description="Deadlines added to your matters will appear here."
              />
            ) : (
              <ul className="space-y-2 mt-2">
                {deadlines.map((deadline) => (
                  <DeadlineCard key={deadline.id} deadline={deadline} />
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Assigned tasks</h2>
            <TaskMiniList tasks={open} />
          </div>
        </div>
      </div>

      <DeadlineCalendar
        items={deadlineItems}
        today={deadlineToday}
        end={deadlineEnd}
        title="Coming up — next 7–14 days"
        emptyTitle="No due tasks, court dates, or filing deadlines in the next 14 days."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyUtilizationCard
          weekStart={weekStart}
          availableHours={availableWeekly}
          totalHours={hoursWeek}
          billableHours={billableWeek}
          timeHref={`/time?from=${weekStart}`}
        />
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title text-base">Hours by matter this week</h2>
              <Link href={`/time?from=${weekStart}`} className="link text-sm">
                View time
              </Link>
            </div>
            <p className="text-xs opacity-60 -mt-1">
              Week starting {formatDate(weekStart)} · {hoursWeek.toFixed(2)} hrs total
            </p>
            {hoursByMatter.length === 0 ? (
              <EmptyState
                title="No hours entered this week yet."
                action={
                  <Link href="/time/new" className="btn btn-primary btn-sm">
                    Enter time
                  </Link>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Matter</th>
                      <th className="text-right">Total hrs</th>
                      <th className="text-right">Billable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursByMatter.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/matters/${row.id}`} className="link link-hover text-sm">
                            {row.matter_number} · {row.matter_name}
                          </Link>
                        </td>
                        <td className="text-right font-medium">{row.hours.toFixed(2)}</td>
                        <td className="text-right text-sm opacity-80">{row.billable.toFixed(2)}</td>
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
            <h2 className="card-title text-base">Assigned matters</h2>
            {matterRows.length === 0 ? (
              <EmptyState title="You do not currently have any assigned matters." />
            ) : (
              <ul className="space-y-2">
                {matterRows.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 text-sm">
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
  profile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  profile: Profile;
}) {
  const inboxItems = await loadInboxItems(supabase, "billing_staff", profile.id);
  const inboxMeta = inboxMetaForRole("billing_staff");
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
        actions={
          <Link href="/inbox" className="btn btn-primary btn-sm">
            {inboxMeta.title}
            {inboxItems.length > 0 ? ` (${inboxItems.length})` : ""}
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Items needing attention"
          value={inboxItems.length}
          tone={inboxItems.length ? "warning" : "success"}
          href="/inbox"
        />
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
