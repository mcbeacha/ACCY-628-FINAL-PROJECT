"use client";

import { ACADEMIC_NOTICE, APP_NAME } from "@/lib/constants";
import {
  ATTORNEY_CARDS,
  COMMUNITY_ACTIVITIES,
  COMMUNITY_NOTE,
  COMMUNITY_SUMMARY,
  FIRM_CONTACT,
  LIFE_STAGES,
} from "@/lib/client-home-content";
import {
  CASE_EVAL_PRACTICE_OPTIONS,
  CASE_EVAL_URGENCIES,
  FALLBACK_PRACTICE_LEADS,
  practiceAreaIcon,
  type PracticeAreaLead,
} from "@/lib/case-evaluations";
import { isDemoMode } from "@/lib/demo-config";
import { emailLooksValid } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import {
  ArrowRight,
  Building2,
  CalendarHeart,
  GraduationCap,
  Handshake,
  Heart,
  Landmark,
  PartyPopper,
  Scale,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  profile: Profile;
  initialLeads?: PracticeAreaLead[];
};

const COMMUNITY_ICONS = {
  workshop: Scale,
  business: Building2,
  students: GraduationCap,
  family: Heart,
  nonprofit: Handshake,
  events: PartyPopper,
} as const;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ClientHomePage({ profile, initialLeads = [] }: Props) {
  const [leads, setLeads] = useState<PracticeAreaLead[]>(initialLeads);
  const [selectedArea, setSelectedArea] = useState<PracticeAreaLead | null>(null);
  const [formPracticeArea, setFormPracticeArea] = useState("");
  const [highlightAreas, setHighlightAreas] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (initialLeads.length) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("practice_area_leads")
        .select(
          "*, lead:profiles!practice_area_leads_lead_attorney_id_fkey(id, full_name, job_title)"
        )
        .eq("active_status", true)
        .order("display_order");
      if (data && data.length) {
        setLeads(data as PracticeAreaLead[]);
      } else {
        setLeads(
          FALLBACK_PRACTICE_LEADS.map((l, i) => ({
            ...l,
            id: `fallback-${i}`,
            active_status: true,
          }))
        );
      }
    })();
  }, [initialLeads.length]);

  const orderedLeads = useMemo(() => {
    const enriched = leads.map((l) => {
      if (l.lead?.full_name) return l;
      const fb = FALLBACK_PRACTICE_LEADS.find((f) => f.practice_area === l.practice_area);
      return { ...l, lead: fb?.lead ?? l.lead ?? null };
    });
    return [...enriched].sort((a, b) => a.display_order - b.display_order);
  }, [leads]);

  function openPracticeDetail(lead: PracticeAreaLead) {
    setSelectedArea(lead);
    dialogRef.current?.showModal();
  }

  function requestHelp(area: string) {
    setFormPracticeArea(area);
    dialogRef.current?.close();
    setTimeout(() => scrollToId("case-evaluation"), 50);
  }

  function filterByLifeStage(areas: string[]) {
    setHighlightAreas(areas);
    scrollToId("practice-areas");
  }

  function filterByAttorney(areas: string[]) {
    setHighlightAreas(areas);
    scrollToId("practice-areas");
  }

  return (
    <div className="client-home -mx-3 sm:-mx-4 lg:-mx-6 -mt-2">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-base-300">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(135deg, oklch(var(--p) / 0.18) 0%, oklch(var(--b2)) 45%, oklch(var(--a) / 0.12) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(var(--p)) 0.5px, transparent 0.6px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative px-4 sm:px-8 lg:px-12 py-14 sm:py-20 lg:py-24 max-w-5xl">
          <p className="text-sm font-semibold tracking-[0.14em] uppercase opacity-70 mb-3">
            {APP_NAME}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] max-w-3xl">
            Oxford&apos;s Legal Team for Every Stage of Life
          </h1>
          <p className="mt-5 text-base sm:text-lg max-w-2xl opacity-80 leading-relaxed">
            Rebel Law Group provides practical, personal legal guidance to individuals, families,
            and businesses throughout Oxford and the surrounding community.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary gap-2"
              onClick={() => scrollToId("case-evaluation")}
            >
              Request a Free Case Evaluation
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => scrollToId("practice-areas")}
            >
              Explore Our Practice Areas
            </button>
          </div>
          {isDemoMode() && (
            <p className="mt-6 text-sm opacity-70 max-w-xl">
              Demo Mode is active. This academic application uses fictional data. Signed in as{" "}
              <strong>{profile.full_name}</strong>.
            </p>
          )}
        </div>
      </section>

      {/* Practice areas */}
      <section id="practice-areas" className="px-4 sm:px-8 lg:px-12 py-14 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold">
            How Rebel Law Group Can Help
          </h2>
          <p className="mt-2 opacity-70 max-w-2xl">
            Select a practice area to learn more and request a free case evaluation.
          </p>
          {highlightAreas.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-70">Showing related areas:</span>
              {highlightAreas.map((a) => (
                <span key={a} className="badge badge-primary badge-outline">
                  {a}
                </span>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setHighlightAreas([])}
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {orderedLeads.map((lead) => {
              const Icon = practiceAreaIcon(lead.practice_area);
              const dimmed =
                highlightAreas.length > 0 && !highlightAreas.includes(lead.practice_area);
              const leadName = lead.lead?.full_name ?? "Lead attorney";
              const isPartner =
                lead.lead?.job_title?.toLowerCase().includes("partner") ||
                lead.lead_attorney_id === "a1000000-0000-4000-8000-000000000001";
              return (
                <article
                  key={lead.id}
                  className={`group rounded-box border border-base-300 bg-base-100 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${
                    dimmed ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="btn btn-circle btn-sm btn-primary btn-outline pointer-events-none">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-xl font-semibold">{lead.practice_area}</h3>
                      <p className="text-sm mt-1 opacity-75">{lead.short_description}</p>
                      <p className="text-xs mt-3 opacity-60">
                        {isPartner ? "Lead Partner" : "Lead Attorney"}:{" "}
                        <span className="font-semibold opacity-90">{leadName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => openPracticeDetail(lead)}
                    >
                      Learn More
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => requestHelp(lead.practice_area)}
                    >
                      Request Help
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Oxford community */}
      <section
        id="oxford-community"
        className="px-4 sm:px-8 lg:px-12 py-14 bg-base-200/60 border-y border-base-300"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-3">
            <Landmark className="h-8 w-8 text-primary shrink-0 mt-1" />
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Committed to the Oxford Community
              </h2>
              <p className="mt-3 max-w-3xl opacity-80">{COMMUNITY_SUMMARY}</p>
              <p className="mt-2 text-sm badge badge-warning badge-outline py-3 px-3 h-auto">
                {COMMUNITY_NOTE}
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMMUNITY_ACTIVITIES.map((a) => {
              const Icon = COMMUNITY_ICONS[a.icon];
              return (
                <article
                  key={a.id}
                  className="rounded-box border border-base-300 bg-base-100 p-5"
                >
                  <Icon className="h-5 w-5 text-primary mb-3" />
                  <h3 className="font-display text-lg font-semibold">{a.activity_name}</h3>
                  <p className="text-sm mt-2 opacity-75">{a.description}</p>
                  <p className="text-sm font-semibold mt-3 text-primary">{a.impact_metric}</p>
                  <p className="text-xs mt-2 opacity-60">
                    Related: {a.related_name} · {a.related_role}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Attorneys for life */}
      <section id="attorneys-for-life" className="px-4 sm:px-8 lg:px-12 py-14 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-3">
            <CalendarHeart className="h-8 w-8 text-primary shrink-0 mt-1" />
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Your Attorneys for Life
              </h2>
              <p className="mt-3 max-w-3xl opacity-80 leading-relaxed">
                Legal needs rarely happen only once. A client may need help forming a business,
                reviewing a contract, purchasing a home, planning an estate, handling a family
                transition, or responding to an unexpected dispute. Rebel Law Group is designed to
                build long-term relationships so clients know where to turn when life changes.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {LIFE_STAGES.map((stage) => (
              <article
                key={stage.id}
                className="rounded-box border border-base-300 bg-base-100 p-5 flex flex-col"
              >
                <h3 className="font-display text-lg font-semibold">{stage.life_event}</h3>
                <p className="text-sm mt-2 opacity-75 flex-1">{stage.explanation}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {stage.practice_areas.map((pa) => (
                    <span key={pa} className="badge badge-ghost badge-sm">
                      {pa}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline mt-4 w-fit"
                  onClick={() => filterByLifeStage(stage.practice_areas)}
                >
                  See How We Can Help
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Meet attorneys */}
      <section
        id="meet-attorneys"
        className="px-4 sm:px-8 lg:px-12 py-14 bg-base-200/60 border-y border-base-300"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-3">
            <Users className="h-8 w-8 text-primary shrink-0 mt-1" />
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                Meet the Attorneys Serving Oxford
              </h2>
              <p className="mt-2 opacity-70">
                Fictional academic-project profiles. Photos are placeholders.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {ATTORNEY_CARDS.map((atty) => (
              <article
                key={atty.id}
                className="rounded-box border border-base-300 bg-base-100 p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-14">
                      <span className="text-lg font-display">{atty.photo_initials}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold">{atty.full_name}</h3>
                    <p className="text-sm opacity-70">{atty.role}</p>
                  </div>
                </div>
                <p className="text-sm mt-4 opacity-80">{atty.biography}</p>
                <p className="text-xs mt-3 opacity-60">
                  Oxford community: {atty.community_involvement}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {atty.practice_focus.map((pa) => (
                    <span key={pa} className="badge badge-outline badge-sm">
                      {pa}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary btn-outline mt-4"
                  onClick={() => filterByAttorney(atty.practice_focus)}
                >
                  View Practice Areas
                </button>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm opacity-70">
            Intake follow-up is coordinated by <strong>Priya Rose</strong>, Senior Paralegal, who
            reviews Free Case Evaluation submissions before partner referral.
          </p>
        </div>
      </section>

      {/* Case evaluation form */}
      <CaseEvaluationForm
        profile={profile}
        practiceArea={formPracticeArea}
        onPracticeAreaChange={setFormPracticeArea}
      />

      {/* Existing client CTA */}
      <section id="client-portal" className="px-4 sm:px-8 lg:px-12 py-14 scroll-mt-20">
        <div className="max-w-4xl mx-auto rounded-box border border-base-300 bg-base-100 p-6 sm:p-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold">
            Already a Rebel Law Group Client?
          </h2>
          <p className="mt-2 opacity-75">
            Access your fictional client portal for matters, invoices, milestones, and retainer
            summaries.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/matters" className="btn btn-primary btn-sm">
              View My Matters
            </Link>
            <Link href="/portal/billing" className="btn btn-outline btn-sm">
              Review My Invoices
            </Link>
            <Link href="/portal" className="btn btn-outline btn-sm">
              View Upcoming Milestones
            </Link>
            <Link href="/portal/billing" className="btn btn-outline btn-sm">
              View Retainer Summary
            </Link>
          </div>
        </div>
      </section>

      {/* Footer / disclaimer */}
      <footer className="px-4 sm:px-8 lg:px-12 py-10 border-t border-base-300 bg-base-200/80">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-xl font-semibold">{APP_NAME}</p>
            <p className="text-sm mt-2 opacity-70">{FIRM_CONTACT.address}</p>
            <p className="text-sm opacity-70">{FIRM_CONTACT.phone}</p>
            <p className="text-sm opacity-70">{FIRM_CONTACT.email}</p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-2">Practice areas</p>
            <ul className="text-sm space-y-1 opacity-75">
              {orderedLeads.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="link link-hover"
                    onClick={() => {
                      setHighlightAreas([l.practice_area]);
                      scrollToId("practice-areas");
                    }}
                  >
                    {l.practice_area}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm mb-2">Client portal</p>
            <ul className="text-sm space-y-1 opacity-75">
              <li>
                <Link href="/portal" className="link link-hover">
                  Milestones
                </Link>
              </li>
              <li>
                <Link href="/portal/billing" className="link link-hover">
                  Invoices & payments
                </Link>
              </li>
              <li>
                <Link href="/matters" className="link link-hover">
                  My matters
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 text-sm opacity-70 space-y-2">
          <p>
            The information on this academic demonstration is general information and is not legal
            advice. Submitting a case-evaluation form does not create an attorney-client
            relationship. Do not submit confidential or sensitive information.
          </p>
          <p>{ACADEMIC_NOTICE}</p>
        </div>
      </footer>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          {selectedArea && (
            <>
              <h3 className="font-display text-2xl font-semibold">
                {selectedArea.practice_area}
              </h3>
              <p className="text-sm mt-1 opacity-70">
                {(selectedArea.lead?.job_title || "").toLowerCase().includes("partner") ||
                selectedArea.lead_attorney_id === "a1000000-0000-4000-8000-000000000001"
                  ? "Lead Partner"
                  : "Lead Attorney"}
                : {selectedArea.lead?.full_name ?? "—"}
              </p>
              <p className="mt-4 text-sm leading-relaxed opacity-85">
                {selectedArea.client_facing_description}
              </p>
              <p className="mt-4 text-sm font-semibold">Common legal needs</p>
              <ul className="mt-2 list-disc list-inside text-sm opacity-80 space-y-1">
                {(selectedArea.common_needs || []).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <div className="modal-action">
                <form method="dialog">
                  <button className="btn btn-ghost">Close</button>
                </form>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => requestHelp(selectedArea.practice_area)}
                >
                  Request a Case Evaluation
                </button>
              </div>
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

function CaseEvaluationForm({
  profile,
  practiceArea,
  onPracticeAreaChange,
}: {
  profile: Profile;
  practiceArea: string;
  onPracticeAreaChange: (v: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessRef(null);
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const first_name = String(fd.get("first_name") || "").trim();
    const last_name = String(fd.get("last_name") || "").trim();
    const email = String(fd.get("email") || "").trim() || null;
    const phone = String(fd.get("phone") || "").trim() || null;
    const practice_area = String(fd.get("practice_area") || "").trim();
    const case_summary = String(fd.get("case_summary") || "").trim();
    const consent = fd.get("consent_to_contact") === "on";
    const disclaimer = fd.get("disclaimer_acknowledged") === "on";

    if (!first_name || !last_name) {
      setError("First and last name are required.");
      setLoading(false);
      return;
    }
    if (!email && !phone) {
      setError("Please provide an email or phone number.");
      setLoading(false);
      return;
    }
    if (email && !emailLooksValid(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!practice_area) {
      setError("Please select a practice area.");
      setLoading(false);
      return;
    }
    if (case_summary.length < 20) {
      setError("Please provide a brief description (at least a couple of sentences).");
      setLoading(false);
      return;
    }
    if (!consent || !disclaimer) {
      setError("Please confirm consent and the attorney-client disclaimer.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const year = new Date().getFullYear();
    const reference_number = `CE-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const payload = {
      reference_number,
      first_name,
      last_name,
      email,
      phone,
      preferred_contact_method: String(fd.get("preferred_contact_method") || "").trim() || null,
      best_contact_time: String(fd.get("best_contact_time") || "").trim() || null,
      practice_area,
      issue_date: String(fd.get("issue_date") || "").trim() || null,
      city: String(fd.get("city") || "").trim() || null,
      state: String(fd.get("state") || "").trim() || null,
      case_summary,
      urgency_level: String(fd.get("urgency_level") || "Routine"),
      currently_represented: fd.get("currently_represented") === "yes",
      referral_source: String(fd.get("referral_source") || "").trim() || null,
      consent_to_contact: true,
      disclaimer_acknowledged: true,
      evaluation_status: "New",
      submitted_by: user?.id ?? profile.id,
      is_demo_data: true,
    };

    const { data, error: insertError } = await supabase
      .from("case_evaluations")
      .insert(payload)
      .select("reference_number")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSuccessRef(data?.reference_number || reference_number);
    form.reset();
    onPracticeAreaChange("");
    setLoading(false);
  }

  return (
    <section
      id="case-evaluation"
      className="px-4 sm:px-8 lg:px-12 py-14 bg-base-200/40 border-y border-base-300 scroll-mt-20"
    >
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold">
          Request a Free Case Evaluation
        </h2>
        <p className="mt-2 opacity-75">
          Your request is reviewed by our intake team (Priya Rose, Paralegal). Submitting this form
          does not create an attorney-client relationship or guarantee representation.
        </p>
        <p className="mt-2 text-sm opacity-60">
          Please provide only a general description. Do not submit confidential documents or
          sensitive personal information through this form.
        </p>

        {successRef && (
          <div className="alert alert-success mt-6 text-sm">
            <span>
              Thank you for contacting Rebel Law Group. Your request has been sent to our
              client-intake team for review. Reference number: <strong>{successRef}</strong>.
              Submission of this form does not create an attorney-client relationship.
            </span>
          </div>
        )}
        {error && (
          <div className="alert alert-error mt-6 text-sm">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <fieldset className="rounded-box border border-base-300 bg-base-100 p-5 space-y-4">
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_first_name">
                  First name *
                </label>
                <input
                  id="case_eval_first_name"
                  name="first_name"
                  className="input input-bordered w-full"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_last_name">
                  Last name *
                </label>
                <input
                  id="case_eval_last_name"
                  name="last_name"
                  className="input input-bordered w-full"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_email">
                  Email
                </label>
                <input
                  id="case_eval_email"
                  name="email"
                  type="email"
                  className="input input-bordered w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_phone">
                  Phone
                </label>
                <input
                  id="case_eval_phone"
                  name="phone"
                  type="tel"
                  className="input input-bordered w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_preferred_contact">
                  Preferred contact method
                </label>
                <select
                  id="case_eval_preferred_contact"
                  name="preferred_contact_method"
                  className="select select-bordered w-full"
                >
                  <option value="">Select…</option>
                  <option>Email</option>
                  <option>Phone</option>
                  <option>Either</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_best_time">
                  Best time to contact
                </label>
                <input
                  id="case_eval_best_time"
                  name="best_contact_time"
                  className="input input-bordered w-full"
                  placeholder="e.g. Weekday mornings"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-box border border-base-300 bg-base-100 p-5 space-y-4">
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Case Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
              <div className="flex flex-col gap-1.5 w-full min-w-0 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="case_eval_practice_area">
                  Practice area *
                </label>
                <select
                  id="case_eval_practice_area"
                  name="practice_area"
                  className="select select-bordered w-full"
                  required
                  value={practiceArea}
                  onChange={(e) => onPracticeAreaChange(e.target.value)}
                >
                  <option value="">Select…</option>
                  {CASE_EVAL_PRACTICE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_issue_date">
                  Date of incident or issue
                </label>
                <input
                  id="case_eval_issue_date"
                  name="issue_date"
                  type="date"
                  className="input input-bordered w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_urgency">
                  Urgency
                </label>
                <select
                  id="case_eval_urgency"
                  name="urgency_level"
                  className="select select-bordered w-full"
                  defaultValue="Routine"
                >
                  {CASE_EVAL_URGENCIES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_city">
                  City
                </label>
                <input
                  id="case_eval_city"
                  name="city"
                  className="input input-bordered w-full"
                  placeholder="Oxford"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_state">
                  State
                </label>
                <input
                  id="case_eval_state"
                  name="state"
                  className="input input-bordered w-full"
                  placeholder="MS"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="case_eval_summary">
                  Brief description *
                </label>
                <textarea
                  id="case_eval_summary"
                  name="case_summary"
                  className="textarea textarea-bordered w-full min-h-28"
                  required
                  placeholder="General description only — no confidential details"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_represented">
                  Currently represented by another attorney?
                </label>
                <select
                  id="case_eval_represented"
                  name="currently_represented"
                  className="select select-bordered w-full"
                  defaultValue="no"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 w-full min-w-0">
                <label className="text-sm font-medium" htmlFor="case_eval_referral">
                  How did you hear about us?
                </label>
                <input
                  id="case_eval_referral"
                  name="referral_source"
                  className="input input-bordered w-full"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-box border border-base-300 bg-base-100 p-5 space-y-3">
            <h3 className="font-display text-lg font-semibold tracking-tight">Consent</h3>
            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" name="consent_to_contact" className="checkbox checkbox-primary" />
              <span className="label-text">
                I consent to be contacted by Rebel Law Group about this request. *
              </span>
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                name="disclaimer_acknowledged"
                className="checkbox checkbox-primary"
              />
              <span className="label-text">
                I understand that submitting this form does not create an attorney-client
                relationship. *
              </span>
            </label>
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Submitting…" : "Submit Free Case Evaluation"}
          </button>
        </form>
      </div>
    </section>
  );
}
