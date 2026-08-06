import { requireUser } from "@/lib/auth";
import { canViewBillingReadiness } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { Asc606MatterCard } from "@/components/Asc606MatterCard";
import { evaluateBillingReadiness } from "@/lib/billing-readiness";
import { evaluateAsc606, ASC606_STEPS } from "@/lib/asc606";
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

  const compliant = rows.filter((r) => r.asc606Status === "Compliant").length;
  const needsAttention = rows.filter((r) => r.asc606Status === "Needs Attention").length;
  const notReady = rows.filter((r) => r.asc606Status === "Not Ready").length;

  const spotlight = rows.find((r) => r.asc606Status !== "Compliant") || rows[0];
  const spotlightAsc = spotlight
    ? evaluateAsc606(spotlight.matter, spotlight.client)
    : null;

  return (
    <>
      <PageHeader
        title="Billing Readiness"
        description="ASC 606–aligned review of approved engagements before billing. Retainers are contract liabilities; revenue is recognized when performance obligations are satisfied (finalized invoices)."
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">ASC 606 Compliant</div>
          <div className="stat-value text-2xl text-success">{compliant}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Needs Attention</div>
          <div className="stat-value text-2xl text-warning">{needsAttention}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Not Ready</div>
          <div className="stat-value text-2xl text-error">{notReady}</div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm mb-4">
        <div className="card-body text-sm space-y-2">
          <h2 className="card-title text-base">ASC 606 five-step model (firm policy)</h2>
          <ol className="list-decimal pl-5 space-y-1 opacity-80">
            {ASC606_STEPS.map((s) => (
              <li key={s.step}>
                <strong>{s.title}.</strong> {s.lawFirmMeaning}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No approved matters are available for billing review." />
      ) : (
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Matter</th>
                    <th>Client</th>
                    <th>Billing method</th>
                    <th>Billing status</th>
                    <th>ASC 606</th>
                    <th>Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.matter.id}>
                      <td>
                        <Link
                          href={`/matters/${r.matter.id}?tab=engagement`}
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
                      <td>
                        <StatusBadge status={r.asc606Status} />
                        <div className="text-xs opacity-60">Score {r.asc606Score}</div>
                      </td>
                      <td className="text-sm max-w-md">
                        {[...r.missing, ...r.asc606Gaps].length
                          ? [...r.missing, ...r.asc606Gaps].slice(0, 4).join("; ") +
                            ([...r.missing, ...r.asc606Gaps].length > 4 ? "…" : "")
                          : "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {spotlightAsc && spotlight && (
            <Asc606MatterCard
              assessment={spotlightAsc}
              matterHref={`/matters/${spotlight.matter.id}?tab=engagement`}
            />
          )}
        </div>
      )}
    </>
  );
}
