import ExcelJS from "exceljs";
import type { MatterMetrics } from "@/lib/analytics";
import { arBucket } from "@/lib/analytics";
import { clientDisplayName } from "@/lib/format";
import { calcBillableAmount } from "@/lib/phase2-types";
import type { Client } from "@/lib/types";

type MatterRow = {
  matter_number?: string;
  matter_name?: string;
};

type TimeEntryRow = {
  work_date: string;
  hours: number;
  billing_rate: number;
  billable_status: string;
  approval_status: string;
  invoice_status: string;
  billing_code?: string | null;
  billing_description?: string | null;
  matters?: MatterRow | MatterRow[] | null;
};

type InvoiceRow = {
  invoice_number: string;
  due_date: string;
  balance_due: number;
  invoice_status: string;
  finalized_at?: string | null;
  matter_id?: string | null;
  matters?: MatterRow | MatterRow[] | null;
};

function matterLabel(matters: TimeEntryRow["matters"] | InvoiceRow["matters"]) {
  const m = Array.isArray(matters) ? matters[0] : matters;
  if (!m) return "—";
  const num = m.matter_number || "";
  const name = m.matter_name || "";
  if (num && name) return `${num} · ${name}`;
  return num || name || "—";
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row.map((v) => (v === null || v === undefined ? "" : v)));
  }
  sheet.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = Math.min(len + 2, 40);
    });
    col.width = max;
  });
  return sheet;
}

function matterBaseCols(m: MatterMetrics) {
  return [m.matterNumber, m.matterName, m.clientName, m.practiceArea];
}

const MATTER_BASE_HEADERS = ["Matter #", "Matter name", "Client", "Practice area"];

