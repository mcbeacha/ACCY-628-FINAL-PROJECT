import { StatCard } from "@/components/StatCard";
import { formatCurrency } from "@/lib/format";
import type { FirmPulseSummary } from "@/lib/analytics-data";
import { ExecutiveCharts } from "./ExecutiveCharts";

function pct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function days(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)}d`;
}

function collectionTone(
  rate: number | null
): "default" | "warning" | "success" | "error" {
  if (rate == null) return "default";
  if (rate >= 85) return "success";
  if (rate >= 70) return "warning";
  return "error";
}

function utilizationTone(
  rate: number | null
): "default" | "warning" | "success" | "error" {
  if (rate == null) return "default";
  if (rate >= 70) return "success";
  if (rate >= 50) return "warning";
  return "error";
}

function realizationTone(
  rate: number | null
): "default" | "warning" | "success" | "error" {
  if (rate == null) return "default";
  if (rate >= 90) return "success";
  if (rate >= 75) return "warning";
  return "error";
}

function dsoTone(value: number | null): "default" | "warning" | "success" | "error" {
  if (value == null) return "default";
  if (value <= 45) return "success";
  if (value <= 60) return "warning";
  return "error";
}

export function FirmPulse({
  summary,
  monthly,
  practices,
  arAging,
  utilization,
}: {
  summary: FirmPulseSummary;
  monthly: { month: string; invoiced: number; collected: number }[];
  practices: { practiceArea: string; grossProfit: number; grossMargin?: number | null }[];
  arAging: { bucket: string; amount: number }[];
  utilization: { name: string; utilization: number }[];
}) {
  const arTone =
    summary.ar90Plus > 0 ? "error" : summary.pastDueAR > 0 ? "warning" : "default";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Unbilled WIP"
          value={formatCurrency(summary.unbilledWip)}
          hint="Approved billable time not yet invoiced"
          tone={summary.unbilledWip > 0 ? "warning" : "default"}
          href="/unbilled"
        />
        <StatCard
          label="Outstanding AR"
          value={formatCurrency(summary.outstandingAR)}
          hint={
            summary.ar90Plus > 0
              ? `${formatCurrency(summary.ar90Plus)} in 90+`
              : summary.pastDueAR > 0
                ? `${formatCurrency(summary.pastDueAR)} past due`
                : "Open finalized balances"
          }
          cta="View client balances →"
          tone={arTone}
          href="/ar?focus=clients#outstanding-by-client"
        />
        <StatCard
          label="Collection rate"
          value={pct(summary.collectionRate)}
          hint="Collected ÷ invoiced"
          tone={collectionTone(summary.collectionRate)}
          href="/ar"
        />
        <StatCard
          label="Avg days to pay"
          value={days(summary.avgDaysToPay)}
          hint="Invoice date to latest payment"
          tone={dsoTone(summary.avgDaysToPay)}
          href="/ar"
        />
        <StatCard
          label="Firm utilization"
          value={pct(summary.utilization)}
          hint="Billable hours ÷ available capacity"
          tone={utilizationTone(summary.utilization)}
          href="/productivity"
        />
        <StatCard
          label="Billing realization"
          value={pct(summary.billingRealization)}
          hint="Invoiced fees ÷ standard billable value"
          tone={realizationTone(summary.billingRealization)}
          href="/profitability/matters"
        />
      </div>

      <ExecutiveCharts
        variant="compact"
        monthly={monthly}
        practices={practices}
        arAging={arAging}
        utilization={utilization}
        pulseTotals={{
          outstandingAR: summary.outstandingAR,
          lastMonthCollected: summary.lastMonthCollected,
          lastMonthLabel: summary.lastMonthLabel,
          utilization: summary.utilization,
          grossProfit: summary.grossProfit,
          grossMargin: summary.grossMargin,
        }}
      />
    </div>
  );
}
