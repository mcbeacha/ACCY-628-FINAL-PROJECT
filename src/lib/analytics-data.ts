/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  MatterMetrics,
  ClientMetrics,
  PracticeMetrics,
  AttorneyMetrics,
  n,
  profitabilityStatus,
  marginPct,
  weeksInRange,
  monthKey,
  arBucket,
} from "./analytics";
import { clientDisplayName } from "./format";

function isFinalInvoice(inv: any) {
  return !!inv.finalized_at && inv.invoice_status !== "Canceled" && inv.invoice_status !== "Draft";
}

function budgetFlag(
  budget: number | null,
  consumed: number,
  expectBudget: boolean
): MatterMetrics["budgetFlag"] {
  if (budget == null || budget <= 0) {
    return expectBudget ? "Missing Budget" : "No Budget";
  }
  const pct = consumed / budget;
  if (pct > 1) return "Over Budget";
  if (pct >= 0.8) return "Near Budget";
  return "OK";
}

export type AnalyticsBundle = {
  matters: MatterMetrics[];
  clients: ClientMetrics[];
  practices: PracticeMetrics[];
  attorneys: AttorneyMetrics[];
  monthly: { month: string; invoiced: number; collected: number }[];
  arAging: { bucket: string; amount: number }[];
  revenueByMethod: { method: string; revenue: number }[];
  writeTrend: { month: string; writeDowns: number; writeOffs: number }[];
  daysToPaySamples: { invoiceId: string; clientId: string; days: number }[];
  raw: {
    invoices: any[];
    time: any[];
    expenses: any[];
    tasks: any[];
    retainers: any[];
    payments: any[];
    paymentApps: any[];
    writeOffs: any[];
    journalEntries: any[];
    journalLines: any[];
    profiles: any[];
    clients: any[];
    matterRows: any[];
    financialActivity: any[];
  };
};

export type AnalyticsFilters = {
  from?: string | null;
  to?: string | null;
};

