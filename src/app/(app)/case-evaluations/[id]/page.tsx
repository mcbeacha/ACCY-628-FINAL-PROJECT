import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { CaseEvaluationDetailClient } from "@/components/intake/CaseEvaluationDetailClient";
import {
  evaluationDisplayName,
  type CaseEvaluation,
  type CaseEvaluationActivity,
} from "@/lib/case-evaluations";
import type { Profile } from "@/lib/types";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function CaseEvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, supabase } = await requireUser();
  if (!["managing_partner", "paralegal", "attorney", "client"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data } = await supabase
    .from("case_evaluations")
    .select(
      "*, partner:profiles!case_evaluations_assigned_partner_id_fkey(full_name), paralegal:profiles!case_evaluations_assigned_paralegal_id_fkey(full_name), lead_sources(source_name, channel_group), marketing_campaigns(campaign_name, campaign_code)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const evaluation = data as CaseEvaluation & {
    partner?: { full_name: string } | null;
    paralegal?: { full_name: string } | null;
  };

  // Clients may only see own submissions; strip internal fields in UI via role flags
  if (profile.role === "client" && evaluation.submitted_by !== profile.id) {
    notFound();
  }

  const { data: activityData } = await supabase
    .from("case_evaluation_activity")
    .select("*")
    .eq("evaluation_id", id)
    .order("created_at", { ascending: false });

  const activity = (activityData || []) as CaseEvaluationActivity[];

  const { data: attorneys } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["managing_partner", "attorney"])
    .eq("active_status", true)
    .order("full_name");

  const [{ data: leadSources }, { data: campaigns }] = await Promise.all([
    supabase.from("lead_sources").select("*").eq("active_status", true).order("display_order"),
    supabase.from("marketing_campaigns").select("id, campaign_name, campaign_code, lead_source_id").eq("status", "Active"),
  ]);

  const clientSafe = {
    ...evaluation,
    internal_notes: profile.role === "client" ? null : evaluation.internal_notes,
    partner_review_notes: profile.role === "client" ? null : evaluation.partner_review_notes,
    partner_recommendation: profile.role === "client" ? null : evaluation.partner_recommendation,
    decline_reason: profile.role === "client" ? null : evaluation.decline_reason,
  };

  return (
    <>
      <PageHeader
        title={`${evaluation.reference_number} · ${evaluationDisplayName(evaluation)}`}
        description={`Submitted ${formatDate(evaluation.submitted_at)} · Status: ${evaluation.evaluation_status}`}
        actions={
          <Link href="/case-evaluations" className="btn btn-sm btn-ghost">
            Back to list
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2 mb-2">
        <StatusBadge status={evaluation.evaluation_status} />
        <span className="badge badge-outline">{evaluation.practice_area}</span>
        <span className="badge badge-ghost">{evaluation.urgency_level}</span>
        {(evaluation as { lead_sources?: { source_name: string } | null }).lead_sources?.source_name && (
          <span className="badge badge-primary badge-outline">
            {(evaluation as { lead_sources?: { source_name: string } | null }).lead_sources!.source_name}
          </span>
        )}
      </div>
      <CaseEvaluationDetailClient
        evaluation={clientSafe}
        activity={profile.role === "client" ? activity.filter((a) => !a.activity_type.toLowerCase().includes("internal")) : activity}
        profile={profile}
        attorneys={(attorneys || []) as Profile[]}
        leadSources={leadSources || []}
        campaigns={campaigns || []}
      />
    </>
  );
}
