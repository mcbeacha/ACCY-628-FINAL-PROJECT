import { seedProfileContact } from "@/lib/seed-directory";
import type { Client, Matter, MatterTask, Profile } from "@/lib/types";
import { redirect } from "next/navigation";

export type ClientPortalBundle = {
  profile: Profile;
  client: Client;
  matters: (Matter & {
    responsible?: { full_name: string; email: string | null; job_title: string | null } | null;
  })[];
  tasks: MatterTask[];
  invoices: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    invoice_total: number;
    retainer_applied: number;
    payments_applied: number;
    balance_due: number;
    invoice_status: string;
    dispute_status: string;
    matter_id: string;
    billing_period_start: string | null;
    billing_period_end: string | null;
    matters?: { matter_number: string; matter_name: string } | null;
  }[];
  payments: {
    id: string;
    payment_number: string;
    payment_date: string;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    reference_number: string | null;
    matter_id: string | null;
  }[];
  retainers: {
    id: string;
    matter_id: string;
    current_balance: number;
    initial_retainer_amount: number | null;
    replenishment_threshold: number | null;
    account_status: string;
    matters?: { matter_number: string; matter_name: string } | null;
  }[];
  retainerTx: {
    id: string;
    retainer_account_id: string;
    transaction_type: string;
    amount: number;
    transaction_date: string;
    notes: string | null;
  }[];
  paralegal: Profile | null;
};

function hydrateResponsible(
  matters: ClientPortalBundle["matters"]
): ClientPortalBundle["matters"] {
  return matters.map((m) => {
    if (m.responsible?.full_name) return m;
    const seeded = seedProfileContact(m.responsible_attorney_id);
    if (!seeded) return m;
    return {
      ...m,
      responsible: {
        full_name: seeded.full_name,
        email: seeded.email,
        job_title: seeded.job_title,
      },
    };
  });
}

export async function requireCurrentClientPortal(): Promise<ClientPortalBundle> {
  const { requireUser } = await import("@/lib/auth");
  const { profile, supabase } = await requireUser();
  if (profile.role !== "client") {
    redirect("/dashboard");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("portal_user_id", profile.id)
    .maybeSingle();

  if (!client) {
    redirect("/potential-client");
  }

  const clientRow = client as Client;

  const { data: matters } = await supabase
    .from("matters")
    .select(
      "*, responsible:profiles!matters_responsible_attorney_id_fkey(full_name, email, job_title)"
    )
    .eq("client_id", clientRow.id)
    .order("created_at", { ascending: false });

  const matterRows = hydrateResponsible((matters || []) as ClientPortalBundle["matters"]);
  const matterIds = matterRows.map((m) => m.id);

  let tasks: MatterTask[] = [];
  if (matterIds.length) {
    const { data } = await supabase
      .from("matter_tasks")
      .select("*")
      .eq("client_visible", true)
      .in("matter_id", matterIds)
      .order("due_date", { ascending: true });
    tasks = (data || []) as MatterTask[];
  }

  const [{ data: invoices }, { data: payments }, { data: retainers }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, due_date, invoice_total, retainer_applied, payments_applied, balance_due, invoice_status, dispute_status, matter_id, billing_period_start, billing_period_end, matters(matter_number, matter_name)"
      )
      .eq("client_id", clientRow.id)
      .not("finalized_at", "is", null)
      .order("invoice_date", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, payment_number, payment_date, total_amount, payment_method, payment_status, reference_number, matter_id"
      )
      .eq("client_id", clientRow.id)
      .in("payment_status", ["Posted", "Reversed"])
      .order("payment_date", { ascending: false }),
    supabase
      .from("retainer_accounts")
      .select(
        "id, matter_id, current_balance, initial_retainer_amount, replenishment_threshold, account_status, matters(matter_number, matter_name)"
      )
      .in("matter_id", matterIds.length ? matterIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const retainerRows = (retainers || []) as unknown as ClientPortalBundle["retainers"];
  const retainerIds = retainerRows.map((r) => r.id);
  let retainerTx: ClientPortalBundle["retainerTx"] = [];
  if (retainerIds.length) {
    const { data } = await supabase
      .from("retainer_transactions")
      .select("id, retainer_account_id, transaction_type, amount, transaction_date, notes")
      .in("retainer_account_id", retainerIds)
      .order("transaction_date", { ascending: false })
      .limit(40);
    retainerTx = (data || []) as ClientPortalBundle["retainerTx"];
  }

  const seededParalegal = seedProfileContact("a1000000-0000-4000-8000-000000000004");
  const { data: paralegal } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", "a1000000-0000-4000-8000-000000000004")
    .maybeSingle();

  return {
    profile,
    client: clientRow,
    matters: matterRows,
    tasks,
    invoices: (invoices || []) as unknown as ClientPortalBundle["invoices"],
    payments: (payments || []) as ClientPortalBundle["payments"],
    retainers: retainerRows,
    retainerTx,
    paralegal:
      (paralegal as Profile) ||
      (seededParalegal
        ? ({
            id: "a1000000-0000-4000-8000-000000000004",
            full_name: seededParalegal.full_name,
            email: seededParalegal.email || "",
            role: "paralegal",
            job_title: seededParalegal.job_title,
            active_status: true,
            created_at: "",
          } as Profile)
        : null),
  };
}

export function clientFacingInvoiceStatus(inv: {
  balance_due: number;
  due_date: string;
  invoice_status: string;
  dispute_status?: string;
  payments_applied?: number;
}) {
  if (inv.dispute_status && inv.dispute_status !== "None" && inv.invoice_status === "Disputed") {
    return "Disputed";
  }
  if (Number(inv.balance_due) <= 0 || inv.invoice_status === "Paid") return "Paid";
  if (inv.invoice_status === "Partially Paid") return "Partially Paid";
  const due = new Date(`${inv.due_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0 && Number(inv.balance_due) > 0) return "Past Due";
  if (days <= 7 && Number(inv.balance_due) > 0) return "Due Soon";
  if (Number(inv.payments_applied || 0) > 0 && Number(inv.balance_due) > 0) return "Partially Paid";
  return inv.invoice_status || "Open";
}
