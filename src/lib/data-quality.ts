/* eslint-disable @typescript-eslint/no-explicit-any */
import { n } from "@/lib/analytics";
import { clientDisplayName } from "@/lib/format";

export type DataQualityException = {
  severity: "high" | "medium" | "low";
  category: string;
  message: string;
  href?: string;
};

/** Shared exception catalog used by /data-quality and Partner Workspace KPI. */
export function buildDataQualityExceptions(
  raw: {
    clients: any[];
    matterRows: any[];
    retainers: any[];
    time: any[];
    expenses: any[];
    invoices: any[];
    journalEntries: any[];
    journalLines: any[];
    profiles: any[];
  },
  rates: any[] | null | undefined
): DataQualityException[] {
  const exceptions: DataQualityException[] = [];

  for (const c of raw.clients) {
    if (!c.billing_email && c.client_status === "Active") {
      exceptions.push({
        severity: "medium",
        category: "Client",
        message: `${clientDisplayName(c)} missing billing email`,
        href: `/clients/${c.id}`,
      });
    }
  }

  const emails = new Map<string, string[]>();
  for (const c of raw.clients) {
    const key = (c.email || c.billing_email || "").toLowerCase();
    if (!key) continue;
    const arr = emails.get(key) || [];
    arr.push(c.id);
    emails.set(key, arr);
  }
  for (const [email, ids] of emails) {
    if (ids.length > 1) {
      exceptions.push({
        severity: "medium",
        category: "Duplicate",
        message: `Duplicate-looking client email: ${email} (${ids.length} records)`,
        href: `/clients/${ids[0]}`,
      });
    }
  }

  for (const m of raw.matterRows) {
    if (["Closed", "Canceled"].includes(m.matter_status)) continue;
    if (!m.responsible_attorney_id) {
      exceptions.push({
        severity: "high",
        category: "Matter",
        message: `${m.matter_number} missing lead attorney`,
        href: `/matters/${m.id}`,
      });
    }
    if (m.matter_status === "Active" && m.approval_status !== "Approved") {
      exceptions.push({
        severity: "high",
        category: "Matter",
        message: `${m.matter_number} active without approved terms`,
        href: `/matters/${m.id}`,
      });
    }
    if (m.matter_status === "Active" && !m.billing_method) {
      exceptions.push({
        severity: "high",
        category: "Billing",
        message: `${m.matter_number} missing billing method`,
        href: `/matters/${m.id}`,
      });
    }
    if (
      m.matter_status === "Active" &&
      (m.billing_method === "Hourly" || m.billing_method === "Retainer-Funded Hourly") &&
      !m.hourly_rate
    ) {
      exceptions.push({
        severity: "medium",
        category: "Billing",
        message: `${m.matter_number} hourly matter missing default rate`,
        href: `/matters/${m.id}`,
      });
    }
    if (
      m.matter_status === "Active" &&
      (m.billing_method === "Retainer-Funded Hourly" || n(m.initial_retainer_amount) > 0) &&
      !raw.retainers.some((r: any) => r.matter_id === m.id)
    ) {
      exceptions.push({
        severity: "high",
        category: "Retainer",
        message: `${m.matter_number} should have a retainer account`,
        href: `/retainers`,
      });
    }
    if (
      ["Hourly", "Fixed Fee", "Retainer-Funded Hourly"].includes(m.billing_method || "") &&
      (m.matter_budget == null || n(m.matter_budget) <= 0) &&
      m.matter_status === "Active"
    ) {
      exceptions.push({
        severity: "low",
        category: "Budget",
        message: `${m.matter_number} missing expected budget`,
        href: `/matters/${m.id}`,
      });
    }
  }

  for (const r of raw.retainers) {
    if (r.account_status === "Below Threshold" || r.account_status === "Exhausted") {
      const m = raw.matterRows.find((x: any) => x.id === r.matter_id);
      exceptions.push({
        severity: r.account_status === "Exhausted" ? "high" : "medium",
        category: "Retainer",
        message: `Retainer ${r.account_status} on ${m?.matter_number || r.matter_id}`,
        href: "/retainers",
      });
    }
  }

  for (const t of raw.time) {
    if (t.approval_status === "Approved" && t.billable_status === "Billable" && !t.billing_description) {
      exceptions.push({
        severity: "medium",
        category: "Time",
        message: `Approved time missing billing description (${t.work_date})`,
        href: "/time/review",
      });
    }
  }

  const timeKey = new Map<string, number>();
  for (const t of raw.time) {
    const k = `${t.employee_id}|${t.matter_id}|${t.work_date}|${t.hours}`;
    timeKey.set(k, (timeKey.get(k) || 0) + 1);
  }
  for (const [k, cnt] of timeKey) {
    if (cnt > 1) {
      exceptions.push({
        severity: "medium",
        category: "Duplicate",
        message: `Possible duplicate time entries (${cnt}×): ${k.split("|")[2]}`,
        href: "/time/review",
      });
    }
  }

  for (const e of raw.expenses) {
    if (e.approval_status === "Approved" && n(e.amount) >= 75 && !e.receipt_reference) {
      exceptions.push({
        severity: "medium",
        category: "Expense",
        message: `Approved expense ≥$75 missing receipt reference`,
        href: "/expenses/review",
      });
    }
  }

  const expKey = new Map<string, number>();
  for (const e of raw.expenses) {
    const k = `${e.matter_id}|${e.expense_date}|${e.amount}|${e.vendor_name || ""}`;
    expKey.set(k, (expKey.get(k) || 0) + 1);
  }
  for (const [, cnt] of expKey) {
    if (cnt > 1) {
      exceptions.push({
        severity: "low",
        category: "Duplicate",
        message: `Possible duplicate expenses (${cnt} matching amount/date/matter)`,
        href: "/expenses/review",
      });
    }
  }

  for (const inv of raw.invoices) {
    if (inv.finalized_at && inv.invoice_date && inv.due_date && inv.due_date < inv.invoice_date) {
      exceptions.push({
        severity: "high",
        category: "Invoice",
        message: `${inv.invoice_number} due date before invoice date`,
        href: `/invoices/${inv.id}`,
      });
    }
    if (
      inv.finalized_at &&
      n(inv.balance_due) > 0 &&
      inv.due_date < new Date().toISOString().slice(0, 10) &&
      inv.invoice_status !== "Disputed"
    ) {
      exceptions.push({
        severity: "medium",
        category: "Collection",
        message: `${inv.invoice_number} past due — review collection follow-up`,
        href: `/invoices/${inv.id}`,
      });
    }
  }

  {
    const byNumber = new Map<string, { id: string; invoice_number: string }[]>();
    for (const inv of raw.invoices) {
      const key = String(inv.invoice_number || "")
        .trim()
        .toUpperCase();
      if (!key) continue;
      const list = byNumber.get(key) || [];
      list.push({ id: inv.id, invoice_number: inv.invoice_number });
      byNumber.set(key, list);
    }
    for (const [, list] of byNumber) {
      if (list.length < 2) continue;
      exceptions.push({
        severity: "high",
        category: "Duplicate",
        message: `Duplicate invoice number ${list[0].invoice_number} used on ${list.length} invoices`,
        href: `/invoices/${list[0].id}`,
      });
    }
  }

  const byJe = new Map<string, { d: number; c: number; status: string; num: string }>();
  for (const j of raw.journalEntries) {
    byJe.set(j.id, { d: 0, c: 0, status: j.posting_status, num: j.journal_entry_number });
  }
  for (const l of raw.journalLines) {
    const row = byJe.get(l.journal_entry_id);
    if (!row) continue;
    row.d += n(l.debit_amount);
    row.c += n(l.credit_amount);
  }
  for (const [, row] of byJe) {
    if (Math.abs(row.d - row.c) > 0.01 && row.status === "Draft") {
      exceptions.push({
        severity: "high",
        category: "Journal",
        message: `Unbalanced draft journal ${row.num}`,
        href: "/journal",
      });
    }
  }

  for (const p of raw.profiles.filter(
    (x: any) => ["attorney", "paralegal", "managing_partner"].includes(x.role) && x.active_status
  )) {
    if (!(rates || []).some((r: any) => r.user_id === p.id && r.active_status)) {
      exceptions.push({
        severity: "high",
        category: "Rates",
        message: `${p.full_name} missing current rate card`,
        href: "/data-quality",
      });
    }
  }

  for (const m of raw.matterRows) {
    if (!m.matter_budget || n(m.matter_budget) <= 0) continue;
    const labor = raw.time
      .filter((t: any) => t.matter_id === m.id && t.approval_status === "Approved")
      .reduce((s: number, t: any) => s + n(t.hours) * n(t.internal_cost_rate), 0);
    const exp = raw.expenses
      .filter((e: any) => e.matter_id === m.id && e.approval_status === "Approved")
      .reduce((s: number, e: any) => s + n(e.amount), 0);
    if (labor + exp > n(m.matter_budget)) {
      exceptions.push({
        severity: "high",
        category: "Budget",
        message: `${m.matter_number} over cost budget`,
        href: `/matters/${m.id}`,
      });
    }
  }

  exceptions.sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return o[a.severity] - o[b.severity];
  });

  return exceptions;
}
