import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { FormulaHelp } from "@/components/analytics/AnalyticsNotice";
import { EmptyState } from "@/components/EmptyState";
import { MarketingSpendPanel } from "@/components/marketing/MarketingSpendPanel";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import { formatCurrency } from "@/lib/format";
import { computeMarketingAnalytics, loadMarketingData } from "@/lib/marketing-analytics";
import type { MarketingCampaign, MarketingSpend } from "@/lib/marketing-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { profile, supabase } = await requireUser();
  if (!["managing_partner", "billing_staff"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const from = sp.from || null;
  const to = sp.to || null;

  const [mkt, analyticsRaw] = await Promise.all([
    loadMarketingData(supabase),
    loadAnalyticsData(supabase),
  ]);
  const bundle = computeAnalytics(analyticsRaw, { from, to });
  const marketing = computeMarketingAnalytics({
    evaluations: mkt.evaluations,
    matters: mkt.matters as {
      id: string;
      lead_source_id?: string | null;
      campaign_id?: string | null;
      origin_evaluation_id?: string | null;
    }[],
    matterMetrics: bundle.matters,
    leadSources: mkt.leadSources,
    campaigns: mkt.campaigns,
    spend: mkt.spend,
    from,
    to,
  });

  const matterOpts = (analyticsRaw.matterRows || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => ({
      id: m.id,
      matter_number: m.matter_number,
      matter_name: m.matter_name,
      client_id: m.client_id,
      campaign_id: m.campaign_id ?? null,
      lead_source_id: m.lead_source_id ?? null,
    })
  );

  const canApprove = profile.role === "managing_partner";

  return (
    <>
      <PageHeader
        title="Marketing Performance"
        description="Lead attribution, ad spend, and ROI against retained-matter revenue (same invoiced/collected definitions as profitability)."
        actions={
          <>
            <Link href="/case-evaluations" className="btn btn-sm btn-outline">
              Case evaluations
            </Link>
            <Link href="/costs/allocations" className="btn btn-sm btn-ghost">
              Cost allocations
            </Link>
          </>
        }
      />

      <form className="flex flex-wrap items-end gap-3 mb-4">
        <label className="form-control">
          <span className="label-text text-xs">From</span>
          <input type="date" name="from" className="input input-bordered input-sm" defaultValue={from || ""} />
        </label>
        <label className="form-control">
          <span className="label-text text-xs">To</span>
          <input type="date" name="to" className="input input-bordered input-sm" defaultValue={to || ""} />
        </label>
        <button type="submit" className="btn btn-sm btn-primary">
          Apply dates
        </button>
        <div className="flex flex-wrap gap-2 ml-auto">
          <FormulaHelp formulaKey="costPerLead" label="CPL" />
          <FormulaHelp formulaKey="costPerAcquisition" label="CPA" />
          <FormulaHelp formulaKey="marketingRoi" label="ROI" />
          <FormulaHelp formulaKey="collectedRevenue" label="Collected" />
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Leads</div>
          <div className="stat-value text-2xl">{marketing.totals.leads}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Approved spend</div>
          <div className="stat-value text-2xl">{formatCurrency(marketing.totals.spend)}</div>
          <div className="stat-desc">
            CPL {marketing.totals.cpl != null ? formatCurrency(marketing.totals.cpl) : "—"}
          </div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Converted matters</div>
          <div className="stat-value text-2xl">{marketing.totals.converted}</div>
          <div className="stat-desc">
            CPA {marketing.totals.cpa != null ? formatCurrency(marketing.totals.cpa) : "—"}
          </div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Marketing ROI</div>
          <div className="stat-value text-2xl">
            {marketing.totals.roiPct != null ? `${marketing.totals.roiPct.toFixed(0)}%` : "—"}
          </div>
          <div className="stat-desc">
            Contribution {formatCurrency(marketing.totals.contribution)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Intake funnel</h2>
            <div className="space-y-2">
              {marketing.funnel.map((stage) => (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className="w-36 text-sm">{stage.label}</div>
                  <div className="flex-1 bg-base-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary h-3 rounded-full"
                      style={{
                        width: `${
                          marketing.totals.leads
                            ? Math.min(100, (stage.count / Math.max(marketing.totals.leads, 1)) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="w-8 text-right text-sm font-medium">{stage.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Top channel</h2>
            {marketing.topChannel ? (
              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">Source</dt>
                  <dd className="font-medium">{marketing.topChannel.sourceName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">Leads</dt>
                  <dd>{marketing.topChannel.leads}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">Spend</dt>
                  <dd>{formatCurrency(marketing.topChannel.spend)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">Collected (attributed)</dt>
                  <dd>{formatCurrency(marketing.topChannel.collectedRevenue)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="opacity-60">ROI</dt>
                  <dd>
                    {marketing.topChannel.roiPct != null
                      ? `${marketing.topChannel.roiPct.toFixed(0)}%`
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyState title="No channel data yet." />
            )}
            <p className="text-xs opacity-60 mt-3">
              Attributed collected revenue matches profitability matter metrics for the same date filter.
              Posting spend to allocations updates matter gross profit via allocated costs.
            </p>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm mb-6">
        <div className="card-body">
          <h2 className="card-title text-base">Channel performance</h2>
          {marketing.channels.length === 0 ? (
            <EmptyState title="No attributed channels in this period." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Leads</th>
                    <th>Conv %</th>
                    <th>Spend</th>
                    <th>CPL</th>
                    <th>CPA</th>
                    <th>Invoiced</th>
                    <th>Collected</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {marketing.channels.map((c) => (
                    <tr key={c.leadSourceId || "none"}>
                      <td>
                        <div className="font-medium">{c.sourceName}</div>
                        <div className="text-xs opacity-60">{c.channelGroup}</div>
                      </td>
                      <td>{c.leads}</td>
                      <td>{c.conversionRate != null ? `${c.conversionRate.toFixed(0)}%` : "—"}</td>
                      <td>{formatCurrency(c.spend)}</td>
                      <td>{c.cpl != null ? formatCurrency(c.cpl) : "—"}</td>
                      <td>{c.cpa != null ? formatCurrency(c.cpa) : "—"}</td>
                      <td>{formatCurrency(c.invoicedRevenue)}</td>
                      <td>{formatCurrency(c.collectedRevenue)}</td>
                      <td>{c.roiPct != null ? `${c.roiPct.toFixed(0)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm mb-6">
        <div className="card-body">
          <h2 className="card-title text-base">Campaigns</h2>
          {marketing.campaigns.length === 0 ? (
            <EmptyState title="No campaign activity in this period." />
          ) : (
            <div className="table-wrap">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Practice</th>
                    <th>Leads</th>
                    <th>Spend</th>
                    <th>Budget</th>
                    <th>Collected</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {marketing.campaigns.map((c) => (
                    <tr key={c.campaignId}>
                      <td>
                        <div className="font-medium">{c.campaignName}</div>
                        <div className="text-xs opacity-60">{c.campaignCode}</div>
                      </td>
                      <td>{c.practiceArea || "—"}</td>
                      <td>{c.leads}</td>
                      <td>{formatCurrency(c.spend)}</td>
                      <td>{c.budgetAmount != null ? formatCurrency(c.budgetAmount) : "—"}</td>
                      <td>{formatCurrency(c.collectedRevenue)}</td>
                      <td>{c.roiPct != null ? `${c.roiPct.toFixed(0)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <MarketingSpendPanel
        userId={profile.id}
        canApprove={canApprove}
        campaigns={mkt.campaigns as MarketingCampaign[]}
        spend={mkt.spend as MarketingSpend[]}
        matters={matterOpts}
      />
    </>
  );
}
