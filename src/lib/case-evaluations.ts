import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Car,
  FileSignature,
  Gavel,
  HeartHandshake,
  Home,
  Scale,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";

/** Demo profile IDs from seed data */
export const DEMO_PARALEGAL_ID = "a1000000-0000-4000-8000-000000000004";
export const DEMO_PARTNER_ID = "a1000000-0000-4000-8000-000000000001";
export const DEMO_ATTORNEY_JORDAN_ID = "a1000000-0000-4000-8000-000000000002";
export const DEMO_ATTORNEY_AVERY_ID = "a1000000-0000-4000-8000-000000000003";

export const CASE_EVAL_STATUSES = [
  "New",
  "Under Review",
  "Contact Attempted",
  "Consultation Scheduled",
  "Referred to Partner",
  "Accepted",
  "Declined",
  "Closed",
] as const;

export type CaseEvalStatus = (typeof CASE_EVAL_STATUSES)[number];

export const CASE_EVAL_URGENCIES = [
  "Routine",
  "Soon",
  "Urgent",
  "Immediate Deadline",
] as const;

export type CaseEvalUrgency = (typeof CASE_EVAL_URGENCIES)[number];

export const CASE_EVAL_PRACTICE_OPTIONS = [
  "Personal Injury",
  "Business Law",
  "Contract Law",
  "Employment Law",
  "Family Law",
  "Estate Planning",
  "Probate",
  "Real Estate",
  "Criminal Defense",
  "Civil Litigation",
  "Not Sure",
  "Other",
] as const;

export type PracticeAreaLead = {
  id: string;
  practice_area: string;
  lead_attorney_id: string;
  short_description: string;
  client_facing_description: string;
  common_needs: string[];
  active_status: boolean;
  display_order: number;
  lead?: { id: string; full_name: string; job_title: string | null } | null;
};

export type CaseEvaluation = {
  id: string;
  reference_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  preferred_contact_method: string | null;
  best_contact_time: string | null;
  practice_area: string;
  issue_date: string | null;
  city: string | null;
  state: string | null;
  case_summary: string;
  urgency_level: CaseEvalUrgency;
  currently_represented: boolean;
  referral_source: string | null;
  consent_to_contact: boolean;
  disclaimer_acknowledged: boolean;
  evaluation_status: CaseEvalStatus;
  assigned_paralegal_id: string | null;
  assigned_partner_id: string | null;
  submitted_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  follow_up_due_at: string | null;
  internal_notes: string | null;
  partner_recommendation: string | null;
  partner_review_notes: string | null;
  decline_reason: string | null;
  converted_client_id: string | null;
  converted_matter_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  is_demo_data: boolean;
  created_at: string;
  updated_at: string;
};

export type CaseEvaluationActivity = {
  id: string;
  evaluation_id: string;
  activity_type: string;
  activity_notes: string | null;
  performed_by: string | null;
  created_at: string;
};

const PRACTICE_ICONS: Record<string, LucideIcon> = {
  "Personal Injury": Car,
  "Business Law": Building2,
  "Contract Law": FileSignature,
  "Employment Law": Users,
  "Family Law": HeartHandshake,
  "Estate Planning": ScrollText,
  Probate: ScrollText,
  "Real Estate": Home,
  "Criminal Defense": Shield,
  "Civil Litigation": Gavel,
};

export function practiceAreaIcon(area: string): LucideIcon {
  return PRACTICE_ICONS[area] ?? Scale;
}

export function evaluationDisplayName(e: Pick<CaseEvaluation, "first_name" | "last_name">) {
  return `${e.first_name} ${e.last_name}`.trim();
}

