/**
 * Marketing performance analytics.
 * Revenue / collected reuse MatterMetrics from computeAnalytics — do not invent a second definition.
 */
import { FORMULAS as CORE_FORMULAS, n, type MatterMetrics } from "./analytics";
import type { CaseEvaluation } from "./case-evaluations";
import type {
  LeadSource,
  MarketingCampaign,
  MarketingSpend,
} from "./marketing-types";

export const MARKETING_FORMULAS = {
  ...CORE_FORMULAS,
  costPerLead:
    "Approved marketing spend ÷ leads attributed to the channel/campaign in the period.",
  costPerAcquisition:
    "Approved marketing spend ÷ converted (retained) matters attributed to the channel/campaign.",
  marketingRoi:
    "((Collected revenue of attributed converted matters − approved spend) ÷ approved spend) × 100. Collected uses the same definition as firm analytics.",
  marketingContribution:
    "Collected revenue of attributed converted matters − approved marketing spend.",
  leadConversionRate:
    "Converted evaluations ÷ total evaluations for the channel × 100.",
  noteOnMatterGp:
    "When approved spend is posted through Cost Allocations (Advertising / Marketing), matter gross profit already includes that allocated cost. Channel ROI uses firm spend vs attributed collections and is not a second GP calculation.",
} as const;

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
};

export type ChannelPerformance = {
  leadSourceId: string | null;
  sourceName: string;
  channelGroup: string;
  leads: number;
  converted: number;
  conversionRate: number | null;
  spend: number;
  cpl: number | null;
  cpa: number | null;
  invoicedRevenue: number;
  collectedRevenue: number;
  contribution: number;
  roiPct: number | null;
  matterIds: string[];
};

export type CampaignPerformance = ChannelPerformance & {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  practiceArea: string | null;
  budgetAmount: number | null;
};

export type MarketingBundle = {
  funnel: FunnelStage[];
  channels: ChannelPerformance[];
  campaigns: CampaignPerformance[];
  totals: {
    leads: number;
    converted: number;
    spend: number;
    cpl: number | null;
    cpa: number | null;
    invoicedRevenue: number;
    collectedRevenue: number;
    contribution: number;
    roiPct: number | null;
  };
  topChannel: ChannelPerformance | null;
};

