import Link from "next/link";
import { formatDate } from "@/lib/format";

export type WeeklyUtilizationProps = {
  weekStart: string;
  availableHours: number;
  totalHours: number;
  billableHours: number;
  /** Optional link target for "View time" */
  timeHref?: string;
};

export function weeklyUtilization(billableHours: number, availableHours: number) {
  if (!availableHours || availableHours <= 0) return null;
  return (billableHours / availableHours) * 100;
}

export function WeeklyUtilizationCard({
  weekStart,
  availableHours,
  totalHours,
  billableHours,
  timeHref,
}: WeeklyUtilizationProps) {
  const nonbillable = Math.max(0, totalHours - billableHours);
  const util = weeklyUtilization(billableHours, availableHours);
  const remaining = Math.max(0, availableHours - totalHours);
  const overCapacity = totalHours > availableHours;

  const billablePct = availableHours > 0 ? Math.min(100, (billableHours / availableHours) * 100) : 0;
  const totalPct = availableHours > 0 ? Math.min(100, (totalHours / availableHours) * 100) : 0;

  const utilTone =
    util == null
      ? "default"
      : util >= 85
        ? "success"
        : util >= 60
          ? "warning"
          : totalHours === 0
            ? "default"
            : "error";

  const utilColor =
    utilTone === "success"
      ? "bg-success"
      : utilTone === "warning"
        ? "bg-warning"
        : utilTone === "error"
          ? "bg-error"
          : "bg-primary";

  const href = timeHref || `/time?from=${weekStart}`;

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="card-title text-base">Weekly utilization</h2>
            <p className="text-xs opacity-60 -mt-0.5">
              Week of {formatDate(weekStart)} · billable hours ÷ available hours
            </p>
          </div>
          <Link href={href} className="link text-sm">
            View time
          </Link>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-60">Utilization</p>
            <p className="text-3xl font-semibold tabular-nums leading-none mt-1">
              {util == null ? "—" : `${util.toFixed(0)}%`}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="font-semibold tabular-nums">{billableHours.toFixed(1)}</span>
              <span className="opacity-60"> billable</span>
              <span className="opacity-40"> / </span>
              <span className="font-semibold tabular-nums">{availableHours.toFixed(0)}</span>
              <span className="opacity-60"> available</span>
            </p>
            {overCapacity ? (
              <p className="text-xs text-warning mt-0.5">
                Logged {(totalHours - availableHours).toFixed(1)} hrs over available capacity
              </p>
            ) : (
              <p className="text-xs opacity-60 mt-0.5">
                {remaining.toFixed(1)} hrs capacity remaining this week
              </p>
            )}
          </div>
        </div>

        {/* Capacity meter: available = 100%; billable fill + total tick */}
        <div className="space-y-2">
          <div
            className="relative h-4 rounded-full bg-base-200 overflow-hidden border border-base-300"
            role="img"
            aria-label={`Billable ${billableHours.toFixed(1)} of ${availableHours} available hours`}
          >
            <div
              className={`absolute inset-y-0 left-0 ${utilColor} opacity-90 transition-[width]`}
              style={{ width: `${billablePct}%` }}
            />
            {/* Total hours marker (includes nonbillable) */}
            {totalHours > billableHours && (
              <div
                className="absolute inset-y-0 left-0 border-r-2 border-base-content/40"
                style={{ width: `${totalPct}%` }}
                title={`Total logged ${totalHours.toFixed(1)} hrs`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-sm ${utilColor}`} />
              Billable ({billableHours.toFixed(1)}h)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-base-300 border border-base-content/20" />
              Nonbillable ({nonbillable.toFixed(1)}h)
            </span>
            <span className="inline-flex items-center gap-1.5 opacity-70">
              Available ({availableHours.toFixed(0)}h/wk)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Metric label="Available" value={`${availableHours.toFixed(0)}h`} />
          <Metric label="Billable" value={`${billableHours.toFixed(1)}h`} />
          <Metric label="Nonbillable" value={`${nonbillable.toFixed(1)}h`} />
          <Metric label="Total logged" value={`${totalHours.toFixed(1)}h`} />
        </div>

        <p className="text-xs opacity-50">
          Available hours come from your profile (default 40). Utilization is a management estimate, not a
          performance ranking.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-base-200/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide opacity-60">{label}</p>
      <p className="font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
