import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ClientBillingClient } from "./ClientBillingClient";
import { redirect } from "next/navigation";

export default async function PortalBillingPage() {
  const { profile, supabase } = await requireUser();
  if (profile.role !== "client") redirect("/dashboard");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("portal_user_id", profile.id)
    .maybeSingle();

  if (!client) {
    return (
      <>
        <PageHeader title="Invoices & Payments" description="No linked client profile." />
        <p className="text-sm opacity-70">Contact the firm administrator for portal setup.</p>
      </>
    );
  }

  const [{ data: invoices }, { data: payments }, { data: retainers }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, due_date, invoice_total, retainer_applied, payments_applied, balance_due, invoice_status, dispute_status, dispute_reason, client_message, matter_id, matters(matter_number, matter_name)"
      )
      .eq("client_id", client.id)
      .not("finalized_at", "is", null)
      .order("invoice_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id, payment_number, payment_date, total_amount, payment_method, payment_status")
      .eq("client_id", client.id)
      .in("payment_status", ["Posted", "Reversed"])
      .order("payment_date", { ascending: false }),
    supabase
      .from("retainer_accounts")
      .select("current_balance, matters!inner(client_id)")
      .eq("matters.client_id", client.id),
  ]);

  const invIds = (invoices || []).map((i: { id: string }) => i.id);
  let lines: {
    id: string;
    invoice_id: string;
    description: string;
    final_amount: number;
    line_type: string;
    service_date: string | null;
  }[] = [];
  if (invIds.length) {
    const { data } = await supabase
      .from("invoice_lines")
      .select("id, invoice_id, description, final_amount, line_type, service_date")
      .in("invoice_id", invIds);
    lines = data || [];
  }

  const retainerBalance = ((retainers || []) as { current_balance: number }[]).reduce(
    (s, r) => s + Number(r.current_balance),
    0
  );

  return (
    <>
      <PageHeader
        title="Invoices & Payments"
        description="View finalized invoices, payments, and retainer balances for your matters only."
      />
      <ClientBillingClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        invoices={(invoices || []) as any}
        lines={lines}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payments={(payments || []) as any}
        retainerBalance={retainerBalance}
        userId={profile.id}
      />
    </>
  );
}