function inDate(d: string | null | undefined, from?: string | null, to?: string | null) {
  if (!d) return true;
  const day = d.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function ratio(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function pct(num: number, den: number): number | null {
  const r = ratio(num, den);
  return r == null ? null : r * 100;
}

type EvalRow = CaseEvaluation & {
  lead_source_id?: string | null;
  campaign_id?: string | null;
};

type MatterRow = {
  id: string;
  lead_source_id?: string | null;
  campaign_id?: string | null;
  origin_evaluation_id?: string | null;
};

export function computeMarketingAnalytics(input: {
  evaluations: EvalRow[];
  matters: MatterRow[];
  matterMetrics: MatterMetrics[];
  leadSources: LeadSource[];
  campaigns: MarketingCampaign[];
  spend: MarketingSpend[];
  from?: string | null;
  to?: string | null;
}): MarketingBundle {
  const { from, to } = input;
  const sourceMap = new Map(input.leadSources.map((s) => [s.id, s]));
  const campaignMap = new Map(input.campaigns.map((c) => [c.id, c]));
  const metricsByMatter = new Map(input.matterMetrics.map((m) => [m.matterId, m]));

  const evals = input.evaluations.filter((e) => inDate(e.submitted_at, from, to));
  const spendRows = input.spend.filter(
    (s) => s.approval_status === "Approved" && inDate(s.spend_date, from, to)
  );

  const funnelKeys: { key: string; label: string; match: (s: string) => boolean }[] = [
    { key: "new", label: "New", match: (s) => s === "New" },
    {
      key: "contacted",
      label: "Contact attempted",
      match: (s) => s === "Contact Attempted" || s === "Under Review",
    },
    {
      key: "consult",
      label: "Consultation / referred",
      match: (s) => s === "Consultation Scheduled" || s === "Referred to Partner",
    },
    {
      key: "converted",
      label: "Accepted / converted",
      match: (s) => s === "Accepted" || !!evals.find((e) => e.evaluation_status === s && e.converted_matter_id),
    },
    { key: "declined", label: "Declined / closed", match: (s) => s === "Declined" || s === "Closed" },
  ];

  // Fix converted funnel stage to count converted properly
  const funnel: FunnelStage[] = [
    { key: "new", label: "New", count: evals.filter((e) => e.evaluation_status === "New").length },
    {
      key: "in_progress",
      label: "In review / contact",
      count: evals.filter((e) =>
        ["Under Review", "Contact Attempted"].includes(e.evaluation_status)
      ).length,
    },
    {
      key: "consult",
      label: "Consult / referred",
      count: evals.filter((e) =>
        ["Consultation Scheduled", "Referred to Partner"].includes(e.evaluation_status)
      ).length,
    },
    {
      key: "converted",
      label: "Converted",
      count: evals.filter((e) => !!e.converted_matter_id || e.evaluation_status === "Accepted")
        .length,
    },
    {
      key: "declined",
      label: "Declined / closed",
      count: evals.filter((e) => ["Declined", "Closed"].includes(e.evaluation_status)).length,
    },
  ];

  void funnelKeys;

  function revenueForMatters(matterIds: string[]) {
    let invoiced = 0;
    let collected = 0;
    for (const id of matterIds) {
      const m = metricsByMatter.get(id);
      if (!m) continue;
      invoiced += m.invoicedRevenue;
      collected += m.collectedRevenue;
    }
    return { invoiced, collected };
  }

  function buildPerf(
    leadSourceId: string | null,
    campaignId: string | null | undefined,
    evalSubset: EvalRow[],
    spendAmount: number
  ): Omit<ChannelPerformance, "sourceName" | "channelGroup"> & {
    sourceName?: string;
    channelGroup?: string;
  } {
    const source = leadSourceId ? sourceMap.get(leadSourceId) : null;
    const convertedEvals = evalSubset.filter((e) => !!e.converted_matter_id);
    const matterIds = Array.from(
      new Set(
        [
          ...convertedEvals.map((e) => e.converted_matter_id!).filter(Boolean),
          ...input.matters
            .filter((m) => {
              if (campaignId) return m.campaign_id === campaignId;
              if (leadSourceId) return m.lead_source_id === leadSourceId;
              return !m.lead_source_id;
            })
            .map((m) => m.id),
        ].filter(Boolean)
      )
    );
    const { invoiced, collected } = revenueForMatters(matterIds);
    const leads = evalSubset.length;
    const converted = convertedEvals.length || matterIds.length;
    const contribution = collected - spendAmount;
    return {
      leadSourceId,
      sourceName: source?.source_name || "Unattributed",
      channelGroup: source?.channel_group || "Other",
      leads,
      converted,
      conversionRate: pct(convertedEvals.length, leads),
      spend: spendAmount,
      cpl: ratio(spendAmount, leads),
      cpa: ratio(spendAmount, convertedEvals.length || matterIds.filter((id) => metricsByMatter.has(id)).length),
      invoicedRevenue: invoiced,
      collectedRevenue: collected,
      contribution,
      roiPct: spendAmount > 0 ? (contribution / spendAmount) * 100 : null,
      matterIds,
    };
  }

  // Channel rollup
  const channelIds = new Set<string | null>();
  for (const e of evals) channelIds.add(e.lead_source_id ?? null);
  for (const m of input.matters) channelIds.add(m.lead_source_id ?? null);
  for (const s of input.leadSources) channelIds.add(s.id);

  const channels: ChannelPerformance[] = [];
  for (const sid of channelIds) {
    const evalSubset = evals.filter((e) => (e.lead_source_id ?? null) === sid);
    const campaignIdsForSource = input.campaigns
      .filter((c) => c.lead_source_id === sid)
      .map((c) => c.id);
    const spendAmount = spendRows
      .filter((s) => campaignIdsForSource.includes(s.campaign_id))
      .reduce((sum, s) => sum + n(s.amount), 0);
    // Include spend even if no evals this period when campaign belongs to source
    if (evalSubset.length === 0 && spendAmount === 0 && !sid) continue;
    if (evalSubset.length === 0 && spendAmount === 0) {
      const hasMatters = input.matters.some((m) => m.lead_source_id === sid);
      if (!hasMatters) continue;
    }
    channels.push(buildPerf(sid, undefined, evalSubset, spendAmount) as ChannelPerformance);
  }
  channels.sort((a, b) => b.collectedRevenue - a.collectedRevenue || b.leads - a.leads);

  // Campaign rollup
  const campaigns: CampaignPerformance[] = [];
  for (const c of input.campaigns) {
    const evalSubset = evals.filter((e) => e.campaign_id === c.id);
    const spendAmount = spendRows
      .filter((s) => s.campaign_id === c.id)
      .reduce((sum, s) => sum + n(s.amount), 0);
    if (evalSubset.length === 0 && spendAmount === 0) {
      const hasMatters = input.matters.some((m) => m.campaign_id === c.id);
      if (!hasMatters) continue;
    }
    const base = buildPerf(c.lead_source_id, c.id, evalSubset, spendAmount) as ChannelPerformance;
    campaigns.push({
      ...base,
      campaignId: c.id,
      campaignCode: c.campaign_code,
      campaignName: c.campaign_name,
      practiceArea: c.practice_area,
      budgetAmount: c.budget_amount,
    });
  }
  campaigns.sort((a, b) => b.spend - a.spend || b.leads - a.leads);

  const totalSpend = spendRows.reduce((s, r) => s + n(r.amount), 0);
  const totalLeads = evals.length;
  const totalConverted = evals.filter((e) => !!e.converted_matter_id).length;
  const attributedMatterIds = Array.from(
    new Set(
      [
        ...evals.filter((e) => e.converted_matter_id).map((e) => e.converted_matter_id!),
        ...input.matters.filter((m) => m.lead_source_id).map((m) => m.id),
      ].filter(Boolean)
    )
  );
  const { invoiced, collected } = revenueForMatters(attributedMatterIds);
  const contribution = collected - totalSpend;

  const totals = {
    leads: totalLeads,
    converted: totalConverted,
    spend: totalSpend,
    cpl: ratio(totalSpend, totalLeads),
    cpa: ratio(totalSpend, totalConverted),
    invoicedRevenue: invoiced,
    collectedRevenue: collected,
    contribution,
    roiPct: totalSpend > 0 ? (contribution / totalSpend) * 100 : null,
  };

  const topChannel =
    [...channels].sort((a, b) => (b.roiPct ?? -999) - (a.roiPct ?? -999))[0] ||
    channels[0] ||
    null;

  return { funnel, channels, campaigns, totals, topChannel };
}

export async function loadMarketingData(supabase: any) {
  const [
    { data: leadSources },
    { data: campaigns },
    { data: spend },
    { data: evaluations },
    { data: matters },
  ] = await Promise.all([
    supabase.from("lead_sources").select("*").order("display_order"),
    supabase.from("marketing_campaigns").select("*, lead_sources(*)").order("campaign_code"),
    supabase.from("marketing_spend").select("*, marketing_campaigns(*, lead_sources(*))").order("spend_date", { ascending: false }),
    supabase.from("case_evaluations").select("*").order("submitted_at", { ascending: false }),
    supabase.from("matters").select("id, lead_source_id, campaign_id, origin_evaluation_id, matter_number, matter_name, practice_area"),
  ]);

  return {
    leadSources: (leadSources || []) as LeadSource[],
    campaigns: (campaigns || []) as MarketingCampaign[],
    spend: (spend || []) as MarketingSpend[],
    evaluations: (evaluations || []) as EvalRow[],
    matters: (matters || []) as MatterRow[],
  };
}
