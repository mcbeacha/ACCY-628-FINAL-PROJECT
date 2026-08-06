"use client";

import {
  CASE_EVAL_STATUSES,
  evaluationDisplayName,
  type CaseEvalStatus,
  type CaseEvaluation,
  type CaseEvaluationActivity,
} from "@/lib/case-evaluations";
import { formatDate } from "@/lib/format";
import type { LeadSource, MarketingCampaign } from "@/lib/marketing-types";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type EvalRow = CaseEvaluation & {
  partner?: { full_name: string } | null;
  paralegal?: { full_name: string } | null;
  lead_sources?: { source_name: string; channel_group?: string } | null;
  marketing_campaigns?: { campaign_name: string; campaign_code: string } | null;
};

export function CaseEvaluationDetailClient({
  evaluation,
  activity,
  profile,
  attorneys,
  leadSources = [],
  campaigns = [],
}: {
  evaluation: EvalRow;
  activity: CaseEvaluationActivity[];
  profile: Profile;
  attorneys: Profile[];
  leadSources?: LeadSource[];
  campaigns?: Pick<MarketingCampaign, "id" | "campaign_name" | "campaign_code" | "lead_source_id">[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CaseEvalStatus>(evaluation.evaluation_status);
  const [notes, setNotes] = useState(evaluation.internal_notes || "");
  const [partnerNotes, setPartnerNotes] = useState(evaluation.partner_review_notes || "");
  const [recommendation, setRecommendation] = useState(evaluation.partner_recommendation || "");
  const [declineReason, setDeclineReason] = useState(evaluation.decline_reason || "");
  const [partnerId, setPartnerId] = useState(evaluation.assigned_partner_id || "");
  const [leadSourceId, setLeadSourceId] = useState(evaluation.lead_source_id || "");
  const [campaignId, setCampaignId] = useState(evaluation.campaign_id || "");
  const [referralDetail, setReferralDetail] = useState(evaluation.referral_source || "");

  const filteredCampaigns = useMemo(
    () => campaigns.filter((c) => !leadSourceId || c.lead_source_id === leadSourceId),
    [campaigns, leadSourceId]
  );

  const role = profile.role;
  const isParalegal = role === "paralegal";
  const isAttorney = role === "attorney";
  const isPartner = role === "managing_partner";
  const canConvert = isPartner && !evaluation.converted_matter_id;
  const showInternal = isParalegal || isAttorney || isPartner;

  async function logActivity(type: string, notesText: string) {
    const supabase = createClient();
    await supabase.from("case_evaluation_activity").insert({
      evaluation_id: evaluation.id,
      activity_type: type,
      activity_notes: notesText,
      performed_by: profile.id,
    });
  }

  async function saveUpdate(patch: Record<string, unknown>, activityType?: string, activityNotes?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("case_evaluations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", evaluation.id);
    if (updErr) {
      setError(updErr.message);
      setBusy(false);
      return false;
    }
    if (activityType) {
      await logActivity(activityType, activityNotes || "");
    }
    setMessage("Saved.");
    setBusy(false);
    router.refresh();
    return true;
  }

  async function recordContact() {
    await saveUpdate(
      { evaluation_status: "Contact Attempted", reviewed_at: new Date().toISOString(), reviewed_by: profile.id },
      "Contact attempted",
      "Intake contact attempt recorded."
    );
    setStatus("Contact Attempted");
  }

  async function scheduleConsultation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const when = String(new FormData(e.currentTarget).get("consult_when") || "").trim();
    await saveUpdate(
      {
        evaluation_status: "Consultation Scheduled",
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
      },
      "Consultation scheduled",
      when ? `Consultation noted for ${when} (fictional demo).` : "Consultation scheduled (fictional demo)."
    );
    setStatus("Consultation Scheduled");
  }

  async function referToPartner() {
    if (!partnerId) {
      setError("Select a partner or lead attorney to refer.");
      return;
    }
    const atty = attorneys.find((a) => a.id === partnerId);
    await saveUpdate(
      {
        evaluation_status: "Referred to Partner",
        assigned_partner_id: partnerId,
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
        internal_notes: notes || null,
      },
      "Evaluation referred to Partner",
      `Referred to ${atty?.full_name || "assigned attorney"} for review.`
    );
    setStatus("Referred to Partner");
  }

  async function saveParalegalNotes() {
    await saveUpdate(
      {
        evaluation_status: status,
        internal_notes: notes || null,
        decline_reason: status === "Declined" || status === "Closed" ? declineReason || null : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
      },
      status === "Declined"
        ? "Evaluation declined"
        : status === "Closed"
          ? "Evaluation closed"
          : "Under Review",
      status === "Declined" || status === "Closed"
        ? declineReason || `Status set to ${status}.`
        : `Status updated to ${status}.`
    );
  }

  async function saveAttorneyReview() {
    await saveUpdate(
      {
        partner_recommendation: recommendation || null,
        partner_review_notes: partnerNotes || null,
        evaluation_status: recommendation.toLowerCase().includes("decline")
          ? "Declined"
          : recommendation.toLowerCase().includes("accept")
            ? "Accepted"
            : status === "Referred to Partner"
              ? "Under Review"
              : status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id,
      },
      "Partner recommendation entered",
      recommendation || "Partner review notes updated."
    );
  }

  async function convertToMatter() {
    if (
      !confirm(
        "Convert this evaluation to a Prospective client and Draft matter? This does not approve a full engagement."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcErr } = await supabase.rpc("convert_case_evaluation", {
      p_evaluation_id: evaluation.id,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    setMessage(
      `Converted. Client ${data?.client_number || ""} · Draft matter ${data?.matter_number || ""}.`
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="alert alert-success text-sm">
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Contact</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Name</dt>
                <dd className="font-medium">{evaluationDisplayName(evaluation)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Email</dt>
                <dd>{evaluation.email || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Phone</dt>
                <dd>{evaluation.phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Preferred</dt>
                <dd>{evaluation.preferred_contact_method || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Best time</dt>
                <dd>{evaluation.best_contact_time || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Case summary</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Practice area</dt>
                <dd className="font-medium">{evaluation.practice_area}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Urgency</dt>
                <dd>{evaluation.urgency_level}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Location</dt>
                <dd>
                  {[evaluation.city, evaluation.state].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Issue date</dt>
                <dd>{formatDate(evaluation.issue_date)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Suggested partner</dt>
                <dd>{evaluation.partner?.full_name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="opacity-60">Lead source</dt>
                <dd className="font-medium text-right">
                  {evaluation.lead_sources?.source_name || evaluation.referral_source || "—"}
                </dd>
              </div>
              {evaluation.marketing_campaigns?.campaign_name && (
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">Campaign</dt>
                  <dd className="text-right text-sm">{evaluation.marketing_campaigns.campaign_name}</dd>
                </div>
              )}
              {evaluation.utm_campaign && (
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">UTM campaign</dt>
                  <dd className="text-right text-xs">{evaluation.utm_campaign}</dd>
                </div>
              )}
            </dl>
            <p className="text-sm mt-3 whitespace-pre-wrap opacity-85">{evaluation.case_summary}</p>
            {!showInternal && (
              <p className="text-xs opacity-60 mt-2">
                Internal intake notes are not shown on the client view.
              </p>
            )}
          </div>
        </div>
      </div>

      {showInternal && !evaluation.converted_matter_id && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Attribution</h2>
            <p className="text-sm opacity-70">
              Correct lead source before conversion so marketing ROI stays accurate.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text">Lead source</span>
                <select
                  className="select select-bordered"
                  value={leadSourceId}
                  onChange={(e) => {
                    setLeadSourceId(e.target.value);
                    setCampaignId("");
                  }}
                >
                  <option value="">Unattributed</option>
                  {leadSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.source_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">Campaign</span>
                <select
                  className="select select-bordered"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                >
                  <option value="">None</option>
                  {filteredCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.campaign_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control sm:col-span-2">
                <span className="label-text">Referral detail</span>
                <input
                  className="input input-bordered"
                  value={referralDetail}
                  onChange={(e) => setReferralDetail(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={busy}
              onClick={() =>
                saveUpdate(
                  {
                    lead_source_id: leadSourceId || null,
                    campaign_id: campaignId || null,
                    referral_source: referralDetail.trim() || null,
                  },
                  "Attribution updated",
                  "Lead source / campaign corrected on evaluation."
                )
              }
            >
              Save attribution
            </button>
          </div>
        </div>
      )}

      {isParalegal && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body space-y-4">
            <h2 className="card-title text-base">Paralegal intake actions</h2>
            <p className="text-sm opacity-70">
              You may update intake status, notes, and referrals. You cannot approve a legal
              engagement or convert to a matter.
            </p>
            <label className="form-control max-w-xs">
              <span className="label-text">Status</span>
              <select
                className="select select-bordered"
                value={status}
                onChange={(e) => setStatus(e.target.value as CaseEvalStatus)}
              >
                {CASE_EVAL_STATUSES.filter((s) => s !== "Accepted").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Internal intake notes</span>
              <textarea
                className="textarea textarea-bordered min-h-24"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {(status === "Declined" || status === "Closed") && (
              <label className="form-control">
                <span className="label-text">Decline / close reason</span>
                <input
                  className="input input-bordered"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={saveParalegalNotes}>
                Save intake update
              </button>
              <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={recordContact}>
                Record contact attempt
              </button>
            </div>
            <form onSubmit={scheduleConsultation} className="flex flex-wrap gap-2 items-end">
              <label className="form-control">
                <span className="label-text">Consultation (fictional)</span>
                <input name="consult_when" className="input input-bordered input-sm" placeholder="e.g. Thu 2pm" />
              </label>
              <button type="submit" className="btn btn-sm btn-outline" disabled={busy}>
                Schedule consultation
              </button>
            </form>
            <div className="divider">Refer to partner</div>
            <label className="form-control max-w-md">
              <span className="label-text">Partner / lead attorney</span>
              <select
                className="select select-bordered"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              >
                <option value="">Select…</option>
                {attorneys.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.role === "managing_partner" ? "Managing Partner" : "Attorney"})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm btn-secondary w-fit" disabled={busy} onClick={referToPartner}>
              Refer evaluation to partner
            </button>
          </div>
        </div>
      )}

      {(isAttorney || isPartner) && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body space-y-4">
            <h2 className="card-title text-base">
              {isPartner ? "Partner review" : "Attorney review"}
            </h2>
            {showInternal && evaluation.internal_notes && (
              <div className="alert text-sm">
                <span>
                  <strong>Intake notes:</strong> {evaluation.internal_notes}
                </span>
              </div>
            )}
            <label className="form-control">
              <span className="label-text">Recommendation</span>
              <select
                className="select select-bordered max-w-md"
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
              >
                <option value="">Select…</option>
                <option value="Recommend accept for further engagement discussion">
                  Recommend accept for further engagement discussion
                </option>
                <option value="Recommend decline">Recommend decline</option>
                <option value="Needs more information">Needs more information</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Partner review notes</span>
              <textarea
                className="textarea textarea-bordered min-h-24"
                value={partnerNotes}
                onChange={(e) => setPartnerNotes(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-sm btn-primary w-fit" disabled={busy} onClick={saveAttorneyReview}>
              Save recommendation
            </button>
          </div>
        </div>
      )}

      {canConvert && (
        <div className="card bg-base-100 border border-warning shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Matter conversion (Managing Partner only)</h2>
            <p className="text-sm opacity-75">
              Creates a Prospective client and a Draft matter from intake contact details and the
              general case summary. Internal intake notes are not copied to client-facing fields.
              This does not approve a full engagement.
            </p>
            <button type="button" className="btn btn-warning w-fit" disabled={busy} onClick={convertToMatter}>
              Convert to Prospective Client and Draft Matter
            </button>
            {evaluation.converted_matter_id && (
              <Link href={`/matters/${evaluation.converted_matter_id}`} className="link text-sm">
                Open converted draft matter
              </Link>
            )}
          </div>
        </div>
      )}

      {evaluation.converted_matter_id && (
        <div className="alert alert-info text-sm">
          <span>
            Already converted on {formatDate(evaluation.converted_at)}.{" "}
            <Link href={`/matters/${evaluation.converted_matter_id}`} className="link">
              View draft matter
            </Link>
            {evaluation.converted_client_id && (
              <>
                {" · "}
                <Link href={`/clients/${evaluation.converted_client_id}`} className="link">
                  View prospective client
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Activity history</h2>
          {activity.length === 0 ? (
            <p className="text-sm opacity-60">No activity yet.</p>
          ) : (
            <ul className="timeline timeline-vertical timeline-compact">
              {activity.map((a) => (
                <li key={a.id}>
                  <div className="timeline-start text-xs opacity-60">{formatDate(a.created_at)}</div>
                  <div className="timeline-middle">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div className="timeline-end timeline-box text-sm">
                    <div className="font-semibold">{a.activity_type}</div>
                    {a.activity_notes && <p className="opacity-75">{a.activity_notes}</p>}
                  </div>
                  <hr />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function CaseEvaluationsMiniList({
  rows,
  emptyTitle,
}: {
  rows: EvalRow[];
  emptyTitle: string;
}) {
  if (!rows.length) {
    return <p className="text-sm opacity-60">{emptyTitle}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((e) => (
        <li key={e.id} className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href={`/case-evaluations/${e.id}`} className="link link-hover font-medium">
            {e.reference_number} · {evaluationDisplayName(e)}
          </Link>
          <span className="opacity-60">
            {e.practice_area} · {e.evaluation_status}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function roleCanAccessIntake(role: UserRole) {
  return role === "managing_partner" || role === "paralegal" || role === "attorney";
}
