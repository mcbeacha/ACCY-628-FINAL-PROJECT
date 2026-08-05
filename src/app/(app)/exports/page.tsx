import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { TaxExportsClient } from "./TaxExportsClient";
import { buildTaxExportGroups } from "@/lib/tax-exports";
import { redirect } from "next/navigation";

export default async function TaxExportsPage() {
  const { profile, supabase } = await requireUser();
  if (profile.role !== "billing_staff") {
    redirect("/dashboard");
  }

  const taxYear = new Date().getFullYear();

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

  return (
    <>
      <PageHeader
        title="Tax year-end Exports"
        description="Compile common groupings for Tax CPA filing support — income, meals vs entertainment, travel, dues, insurance, and operating expenses."
      />
      <TaxExportsClient
        taxYear={taxYear}
        groups={groups}
        exporterName={profile.full_name}
      />
    </>
  );
}
