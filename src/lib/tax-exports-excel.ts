import ExcelJS from "exceljs";
import type { TaxCategoryGroup, TaxExportAudit } from "@/lib/tax-exports";

/** Server-only Excel builder — do not import from Client Components. */
export function buildTaxExportWorkbook(input: {
  groups: TaxCategoryGroup[];
  audit: TaxExportAudit;
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.audit.exportedByName;
  workbook.created = new Date(input.audit.exportedAtIso);

  const cover = workbook.addWorksheet("Audit Cover");
  cover.addRow(["Rebel Law Group — Year-End Tax Package Export"]);
  cover.getRow(1).font = { bold: true, size: 14 };
  cover.addRow([]);
  cover.addRow(["Academic / fictional data notice"]);
  cover.addRow([
    "This workbook was generated for an academic simulation. Values may mix live seed data and demo fallbacks.",
  ]);
  cover.addRow([]);
  cover.addRow(["Audit trail"]);
  cover.getRow(6).font = { bold: true };
  cover.addRow(["Exported by (name)", input.audit.exportedByName]);
  cover.addRow(["Exported by (email)", input.audit.exportedByEmail]);
  cover.addRow(["Role", input.audit.exportedByRole]);
  cover.addRow(["Exported at (ISO)", input.audit.exportedAtIso]);
  cover.addRow([
    "Exported at (local display)",
    new Date(input.audit.exportedAtIso).toLocaleString(),
  ]);
  cover.addRow(["Tax year", input.audit.taxYear]);
  cover.addRow([]);
  cover.addRow([
    "Purpose",
    "Provide common year-end groupings for Tax CPA review (income, meals vs entertainment, travel, dues, insurance, operations).",
  ]);
  cover.addRow([
    "CPA reminder",
    "Meals are listed separately from entertainment. Entertainment is generally nondeductible; business meals are often limited to 50%.",
  ]);
  cover.columns = [{ width: 28 }, { width: 72 }];

  const summary = workbook.addWorksheet("Category Summary");
  summary.addRow([
    "Category",
    "Total",
    "Line count",
    "Live lines",
    "Demo lines",
    "Deductibility note",
  ]);
  summary.getRow(1).font = { bold: true };
  for (const g of input.groups) {
    const live = g.items.filter((i) => i.source === "live").length;
    const demo = g.items.filter((i) => i.source === "demo").length;
    summary.addRow([
      g.title,
      g.total,
      g.items.length,
      live,
      demo,
      g.deductibilityHint,
    ]);
  }
  summary.getColumn(2).numFmt = '"$"#,##0.00';
  summary.columns.forEach((col) => {
    col.width = 22;
  });
  summary.getColumn(6).width = 55;

  for (const g of input.groups) {
    const sheet = workbook.addWorksheet(g.title.slice(0, 31));
    sheet.addRow(["Description", "Date", "Amount", "Source", "Reference", "Tax note"]);
    sheet.getRow(1).font = { bold: true };
    for (const item of g.items) {
      sheet.addRow([
        item.description,
        item.date || "",
        item.amount,
        item.source,
        item.reference || "",
        item.taxNote || g.deductibilityHint,
      ]);
    }
    sheet.addRow([]);
    sheet.addRow(["Category total", "", g.total, "", "", ""]);
    sheet.getColumn(3).numFmt = '"$"#,##0.00';
    sheet.columns.forEach((col) => {
      col.width = 20;
    });
    sheet.getColumn(1).width = 48;
    sheet.getColumn(6).width = 48;
  }

  return workbook;
}
