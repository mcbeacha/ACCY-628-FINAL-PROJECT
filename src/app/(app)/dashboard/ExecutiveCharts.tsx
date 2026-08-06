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
      <ChartCard title="Invoiced vs collected">
        <MonthlyRevenueChart data={props.monthly} />
      </ChartCard>
      <ChartCard title="AR aging">
        <ArAgingChart data={props.arAging} />
      </ChartCard>
      <ChartCard title="Gross profit by practice">
        <GrossProfitByPracticeChart data={props.practices} />
      </ChartCard>
      <ChartCard title="Collection rate">
        <CollectionTrendChart data={props.collectionTrend} />
      </ChartCard>
      {!compact && (
        <>
          <ChartCard title="Matter gross profit">
            <MatterProfitBarChart data={props.matterProfit} />
          </ChartCard>
          <ChartCard title="Revenue by billing method">
            <MethodRevenueChart data={props.byMethod} />
          </ChartCard>
          <ChartCard title="Utilization by timekeeper">
            <UtilizationChart data={props.utilization} />
          </ChartCard>
          <ChartCard title="Write-downs & write-offs">
            <WriteTrendChart data={props.writeTrend} />
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm mb-2">{title}</h3>
        {children}
      </div>
    </div>
  );
}