/** Fallback leads if Supabase rows are unavailable (mirrors seed). */
export const FALLBACK_PRACTICE_LEADS: Omit<PracticeAreaLead, "id" | "active_status">[] = [
  {
    practice_area: "Personal Injury",
    lead_attorney_id: DEMO_ATTORNEY_JORDAN_ID,
    short_description: "Help after accidents and unexpected injuries.",
    client_facing_description:
      "Rebel Law Group guides injured clients through insurance claims, medical documentation, and settlement discussions with clear, practical advice.",
    common_needs: [
      "Motor vehicle accidents",
      "Slip and fall",
      "Insurance claim questions",
      "Medical expense recovery",
    ],
    display_order: 10,
    lead: { id: DEMO_ATTORNEY_JORDAN_ID, full_name: "Jordan Harper", job_title: "Senior Associate" },
  },
  {
    practice_area: "Business Law",
    lead_attorney_id: DEMO_PARTNER_ID,
    short_description: "Practical counsel for Oxford businesses.",
    client_facing_description:
      "From formation to growth, we help local businesses organize, negotiate, and manage day-to-day legal needs.",
    common_needs: [
      "Business formation",
      "Operating agreements",
      "Governance advice",
      "Ownership transitions",
    ],
    display_order: 20,
    lead: { id: DEMO_PARTNER_ID, full_name: "Margaret Sinclair", job_title: "Managing Partner" },
  },
  {
    practice_area: "Contract Law",
    lead_attorney_id: DEMO_ATTORNEY_AVERY_ID,
    short_description: "Clear contracts that protect your interests.",
    client_facing_description:
      "We draft and review agreements so individuals and businesses understand their rights and obligations before signing.",
    common_needs: [
      "Contract review",
      "Vendor agreements",
      "Service contracts",
      "Negotiation support",
    ],
    display_order: 30,
    lead: { id: DEMO_ATTORNEY_AVERY_ID, full_name: "Avery Chen", job_title: "Associate Attorney" },
  },
  {
    practice_area: "Employment Law",
    lead_attorney_id: DEMO_ATTORNEY_AVERY_ID,
    short_description: "Workplace guidance for employers and employees.",
    client_facing_description:
      "Rebel Law Group helps clients understand workplace policies, employment agreements, and practical next steps.",
    common_needs: [
      "Employment agreements",
      "Workplace policies",
      "Severance questions",
      "HR compliance basics",
    ],
    display_order: 40,
    lead: { id: DEMO_ATTORNEY_AVERY_ID, full_name: "Avery Chen", job_title: "Associate Attorney" },
  },
  {
    practice_area: "Family Law",
    lead_attorney_id: DEMO_ATTORNEY_JORDAN_ID,
    short_description: "Supportive counsel for family transitions.",
    client_facing_description:
      "We provide respectful guidance for family legal needs with an emphasis on clarity and stability.",
    common_needs: ["Family transitions", "Parenting plans", "Support questions", "Name changes"],
    display_order: 50,
    lead: { id: DEMO_ATTORNEY_JORDAN_ID, full_name: "Jordan Harper", job_title: "Senior Associate" },
  },
  {
    practice_area: "Estate Planning",
    lead_attorney_id: DEMO_PARTNER_ID,
    short_description: "Plan thoughtfully for the people you care about.",
    client_facing_description:
      "Wills, powers of attorney, and practical estate plans designed for Oxford families and professionals.",
    common_needs: ["Wills", "Powers of attorney", "Healthcare directives", "Simple trusts"],
    display_order: 60,
    lead: { id: DEMO_PARTNER_ID, full_name: "Margaret Sinclair", job_title: "Managing Partner" },
  },
  {
    practice_area: "Probate",
    lead_attorney_id: DEMO_PARTNER_ID,
    short_description: "Guidance through estate administration.",
    client_facing_description:
      "We help families navigate probate steps with organized communication and careful attention to detail.",
    common_needs: ["Opening an estate", "Asset inventory", "Creditor notices", "Final distribution"],
    display_order: 70,
    lead: { id: DEMO_PARTNER_ID, full_name: "Margaret Sinclair", job_title: "Managing Partner" },
  },
  {
    practice_area: "Real Estate",
    lead_attorney_id: DEMO_ATTORNEY_AVERY_ID,
    short_description: "Local counsel for property transactions.",
    client_facing_description:
      "Buying, selling, or leasing property in Oxford and surrounding communities with careful document review.",
    common_needs: ["Purchase agreements", "Lease review", "Closing questions", "Title issues"],
    display_order: 80,
    lead: { id: DEMO_ATTORNEY_AVERY_ID, full_name: "Avery Chen", job_title: "Associate Attorney" },
  },
  {
    practice_area: "Criminal Defense",
    lead_attorney_id: DEMO_ATTORNEY_JORDAN_ID,
    short_description: "Steady representation when stakes are high.",
    client_facing_description:
      "We provide confidential, respectful guidance for individuals facing criminal charges or investigations.",
    common_needs: [
      "Misdemeanor defense",
      "First appearances",
      "Charge review",
      "Court preparation",
    ],
    display_order: 90,
    lead: { id: DEMO_ATTORNEY_JORDAN_ID, full_name: "Jordan Harper", job_title: "Senior Associate" },
  },
  {
    practice_area: "Civil Litigation",
    lead_attorney_id: DEMO_ATTORNEY_AVERY_ID,
    short_description: "Advocacy for civil disputes.",
    client_facing_description:
      "When negotiation is not enough, we help clients evaluate options and pursue or defend civil claims.",
    common_needs: ["Business disputes", "Contract breaches", "Property disputes", "Demand letters"],
    display_order: 100,
    lead: { id: DEMO_ATTORNEY_AVERY_ID, full_name: "Avery Chen", job_title: "Associate Attorney" },
  },
];
