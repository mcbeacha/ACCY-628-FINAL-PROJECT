import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceDetailClient } from "./InvoiceDetailClient";
import type { Invoice, InvoiceLine } from "@/lib/billing-types";
import { redirect } from "next/navigation";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, supabase } = await requireUser();
  if (profile.role === "paralegal") redirect("/dashboard");

  const { data: inv, error } = await supabase
    .from("invoices")
    .select(
      "*, matters(matter_number, matter_name, matter_status), clients(organization_name, first_name, last_name, client_number)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !inv) {
    redirect("/invoices");
  }

  // Clients only see finalized invoices
  if (profile.role === "client" && !(inv as Invoice).finalized_at) {
    redirect("/portal/billing");
  }

  const [{ data: lines }, { data: adjs }, { data: wos }, { data: apps }, { data: ra }] =
    await Promise.all([
      supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("service_date"),
      supabase.from("billing_adjustments").select("*").eq("invoice_id", id),
      supabase.from("write_offs").select("*").eq("invoice_id", id),
      supabase
        .from("payment_applications")
        .select("*, payments(payment_number, payment_status)")
        .eq("invoice_id", id),
      supabase
        .from("retainer_accounts")
        .select("current_balance")
        .eq("matter_id", (inv as Invoice).matter_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return (
    <>
      <PageHeader
        title={(inv as Invoice).invoice_number}
        description="Invoice detail, approvals, finalization, payments, retainers, and write-offs."
      />
      <InvoiceDetailClient
        invoice={inv as Invoice & { matters?: { matter_number: string; matter_name: string } | null }}
        lines={(lines || []) as InvoiceLine[]}
        adjustments={(adjs || []) as {
          id: string;
          adjustment_type: string;
          original_amount: number;
          adjustment_amount: number;
          adjusted_amount: number;
          reason: string;
          approval_status: string;
        }[]}
        writeOffs={(wos || []) as {
          id: string;
          amount: number;
          reason: string;
          approval_status: string;
        }[]}
        applications={(apps || []) as {
          id: string;
          amount_applied: number;
          payments?: { payment_number: string; payment_status: string } | null;
        }[]}
        retainerBalance={ra ? Number(ra.current_balance) : null}
        userId={profile.id}
        role={profile.role}
      />
    </>
  );
}