function inDate(d: string | null | undefined, from?: string | null, to?: string | null) {
  if (!d) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function computeAnalytics(
  data: {
    matterRows: any[];
    clients: any[];
    profiles: any[];
    time: any[];
    expenses: any[];
    invoices: any[];
    retainers: any[];
    tasks: any[];
    payments: any[];
    paymentApps: any[];
    writeOffs: any[];
    journalEntries?: any[];
    journalLines?: any[];
    financialActivity?: any[];
    invoiceLines?: any[];
    matterCostEntries?: any[];
  },
  filters: AnalyticsFilters = {}
): AnalyticsBundle {
  const { from, to } = filters;
  const clientMap = new Map(data.clients.map((c) => [c.id, c]));
  const profileMap = new Map(data.profiles.map((p) => [p.id, p]));
  const lineByInv = new Map<string, any[]>();
  for (const l of data.invoiceLines || []) {
    const arr = lineByInv.get(l.invoice_id) || [];
    arr.push(l);
    lineByInv.set(l.invoice_id, arr);
  }

  const timeF = data.time.filter((t) => inDate(t.work_date, from, to));
  const expF = data.expenses.filter((e) => inDate(e.expense_date, from, to));
  const invF = data.invoices.filter((i) => inDate(i.invoice_date, from, to));
  const costF = (data.matterCostEntries || []).filter((c) =>
    inDate(c.cost_date, from, to)
  );
  const woF = data.writeOffs.filter((w) => inDate(w.write_off_date || w.created_at?.slice(0, 10), from, to));

  // Payment applications for days-to-pay (use all for paid samples when payment in range)
  const payMap = new Map(data.payments.map((p) => [p.id, p]));

  const matters: MatterMetrics[] = data.matterRows.map((m) => {
    const client = clientMap.get(m.client_id);
    const resp = m.responsible_attorney_id ? profileMap.get(m.responsible_attorney_id) : null;
    const mTime = timeF.filter((t) => t.matter_id === m.id && t.approval_status === "Approved");
    const approvedHours = mTime.reduce((s, t) => s + n(t.hours), 0);
    const billableHours = mTime
      .filter((t) => t.billable_status === "Billable")
      .reduce((s, t) => s + n(t.hours), 0);
    const billableValue = mTime
      .filter((t) => t.billable_status === "Billable")
      .reduce((s, t) => s + n(t.hours) * n(t.billing_rate), 0);
    const standardBillableValue = billableValue;
    const laborCost = mTime.reduce((s, t) => s + n(t.hours) * n(t.internal_cost_rate), 0);

    const mExp = expF.filter((e) => e.matter_id === m.id && e.approval_status === "Approved");
    const reimbursableExpense = mExp
      .filter((e) => e.client_reimbursable)
      .reduce((s, e) => s + n(e.amount), 0);
    const nonreimbursableExpense = mExp
      .filter((e) => !e.client_reimbursable)
      .reduce((s, e) => s + n(e.amount), 0);
    const mCosts = costF.filter(
      (c) => c.matter_id === m.id && c.approval_status === "Approved"
    );
    const vendorAndOtherCost = mCosts
      .filter((c) => c.cost_source !== "Allocation")
      .reduce((s, c) => s + n(c.total_cost), 0);
    const allocatedCost = mCosts
      .filter((c) => c.cost_source === "Allocation")
      .reduce((s, c) => s + n(c.total_cost), 0);
    const directExpense = reimbursableExpense + nonreimbursableExpense + vendorAndOtherCost;

    const mInv = invF.filter((i) => i.matter_id === m.id && isFinalInvoice(i));
    let invoicedRevenue = 0;
    let invoicedFees = 0;
    let collectedRevenue = 0;
    let collectedFees = 0;
    let outstandingAR = 0;
    let writeDowns = 0;
    for (const inv of mInv) {
      invoicedRevenue += n(inv.invoice_total);
      writeDowns += n(inv.write_down_total);
      collectedRevenue += n(inv.payments_applied) + n(inv.retainer_applied);
      outstandingAR += Math.max(0, n(inv.balance_due));
      const lines = lineByInv.get(inv.id) || [];
      const feeLines = lines.filter((l) =>
        ["Time", "Fixed Fee", "Other", "Adjustment"].includes(l.line_type)
      );
      const feeAmt = feeLines.length
        ? feeLines.reduce((s, l) => s + n(l.final_amount), 0)
        : Math.max(0, n(inv.invoice_total) - n(inv.expense_total));
      invoicedFees += feeAmt;
      // allocate collected to fees proportionally
      const invCollected = n(inv.payments_applied) + n(inv.retainer_applied);
      if (n(inv.invoice_total) > 0) {
        collectedFees += invCollected * (feeAmt / n(inv.invoice_total));
      }
    }

    const writeOffs = woF
      .filter((w) => w.matter_id === m.id && w.approval_status === "Approved")
      .reduce((s, w) => s + n(w.amount), 0);

    const retainerBalance = data.retainers
      .filter((r) => r.matter_id === m.id)
      .reduce((s, r) => s + n(r.current_balance), 0);

    // hours billed from billed time entries (any date filter use invoice status Billed)
    const hoursBilled = data.time
      .filter(
        (t) =>
          t.matter_id === m.id &&
          t.approval_status === "Approved" &&
          t.invoice_status === "Billed" &&
          inDate(t.work_date, from, to)
      )
      .reduce((s, t) => s + n(t.hours), 0);

    const grossProfit = invoicedRevenue - laborCost - directExpense - allocatedCost;
    const cashProfit = collectedRevenue - laborCost - directExpense - allocatedCost;
    const gMargin = marginPct(grossProfit, invoicedRevenue);
    const hasActivity =
      approvedHours > 0 ||
      directExpense > 0 ||
      invoicedRevenue > 0 ||
      m.matter_status === "Active";
    const budget = m.matter_budget != null ? n(m.matter_budget) : null;
    const budgetConsumed = laborCost + directExpense + allocatedCost;
    const expectBudget = ["Hourly", "Retainer-Funded Hourly", "Fixed Fee"].includes(
      m.billing_method || ""
    );

    return {
      matterId: m.id,
      matterNumber: m.matter_number,
      matterName: m.matter_name,
      clientId: m.client_id,
      clientName: clientDisplayName(client) || "—",
      practiceArea: m.practice_area || "Other",
      responsibleId: m.responsible_attorney_id,
      responsibleName: resp?.full_name || "Unassigned",
      billingMethod: m.billing_method || "Not set",
      matterStatus: m.matter_status,
      budget,
      approvedHours,
      billableHours,
      billableValue,
      standardBillableValue,
      invoicedRevenue,
      invoicedFees,
      collectedRevenue,
      collectedFees,
      directLaborCost: laborCost,
      directExpense,
      reimbursableExpense,
      nonreimbursableExpense,
      grossProfit,
      grossMargin: gMargin,
      cashProfit,
      outstandingAR,
      writeDowns,
      writeOffs,
      retainerBalance,
      budgetConsumed,
      budgetRemaining: budget != null ? budget - budgetConsumed : null,
      budgetVariance: budget != null ? budget - budgetConsumed : null,
      budgetFlag: budgetFlag(budget, budgetConsumed, expectBudget),
      profitStatus: profitabilityStatus(invoicedRevenue, grossProfit, hasActivity),
      billingRealization:
        standardBillableValue > 0 ? (invoicedFees / standardBillableValue) * 100 : null,
      collectionRealization:
        invoicedFees > 0 ? (collectedFees / invoicedFees) * 100 : null,
      collectionRate:
        invoicedRevenue > 0 ? (collectedRevenue / invoicedRevenue) * 100 : null,
      // preserve hoursBilled via optional field by stuffing in approved - actually add to type
      // use billableHours separately; hours billed tracked in attorney metrics
    } as MatterMetrics & { hoursBilled?: number };
  });

  // attach hours billed - extend type quietly
  matters.forEach((mm, i) => {
    const m = data.matterRows[i];
    (mm as any).hoursBilled = data.time
      .filter(
        (t) =>
          t.matter_id === m.id &&
          t.approval_status === "Approved" &&
          t.invoice_status === "Billed" &&
          inDate(t.work_date, from, to)
      )
      .reduce((s, t) => s + n(t.hours), 0);
  });

  // Clients
  const clientIds = [...new Set(data.matterRows.map((m) => m.client_id))];
  const clients: ClientMetrics[] = clientIds.map((cid) => {
    const ms = matters.filter((m) => m.clientId === cid);
    const client = clientMap.get(cid);
    const invs = invF.filter((i) => i.client_id === cid && isFinalInvoice(i));
    const pastDueAR = invs
      .filter((i) => n(i.balance_due) > 0 && arBucket(i.due_date, n(i.balance_due), i.invoice_status) !== "Current" && arBucket(i.due_date, n(i.balance_due), i.invoice_status) !== "Settled")
      .reduce((s, i) => s + n(i.balance_due), 0);
    const paidSamples = daysToPayForClient(cid, data.invoices, data.paymentApps, payMap);
    const avgDays =
      paidSamples.length > 0
        ? paidSamples.reduce((s, d) => s + d.days, 0) / paidSamples.length
        : null;
    const rev = ms.reduce((s, m) => s + m.invoicedRevenue, 0);
    const gp = ms.reduce((s, m) => s + m.grossProfit, 0);
    return {
      clientId: cid,
      clientName: clientDisplayName(client) || "—",
      activeMatters: ms.filter((m) => m.matterStatus === "Active").length,
      matterCount: ms.length,
      invoicedRevenue: rev,
      collectedRevenue: ms.reduce((s, m) => s + m.collectedRevenue, 0),
      outstandingAR: ms.reduce((s, m) => s + m.outstandingAR, 0),
      pastDueAR,
      directLaborCost: ms.reduce((s, m) => s + m.directLaborCost, 0),
      directExpense: ms.reduce((s, m) => s + m.directExpense, 0),
      grossProfit: gp,
      grossMargin: marginPct(gp, rev),
      writeDowns: ms.reduce((s, m) => s + m.writeDowns, 0),
      writeOffs: ms.reduce((s, m) => s + m.writeOffs, 0),
      retainerBalance: ms.reduce((s, m) => s + m.retainerBalance, 0),
      avgDaysToPay: avgDays,
      profitStatus: profitabilityStatus(rev, gp, ms.some((m) => m.approvedHours > 0 || m.invoicedRevenue > 0)),
    };
  });

  // Practice areas
  const practicesMap = new Map<string, MatterMetrics[]>();
  for (const m of matters) {
    const arr = practicesMap.get(m.practiceArea) || [];
    arr.push(m);
    practicesMap.set(m.practiceArea, arr);
  }
  const practices: PracticeMetrics[] = [...practicesMap.entries()].map(([pa, ms]) => {
    const rev = ms.reduce((s, m) => s + m.invoicedRevenue, 0);
    const gp = ms.reduce((s, m) => s + m.grossProfit, 0);
    const wd = ms.reduce((s, m) => s + m.writeDowns, 0);
    const wo = ms.reduce((s, m) => s + m.writeOffs, 0);
    const clientIdsP = [...new Set(ms.map((m) => m.clientId))];
    const daysArr: number[] = [];
    for (const cid of clientIdsP) {
      daysToPayForClient(cid, data.invoices, data.paymentApps, payMap).forEach((d) =>
        daysArr.push(d.days)
      );
    }
    return {
      practiceArea: pa,
      matterCount: ms.length,
      totalHours: ms.reduce((s, m) => s + m.approvedHours, 0),
      invoicedRevenue: rev,
      collectedRevenue: ms.reduce((s, m) => s + m.collectedRevenue, 0),
      laborCost: ms.reduce((s, m) => s + m.directLaborCost, 0),
      directExpense: ms.reduce((s, m) => s + m.directExpense, 0),
      grossProfit: gp,
      grossMargin: marginPct(gp, rev),
      avgMatterValue: ms.length ? rev / ms.length : 0,
      avgDaysToPay:
        daysArr.length > 0 ? daysArr.reduce((a, b) => a + b, 0) / daysArr.length : null,
      writeDownPct: rev > 0 ? (wd / (rev + wd)) * 100 : null,
      writeOffPct: rev > 0 ? (wo / rev) * 100 : null,
    };
  });

  // Attorneys
  const timekeepers = data.profiles.filter((p) =>
    ["managing_partner", "attorney", "paralegal"].includes(p.role)
  );
  const weeks = weeksInRange(from || null, to || null);
  const attorneys: AttorneyMetrics[] = timekeepers.map((p) => {
    const tAll = timeF.filter((t) => t.employee_id === p.id);
    const tAppr = tAll.filter((t) => t.approval_status === "Approved");
    const billableHours = tAppr
      .filter((t) => t.billable_status === "Billable")
      .reduce((s, t) => s + n(t.hours), 0);
    const nonbillableHours = tAppr
      .filter((t) => t.billable_status !== "Billable")
      .reduce((s, t) => s + n(t.hours), 0);
    const approvedHours = tAppr.reduce((s, t) => s + n(t.hours), 0);
    const totalHours = tAll.reduce((s, t) => s + n(t.hours), 0);
    const hoursBilled = tAppr
      .filter((t) => t.invoice_status === "Billed")
      .reduce((s, t) => s + n(t.hours), 0);
    const billableValue = tAppr
      .filter((t) => t.billable_status === "Billable")
      .reduce((s, t) => s + n(t.hours) * n(t.billing_rate), 0);
    const laborCost = tAppr.reduce((s, t) => s + n(t.hours) * n(t.internal_cost_rate), 0);
    // invoiced/collected from matters they own as responsible
    const owned = matters.filter((m) => m.responsibleId === p.id);
    const invoicedValue = owned.reduce((s, m) => s + m.invoicedFees, 0);
    const collectedValue = owned.reduce((s, m) => s + m.collectedFees, 0);
    const assignedActiveMatters = data.matterRows.filter(
      (m) =>
        m.matter_status === "Active" &&
        (m.responsible_attorney_id === p.id ||
          /* assignments not passed — use responsible only */ false)
    ).length;
    // better count: assignments via matter responsible + any matter with their time
    const matterIdsWithTime = new Set(tAll.map((t) => t.matter_id));
    const activeAssigned = data.matterRows.filter(
      (m) =>
        m.matter_status === "Active" &&
        (m.responsible_attorney_id === p.id || matterIdsWithTime.has(m.id))
    ).length;

    const openTasks = data.tasks.filter(
      (t) =>
        t.assigned_to === p.id && !["Completed", "Canceled"].includes(t.task_status)
    );
    const overdueTasks = openTasks.filter((t) => {
      if (!t.due_date) return false;
      return new Date(`${t.due_date}T00:00:00`) < new Date(new Date().toDateString());
    });

    const availWeekly = n(p.available_weekly_hours) || 40;
    const available = availWeekly * weeks;
    const utilization = available > 0 ? (billableHours / available) * 100 : null;
    const billedFeeValue = tAppr
      .filter((t) => t.invoice_status === "Billed" && t.billable_status === "Billable")
      .reduce((s, t) => s + n(t.hours) * n(t.billing_rate), 0);

    return {
      userId: p.id,
      fullName: p.full_name,
      role: p.role,
      availableWeeklyHours: availWeekly,
      totalHours,
      approvedHours,
      billableHours,
      nonbillableHours,
      hoursBilled,
      billableValue,
      invoicedValue,
      collectedValue,
      laborCost,
      assignedActiveMatters: Math.max(assignedActiveMatters, activeAssigned),
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      utilization,
      billingRealization:
        billableValue > 0 && billedFeeValue >= 0
          ? (billedFeeValue / Math.max(billableValue, 0.0001)) * 100
          : billableValue > 0
            ? (invoicedValue / billableValue) * 100
            : null,
    };
  });

  // Charts
  const monthMap = new Map<string, { invoiced: number; collected: number }>();
  for (const inv of invF.filter(isFinalInvoice)) {
    const mk = monthKey(inv.invoice_date);
    const row = monthMap.get(mk) || { invoiced: 0, collected: 0 };
    row.invoiced += n(inv.invoice_total);
    row.collected += n(inv.payments_applied) + n(inv.retainer_applied);
    monthMap.set(mk, row);
  }
  // also count payments by payment date for collected trend optional - keep invoice basis
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  const agingMap = new Map<string, number>();
  for (const inv of data.invoices.filter(isFinalInvoice)) {
    const bal = n(inv.balance_due);
    if (bal <= 0) continue;
    const b = arBucket(inv.due_date, bal, inv.invoice_status);
    if (b === "Settled") continue;
    agingMap.set(b, (agingMap.get(b) || 0) + bal);
  }
  const order = ["Current", "1–30", "31–60", "61–90", "90+"];
  const arAging = order.map((bucket) => ({ bucket, amount: agingMap.get(bucket) || 0 }));

  const methodMap = new Map<string, number>();
  for (const m of matters) {
    methodMap.set(m.billingMethod, (methodMap.get(m.billingMethod) || 0) + m.invoicedRevenue);
  }
  const revenueByMethod = [...methodMap.entries()].map(([method, revenue]) => ({
    method,
    revenue,
  }));

  const wTrend = new Map<string, { writeDowns: number; writeOffs: number }>();
  for (const inv of invF) {
    const mk = monthKey(inv.invoice_date);
    const row = wTrend.get(mk) || { writeDowns: 0, writeOffs: 0 };
    row.writeDowns += n(inv.write_down_total);
    wTrend.set(mk, row);
  }
  for (const w of woF.filter((x) => x.approval_status === "Approved")) {
    const mk = monthKey((w.write_off_date || w.created_at || "").slice(0, 10) || "2026-01");
    const row = wTrend.get(mk) || { writeDowns: 0, writeOffs: 0 };
    row.writeOffs += n(w.amount);
    wTrend.set(mk, row);
  }
  const writeTrend = [...wTrend.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  const daysToPaySamples: { invoiceId: string; clientId: string; days: number }[] = [];
  for (const c of clients) {
    daysToPaySamples.push(...daysToPayForClient(c.clientId, data.invoices, data.paymentApps, payMap));
  }

  return {
    matters,
    clients,
    practices,
    attorneys,
    monthly,
    arAging,
    revenueByMethod,
    writeTrend,
    daysToPaySamples,
    raw: {
      invoices: data.invoices,
      time: data.time,
      expenses: data.expenses,
      tasks: data.tasks,
      retainers: data.retainers,
      payments: data.payments,
      paymentApps: data.paymentApps,
      writeOffs: data.writeOffs,
      journalEntries: data.journalEntries || [],
      journalLines: data.journalLines || [],
      profiles: data.profiles,
      clients: data.clients,
      matterRows: data.matterRows,
      financialActivity: data.financialActivity || [],
    },
  };
}

function daysToPayForClient(
  clientId: string,
  invoices: any[],
  apps: any[],
  payMap: Map<string, any>
): { invoiceId: string; clientId: string; days: number }[] {
  const result: { invoiceId: string; clientId: string; days: number }[] = [];
  const invs = invoices.filter(
    (i) => i.client_id === clientId && isFinalInvoice(i) && (i.invoice_status === "Paid" || n(i.payments_applied) > 0)
  );
  for (const inv of invs) {
    const invApps = apps.filter((a) => a.invoice_id === inv.id);
    let lastPay: string | null = null;
    for (const a of invApps) {
      const p = payMap.get(a.payment_id);
      if (p && p.payment_status === "Posted" && p.payment_date) {
        if (!lastPay || p.payment_date > lastPay) lastPay = p.payment_date;
      }
    }
    if (!lastPay && inv.finalized_at) continue;
    if (!lastPay) continue;
    const d0 = new Date(`${inv.invoice_date}T00:00:00`).getTime();
    const d1 = new Date(`${lastPay}T00:00:00`).getTime();
    const days = Math.round((d1 - d0) / (1000 * 60 * 60 * 24));
    if (days >= 0) result.push({ invoiceId: inv.id, clientId, days });
  }
  return result;
}

/** Load analytics inputs via Supabase client (RLS applies). */
export async function loadAnalyticsData(supabase: any) {
  const [
    { data: matterRows },
    { data: clients },
    { data: profiles },
    { data: time },
    { data: expenses },
    { data: invoices },
    { data: retainers },
    { data: tasks },
    { data: payments },
    { data: paymentApps },
    { data: writeOffs },
    { data: invoiceLines },
    { data: journalEntries },
    { data: journalLines },
    { data: financialActivity },
    { data: matterCostEntries },
  ] = await Promise.all([
    supabase.from("matters").select("*").order("matter_number"),
    supabase.from("clients").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("time_entries").select("*"),
    supabase.from("expense_entries").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("retainer_accounts").select("*"),
    supabase.from("matter_tasks").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("payment_applications").select("*"),
    supabase.from("write_offs").select("*"),
    supabase.from("invoice_lines").select("*"),
    supabase.from("journal_entries").select("*"),
    supabase.from("journal_entry_lines").select("*"),
    supabase.from("financial_activity").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("matter_cost_entries").select("*"),
  ]);

  return {
    matterRows: matterRows || [],
    clients: clients || [],
    profiles: profiles || [],
    time: time || [],
    expenses: expenses || [],
    invoices: invoices || [],
    retainers: retainers || [],
    tasks: tasks || [],
    payments: payments || [],
    paymentApps: paymentApps || [],
    writeOffs: writeOffs || [],
    invoiceLines: invoiceLines || [],
    journalEntries: journalEntries || [],
    journalLines: journalLines || [],
    financialActivity: financialActivity || [],
    matterCostEntries: matterCostEntries || [],
  };
}
