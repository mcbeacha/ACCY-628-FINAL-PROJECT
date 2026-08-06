import { requireUser } from "@/lib/auth";
import { buildTaxExportGroups, resolveTaxYear } from "@/lib/tax-exports";
import { buildTaxExportWorkbook } from "@/lib/tax-exports-excel";
import { workbookToBuffer, xlsxResponse } from "@/lib/attorney-excel";
import { ROLE_LABELS } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const { profile, supabase } = await requireUser();

    if (profile.role !== "billing_staff") {
      return new Response("Forbidden: billing staff role required.", { status: 403 });
    }

    const url = new URL(request.url);
    const taxYear = resolveTaxYear(url.searchParams.get("year") || undefined);

    const [{ data: payments }, { data: expenses }, { data: invoices }] = await Promise.all([
      supabase
        .from("payments")
        .select("id, payment_number, payment_date, total_amount, payment_status")
        .order("payment_date", { ascending: true }),
      supabase
        .from("expense_entries")
        .select("id, expense_date, amount, expense_type, description, approval_status")
        .order("expense_date", { ascending: true }),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, invoice_total, payments_applied, invoice_status, finalized_at"
        )
        .order("invoice_date", { ascending: true }),
    ]);

    const groups = buildTaxExportGroups({
      taxYear,
      payments: payments || [],
      expenses: expenses || [],
      invoices: invoices || [],
    });

    const exportedAtIso = new Date().toISOString();
    const workbook = buildTaxExportWorkbook({
      groups,
      audit: {
        exportedByName: profile.full_name,
        exportedByEmail: profile.email,
        exportedByRole: ROLE_LABELS[profile.role] || profile.role,
        exportedAtIso,
        taxYear,
      },
    });

    const buffer = await workbookToBuffer(workbook);
    return xlsxResponse(buffer, `tax-year-end-${taxYear}.xlsx`);
  } catch (err) {
    console.error("[tax-export]", err);
    const message = err instanceof Error ? err.message : "Export failed.";
    return new Response(message, { status: 500 });
  }
}
