import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { evaluationDisplayName, type CaseEvaluation } from "@/lib/case-evaluations";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CaseEvaluationsPage() {
  const { profile, supabase } = await requireUser();
  if (!["managing_partner", "paralegal", "attorney"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data } = await supabase
    .from("case_evaluations")
    .select(
      "*, partner:profiles!case_evaluations_assigned_partner_id_fkey(full_name), paralegal:profiles!case_evaluations_assigned_paralegal_id_fkey(full_name)"
    )
    .order("submitted_at", { ascending: false });

  const rows = (data || []) as (CaseEvaluation & {
    partner?: { full_name: string } | null;
    paralegal?: { full_name: string } | null;
  })[];

  const title =
    profile.role === "managing_partner"
      ? "Case Evaluations — Firm Intake"
      : profile.role === "paralegal"
        ? "New Case Evaluations"
        : "Evaluations Referred to Me";

  return (
    <>
      <PageHeader
        title={title}
        description="Fictional intake requests from the public Client page. Case evaluations are leads — not approved engagements."
      />
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          {rows.length === 0 ? (
            <EmptyState title="No case evaluations are available for your role." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Contact</th>
                    <th>Practice area</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Follow-up</th>
                    <th>Partner</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/case-evaluations/${e.id}`} className="link link-hover font-medium">
                          {e.reference_number}
                        </Link>
                        <div className="text-xs opacity-60">{formatDate(e.submitted_at)}</div>
                      </td>
                      <td className="text-sm">{evaluationDisplayName(e)}</td>
                      <td className="text-sm">{e.practice_area}</td>
                      <td className="text-sm">{e.urgency_level}</td>
                      <td>
                        <StatusBadge status={e.evaluation_status} />
                      </td>
                      <td className="text-sm">{formatDate(e.follow_up_due_at)}</td>
                      <td className="text-sm">{e.partner?.full_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
