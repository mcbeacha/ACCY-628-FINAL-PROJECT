import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { TaxExportsClient } from "./TaxExportsClient";
import {
  availableTaxYears,
  buildTaxExportGroups,
  resolveTaxYear,
} from "@/lib/tax-exports";
import { redirect } from "next/navigation";

export default async function TaxExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { profile, supabase } = await requireUser();
  const canExport = profile.role === "billing_staff";
  const canView =
    profile.role === "billing_staff" || profile.role === "managing_partner";

  if (!canView) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const taxYear = resolveTaxYear(params.year);
  const years = availableTaxYears();

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
        description={
          canExport
            ? "Compile common groupings for Tax CPA filing support — income, meals vs entertainment, travel, dues, insurance, and operating expenses."
            : "Read-only preview of the billing tax year-end package. Excel download remains with Billing / Accounting Staff."
        }
      />
      <TaxExportsClient
        taxYear={taxYear}
        availableYears={years}
        groups={groups}
        exporterName={profile.full_name}
        canExport={canExport}
      />
    </>
  );
}
