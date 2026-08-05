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

export function ExecutiveCharts(props: {
  monthly: { month: string; invoiced: number; collected: number }[];
  practices: { practiceArea: string; grossProfit: number }[];
  arAging: { bucket: string; amount: number }[];
  utilization: { name: string; utilization: number }[];
  collectionTrend: { month: string; rate: number }[];
  writeTrend: { month: string; writeDowns: number; writeOffs: number }[];
  matterProfit: { name: string; grossProfit: number }[];
  byMethod: { method: string; revenue: number }[];
  /** Home-page firm pulse: four charts only. */
  variant?: "full" | "compact";
}) {
  const compact = props.variant === "compact";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Invoiced vs collected by month" decision="Track cash conversion lag vs billings.">
        <MonthlyRevenueChart data={props.monthly} />
      </ChartCard>
      <ChartCard title="AR aging (open balances)" decision="Prioritize collection work.">
        <ArAgingChart data={props.arAging} />
      </ChartCard>
      <ChartCard title="Gross profit by practice area" decision="Where is contribution concentrated?">
        <GrossProfitByPracticeChart data={props.practices} />
      </ChartCard>
      <ChartCard title="Collection rate by invoice month" decision="Is collection weakening?">
        <CollectionTrendChart data={props.collectionTrend} />
      </ChartCard>
      {!compact && (
        <>
          <ChartCard title="Matter gross profit (top/bottom)" decision="Review loss-making work.">
            <MatterProfitBarChart data={props.matterProfit} />
          </ChartCard>
          <ChartCard title="Revenue by billing method" decision="Balance fee structures.">
            <MethodRevenueChart data={props.byMethod} />
          </ChartCard>
          <ChartCard title="Utilization by timekeeper (est.)" decision="Capacity and staffing.">
            <UtilizationChart data={props.utilization} />
          </ChartCard>
          <ChartCard title="Write-downs & write-offs" decision="Pricing and bad debt trends.">
            <WriteTrendChart data={props.writeTrend} />
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  decision,
  children,
}: {
  title: string;
  decision: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs opacity-60 mb-2">{decision}</p>
        {children}
      </div>
    </div>
  );
}
