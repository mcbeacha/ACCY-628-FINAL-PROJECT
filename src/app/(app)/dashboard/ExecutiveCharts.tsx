"use client";

import {
  MonthlyRevenueChart,
  GrossProfitByPracticeChart,
  ArAgingChart,
  UtilizationChart,
  CollectionTrendChart,
  WriteTrendChart,
  MatterProfitBarChart,
  MethodRevenueChart,
} from "@/components/analytics/Charts";
import { formatCurrency } from "@/lib/format";

export function ExecutiveCharts(props: {
  monthly: { month: string; invoiced: number; collected: number }[];
  practices: { practiceArea: string; grossProfit: number; grossMargin?: number | null }[];
  arAging: { bucket: string; amount: number }[];
  utilization: { name: string; utilization: number }[];
  collectionTrend?: { month: string; rate: number }[];
  writeTrend?: { month: string; writeDowns: number; writeOffs: number }[];
  matterProfit?: { name: string; grossProfit: number }[];
  byMethod?: { method: string; revenue: number }[];
  /** Home-page firm pulse: cash, AR, capacity, contribution. */
  variant?: "full" | "compact";
  pulseTotals?: {
    outstandingAR: number;
    lastMonthCollected: number | null;
    lastMonthLabel: string | null;
    utilization: number | null;
    grossProfit: number;
    grossMargin: number | null;
  };
}) {
  const compact = props.variant === "compact";
  const totals = props.pulseTotals;

  const cashHeadline =
    totals?.lastMonthCollected != null
      ? formatCurrency(totals.lastMonthCollected)
      : null;
  const cashHint = totals?.lastMonthLabel
    ? `Collected in ${totals.lastMonthLabel}`
    : "Track cash conversion lag vs billings.";

  const utilHeadline =
    totals?.utilization != null ? `${totals.utilization.toFixed(1)}%` : null;

  const gpHeadline = totals ? formatCurrency(totals.grossProfit) : null;
  const gpHint =
    totals?.grossMargin != null
      ? `Firm gross margin ${totals.grossMargin.toFixed(1)}% · Where is contribution concentrated?`
      : "Where is contribution concentrated?";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Invoiced vs collected by month"
        decision={cashHint}
        headline={cashHeadline}
      >
        <MonthlyRevenueChart data={props.monthly} />
      </ChartCard>
      <ChartCard
        title="AR aging (open balances)"
        decision={
          totals
            ? `Total outstanding ${formatCurrency(totals.outstandingAR)} · Prioritize collection work.`
            : "Prioritize collection work."
        }
        headline={totals ? formatCurrency(totals.outstandingAR) : null}
      >
        <ArAgingChart data={props.arAging} />
      </ChartCard>
      {compact ? (
        <>
          <ChartCard
            title="Utilization by timekeeper (est.)"
            decision="Capacity and staffing."
            headline={utilHeadline}
          >
            <UtilizationChart data={props.utilization} />
          </ChartCard>
          <ChartCard
            title="Gross profit by practice area"
            decision={gpHint}
            headline={gpHeadline}
          >
            <GrossProfitByPracticeChart data={props.practices} />
          </ChartCard>
        </>
      ) : (
        <>
          <ChartCard title="Gross profit by practice area" decision="Where is contribution concentrated?">
            <GrossProfitByPracticeChart data={props.practices} />
          </ChartCard>
          <ChartCard title="Collection rate by invoice month" decision="Is collection weakening?">
            <CollectionTrendChart data={props.collectionTrend || []} />
          </ChartCard>
          <ChartCard title="Matter gross profit (top/bottom)" decision="Review loss-making work.">
            <MatterProfitBarChart data={props.matterProfit || []} />
          </ChartCard>
          <ChartCard title="Revenue by billing method" decision="Balance fee structures.">
            <MethodRevenueChart data={props.byMethod || []} />
          </ChartCard>
          <ChartCard title="Utilization by timekeeper (est.)" decision="Capacity and staffing.">
            <UtilizationChart data={props.utilization} />
          </ChartCard>
          <ChartCard title="Write-downs & write-offs" decision="Pricing and bad debt trends.">
            <WriteTrendChart data={props.writeTrend || []} />
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  decision,
  headline,
  children,
}: {
  title: string;
  decision: string;
  headline?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs opacity-60 mb-2">{decision}</p>
          </div>
          {headline ? (
            <p className="text-xl font-semibold font-display tabular-nums shrink-0 text-right leading-none pt-0.5">
              {headline}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
