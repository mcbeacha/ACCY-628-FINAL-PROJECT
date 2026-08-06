/**
 * Marketing lead attribution types + demo fallbacks.
 * Formulas live in marketing-analytics.ts and align with analytics.ts revenue definitions.
 */

export type LeadChannelGroup =
  | "Paid Search"
  | "Local Services"
  | "Organic"
  | "Social"
  | "Referral"
  | "Lead Purchase"
  | "Other";

export type LeadSource = {
  id: string;
  source_code: string;
  source_name: string;
  channel_group: LeadChannelGroup;
  description: string | null;
  active_status: boolean;
  display_order: number;
};

export type MarketingCampaignStatus = "Draft" | "Active" | "Paused" | "Completed";

export type MarketingCampaign = {
  id: string;
  campaign_code: string;
  campaign_name: string;
  lead_source_id: string;
  practice_area: string | null;
  status: MarketingCampaignStatus;
  tracking_phone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  notes: string | null;
  lead_sources?: LeadSource | null;
};

export type MarketingSpendStatus = "Draft" | "Submitted" | "Approved" | "Rejected";

export type MarketingSpend = {
  id: string;
  campaign_id: string;
  spend_date: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  vendor_id: string | null;
  description: string | null;
  approval_status: MarketingSpendStatus;
  approved_by: string | null;
  approved_at: string | null;
  cost_allocation_id: string | null;
  notes: string | null;
  created_by: string | null;
  marketing_campaigns?: MarketingCampaign | null;
};

/** Stable demo IDs matching supabase/migrations/20260807090000_marketing_lead_roi.sql */
export const DEMO_LEAD_SOURCES: LeadSource[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    source_code: "google_ads",
    source_name: "Google Ads (PPC)",
    channel_group: "Paid Search",
    description: "High-intent search ads (e.g. car accident lawyer).",
    active_status: true,
    display_order: 10,
  },
  {
    id: "d1000000-0000-4000-8000-000000000002",
    source_code: "google_lsa",
    source_name: "Google Local Services Ads",
    channel_group: "Local Services",
    description: "Pay-per-lead local listings with Google Screened badge.",
    active_status: true,
    display_order: 20,
  },
  {
    id: "d1000000-0000-4000-8000-000000000003",
    source_code: "seo_organic",
    source_name: "SEO & Organic Web",
    channel_group: "Organic",
    description: "Organic search and content landing pages.",
    active_status: true,
    display_order: 30,
  },
  {
    id: "d1000000-0000-4000-8000-000000000004",
    source_code: "meta_youtube",
    source_name: "Meta / YouTube Ads",
    channel_group: "Social",
    description: "Short-form video and social awareness ads.",
    active_status: true,
    display_order: 40,
  },
  {
    id: "d1000000-0000-4000-8000-000000000005",
    source_code: "referral",
    source_name: "Referral Network",
    channel_group: "Referral",
    description: "Attorney, client, and community referrals.",
    active_status: true,
    display_order: 50,
  },
  {
    id: "d1000000-0000-4000-8000-000000000006",
    source_code: "legal_ppl",
    source_name: "Legal Directory / PPL",
    channel_group: "Lead Purchase",
    description: "Third-party exclusive or shared legal leads.",
    active_status: true,
    display_order: 60,
  },
  {
    id: "d1000000-0000-4000-8000-000000000007",
    source_code: "walk_in",
    source_name: "Walk-in / Other",
    channel_group: "Other",
    description: "Walk-in, unknown, or unclassified sources.",
    active_status: true,
    display_order: 70,
  },
];

export const ADVERTISING_COST_CATEGORY_NAME = "Advertising / Marketing";
