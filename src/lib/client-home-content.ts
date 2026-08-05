/**
 * Fictional academic-project content for the public-facing Client homepage.
 * Community metrics and biographies are illustrative only.
 */

export const COMMUNITY_NOTE =
  "Community involvement shown in this academic demonstration is fictional.";

export const COMMUNITY_SUMMARY =
  "Rebel Law Group believes a law firm should do more than handle cases. It should invest time, knowledge, and resources in the community it serves.";

export type CommunityActivity = {
  id: string;
  activity_name: string;
  description: string;
  impact_metric: string;
  related_name: string;
  related_role: string;
  icon:
    | "workshop"
    | "business"
    | "students"
    | "family"
    | "nonprofit"
    | "events";
};

export const COMMUNITY_ACTIVITIES: CommunityActivity[] = [
  {
    id: "small-business",
    activity_name: "Local Small Business Support",
    description:
      "Office-hours style guidance for Oxford founders reviewing formation checklists and common contract questions.",
    impact_metric: "20 local businesses supported (illustrative)",
    related_name: "Margaret Sinclair",
    related_role: "Managing Partner",
    icon: "business",
  },
  {
    id: "workshops",
    activity_name: "Free Community Legal Workshops",
    description:
      "Plain-English sessions on wills basics, tenant questions, and starting a side business—open to Oxford residents.",
    impact_metric: "12 free legal workshops hosted (illustrative)",
    related_name: "Jordan Harper",
    related_role: "Senior Associate",
    icon: "workshop",
  },
  {
    id: "students",
    activity_name: "University and Student Outreach",
    description:
      "Career panels and resume clinics for students exploring legal and professional paths in Mississippi.",
    impact_metric: "85 Oxford residents assisted (illustrative)",
    related_name: "Avery Chen",
    related_role: "Associate Attorney",
    icon: "students",
  },
  {
    id: "youth",
    activity_name: "Youth and Family Programs",
    description:
      "Volunteer support for youth mentorship nights and family resource fairs in Lafayette County.",
    impact_metric: "150 volunteer hours contributed (illustrative)",
    related_name: "Priya Rose",
    related_role: "Paralegal",
    icon: "family",
  },
  {
    id: "nonprofit",
    activity_name: "Nonprofit Legal Assistance",
    description:
      "Limited-scope help for qualifying nonprofits reviewing governance documents and event permits.",
    impact_metric: "8 nonprofit organizations assisted (illustrative)",
    related_name: "Margaret Sinclair",
    related_role: "Managing Partner",
    icon: "nonprofit",
  },
  {
    id: "events",
    activity_name: "Oxford Community Events",
    description:
      "Sponsorship-style presence at fictional community festivals and neighborhood information booths.",
    impact_metric: "6 community events supported (illustrative)",
    related_name: "Sam Okonkwo",
    related_role: "Billing Coordinator",
    icon: "events",
  },
];

export type LifeStage = {
  id: string;
  life_event: string;
  explanation: string;
  practice_areas: string[];
};

export const LIFE_STAGES: LifeStage[] = [
  {
    id: "career-business",
    life_event: "Starting a Career or Business",
    explanation:
      "Formation documents, early contracts, and workplace basics so new ventures start on solid footing.",
    practice_areas: ["Business Law", "Contract Law", "Employment Law"],
  },
  {
    id: "buying-home",
    life_event: "Buying a Home",
    explanation:
      "Purchase agreements, lease review, and closing questions for Oxford-area property decisions.",
    practice_areas: ["Real Estate", "Contract Law"],
  },
  {
    id: "growing-family",
    life_event: "Growing a Family",
    explanation:
      "Supportive guidance when family circumstances change and practical planning becomes important.",
    practice_areas: ["Family Law", "Estate Planning"],
  },
  {
    id: "protecting-assets",
    life_event: "Protecting Assets",
    explanation:
      "Thoughtful planning tools that help individuals organize wishes and protect what they have built.",
    practice_areas: ["Estate Planning", "Business Law"],
  },
  {
    id: "dispute",
    life_event: "Resolving a Dispute",
    explanation:
      "Clear options when a disagreement needs negotiation, documentation, or formal advocacy.",
    practice_areas: ["Civil Litigation", "Contract Law"],
  },
  {
    id: "estate",
    life_event: "Planning an Estate",
    explanation:
      "Wills, directives, and probate guidance designed for long-term family clarity.",
    practice_areas: ["Estate Planning", "Probate"],
  },
  {
    id: "emergency",
    life_event: "Responding to an Accident or Emergency",
    explanation:
      "Steady next steps after an unexpected injury or urgent legal situation.",
    practice_areas: ["Personal Injury", "Civil Litigation", "Criminal Defense"],
  },
];

export type AttorneyCard = {
  id: string;
  full_name: string;
  role: string;
  practice_focus: string[];
  biography: string;
  community_involvement: string;
  photo_initials: string;
  is_managing_partner?: boolean;
};

export const ATTORNEY_CARDS: AttorneyCard[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    full_name: "Margaret Sinclair",
    role: "Managing Partner",
    practice_focus: ["Business Law", "Estate Planning", "Probate"],
    biography:
      "Margaret leads Rebel Law Group with a focus on practical business counsel and long-term planning for Oxford families. All credentials and biography details in this demonstration are fictional.",
    community_involvement:
      "Chairs fictional small-business office hours and nonprofit governance clinics.",
    photo_initials: "MS",
    is_managing_partner: true,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    full_name: "Jordan Harper",
    role: "Senior Associate",
    practice_focus: ["Personal Injury", "Family Law", "Criminal Defense"],
    biography:
      "Jordan works with clients facing sudden life changes—injuries, family transitions, and high-stakes court matters—with clear communication. Fictional academic profile only.",
    community_involvement:
      "Hosts fictional free community legal workshops throughout the year.",
    photo_initials: "JH",
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    full_name: "Avery Chen",
    role: "Associate Attorney",
    practice_focus: ["Contract Law", "Employment Law", "Real Estate", "Civil Litigation"],
    biography:
      "Avery helps individuals and local businesses review agreements, workplace issues, and property matters before problems escalate. Fictional academic profile only.",
    community_involvement:
      "Supports fictional university outreach and student career panels.",
    photo_initials: "AC",
  },
];

export const FIRM_CONTACT = {
  phone: "(662) 555-0148",
  email: "hello@rebellaw.demo",
  address: "Oxford, Mississippi",
};
