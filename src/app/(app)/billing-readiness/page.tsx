import { requireUser } from "@/lib/auth";
import { canViewBillingReadiness } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { evaluateBillingReadiness } from "@/lib/billing-readiness";
import { clientDisplayName } from "@/lib/format";
import type { Client, Matter } from "@/lib/types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function BillingReadinessPage() {
  const { profile, supabase } = await requireUser();
  if (!canViewBillingReadiness(profile.role)) {
    redirect("/dashboard");
  }

  const { data } = await supabase
    .from("matters")
    .select("*, clients(*)")
    .eq("approval_status", "Approved")
    .order("matter_number");

  const rows = ((data || []) as Matter[]).map((m) =>
    evaluateBillingReadiness(m, (m.clients as Client) || null)
  );

  return (
    <>
      <PageHeader
        title="Billing Readiness"
        description="Identify approved matters that are ready for future billing setup. This screen does not create invoices."
      />

      {rows.length === 0 ? (
        <EmptyState title="No approved matters are available for billing review." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Matter</th>
                  <th>Client</th>
                  <th>Billing method</th>
                  <th>Status</th>
                  <th>Missing items</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.matter.id}>
                    <td>
                      <Link
                        href={`/matters/${r.matter.id}`}
                        className="link link-hover font-medium"
                      >
                        {r.matter.matter_number}
                      </Link>
                      <div className="text-xs opacity-60">{r.matter.matter_name}</div>
                    </td>
                    <td className="text-sm">{clientDisplayName(r.client)}</td>
                    <td className="text-sm">{r.matter.billing_method || "—"}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-sm max-w-md">
                      {r.missing.length ? r.missing.join("; ") : "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