export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildAttorneyMetricsWorkbook(input: {
  matters: MatterMetrics[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoices: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matterRows: any[];
  myTime: TimeEntryRow[];
  /** Sheet title for time entries ("My Time" for attorney, "Time Entries" for firm-wide). */
  timeSheetTitle?: string;
}): ExcelJS.Workbook {
  const { matters, invoices, matterRows, myTime } = input;
  const timeSheetTitle = input.timeSheetTitle ?? "My Time";
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rebel Law Group";
  workbook.created = new Date();

  const matterById = new Map(matterRows.map((m) => [m.id as string, m]));

  addSheet(
    workbook,
    "Invoiced Revenue",
    [...MATTER_BASE_HEADERS, "Invoiced revenue"],
    matters.map((m) => [...matterBaseCols(m), m.invoicedRevenue])
  );

  addSheet(
    workbook,
    "Collected Revenue",
    [...MATTER_BASE_HEADERS, "Collected revenue"],
    matters.map((m) => [...matterBaseCols(m), m.collectedRevenue])
  );

  addSheet(
    workbook,
    "Outstanding AR",
    [...MATTER_BASE_HEADERS, "Outstanding AR"],
    matters.map((m) => [...matterBaseCols(m), m.outstandingAR])
  );

  // Past-due AR by matter from finalized invoices with past-due balance
  const pastDueByMatter = new Map<
    string,
    { amount: number; matterNumber: string; matterName: string; clientName: string; practiceArea: string }
  >();
  for (const inv of invoices) {
    if (!inv.finalized_at || inv.invoice_status === "Canceled" || inv.invoice_status === "Draft") continue;
    const bal = Number(inv.balance_due) || 0;
    if (bal <= 0) continue;
    const bucket = arBucket(inv.due_date, bal, inv.invoice_status);
    if (bucket === "Current" || bucket === "Settled") continue;
    const matterId = inv.matter_id as string | null;
    if (!matterId) continue;
    const metrics = matters.find((m) => m.matterId === matterId);
    const rawMatter = matterById.get(matterId);
    const key = matterId;
    const existing = pastDueByMatter.get(key);
    const amount = (existing?.amount || 0) + bal;
    pastDueByMatter.set(key, {
      amount,
      matterNumber: metrics?.matterNumber || rawMatter?.matter_number || "—",
      matterName: metrics?.matterName || rawMatter?.matter_name || "—",
      clientName: metrics?.clientName || "—",
      practiceArea: metrics?.practiceArea || rawMatter?.practice_area || "—",
    });
  }

  addSheet(
    workbook,
    "Past-Due AR",
    [...MATTER_BASE_HEADERS, "Past-due AR"],
    [...pastDueByMatter.values()].map((r) => [
      r.matterNumber,
      r.matterName,
      r.clientName,
      r.practiceArea,
      r.amount,
    ])
  );

  addSheet(
    workbook,
    "Gross Profit",
    [...MATTER_BASE_HEADERS, "Gross profit"],
    matters.map((m) => [...matterBaseCols(m), m.grossProfit])
  );

  addSheet(
    workbook,
    "Gross Margin",
    [...MATTER_BASE_HEADERS, "Gross margin %"],
    matters.map((m) => [
      ...matterBaseCols(m),
      m.grossMargin == null ? "" : Math.round(m.grossMargin * 100) / 100,
    ])
  );

  addSheet(
    workbook,
    timeSheetTitle,
    [
      "Work date",
      "Matter",
      "Hours",
      "Billable status",
      "Approval status",
      "Billing code",
      "Billing description",
      "Billable amount",
    ],
    myTime.map((t) => [
      t.work_date,
      matterLabel(t.matters),
      Number(t.hours),
      t.billable_status,
      t.approval_status,
      t.billing_code || "",
      t.billing_description || "",
      calcBillableAmount(Number(t.hours), Number(t.billing_rate), t.billable_status),
    ])
  );

  const unbilled = myTime.filter(
    (t) =>
      t.approval_status === "Approved" &&
      t.invoice_status === "Unbilled" &&
      t.billable_status === "Billable"
  );

  addSheet(
    workbook,
    "Unbilled Time",
    [
      "Work date",
      "Matter",
      "Hours",
      "Billable status",
      "Approval status",
      "Billing code",
      "Billing description",
      "Billable amount",
    ],
    unbilled.map((t) => [
      t.work_date,
      matterLabel(t.matters),
      Number(t.hours),
      t.billable_status,
      t.approval_status,
      t.billing_code || "",
      t.billing_description || "",
      calcBillableAmount(Number(t.hours), Number(t.billing_rate), t.billable_status),
    ])
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastDueInvoices = invoices.filter((inv) => {
    if (!inv.finalized_at || ["Canceled", "Draft", "Paid"].includes(inv.invoice_status)) return false;
    const bal = Number(inv.balance_due) || 0;
    if (bal <= 0) return false;
    const due = new Date(`${inv.due_date}T00:00:00`);
    return due < today;
  });

  addSheet(
    workbook,
    "Past-Due Invoices",
    ["Invoice #", "Matter", "Due date", "Balance due", "Status"],
    pastDueInvoices.map((inv) => {
      const m = matterById.get(inv.matter_id);
      const label = m
        ? `${m.matter_number || ""} · ${m.matter_name || ""}`.trim()
        : matterLabel(inv.matters);
      return [
        inv.invoice_number,
        label || "—",
        inv.due_date,
        Number(inv.balance_due) || 0,
        inv.invoice_status,
      ];
    })
  );

  return workbook;
}

export function buildClientsWorkbook(clients: Client[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rebel Law Group";
  workbook.created = new Date();

  addSheet(
    workbook,
    "Clients",
    [
      "Client #",
      "Type",
      "Display name",
      "First name",
      "Last name",
      "Organization",
      "Primary contact",
      "Email",
      "Phone",
      "Billing email",
      "Address line 1",
      "Address line 2",
      "City",
      "State",
      "Postal code",
      "Status",
      "Created at",
    ],
    clients.map((c) => [
      c.client_number,
      c.client_type,
      clientDisplayName(c),
      c.first_name || "",
      c.last_name || "",
      c.organization_name || "",
      c.primary_contact_name || "",
      c.email || "",
      c.phone || "",
      c.billing_email || "",
      c.address_line_1 || "",
      c.address_line_2 || "",
      c.city || "",
      c.state || "",
      c.postal_code || "",
      c.client_status,
      c.created_at,
    ])
  );

  return workbook;
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
