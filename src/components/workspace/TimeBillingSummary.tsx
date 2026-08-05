"use client";

import type { TimekeepingSummary } from "@/lib/workspace-mock";
import { Pause, Play, Plus, Receipt, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/**
 * Timekeeping overview with a front-end only timer. Elapsed time is not
 * persisted; committing a session still goes through the time entry form.
 */
export function TimeBillingSummary({ summary }: { summary: TimekeepingSummary }) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const loggedHours = summary.billableMonth + summary.nonBillableMonth;
  const goalPct = summary.monthlyGoal > 0
    ? Math.min(100, Math.round((summary.billableMonth / summary.monthlyGoal) * 100))
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2">
        <Metric label="Hours logged today" value={summary.hoursToday.toFixed(1)} />
        <Metric label="Hours logged this week" value={summary.hoursWeek.toFixed(1)} />
        <Metric label="Billable hours (month)" value={summary.billableMonth.toFixed(1)} />
        <Metric
          label="Non-billable hours (month)"
          value={summary.nonBillableMonth.toFixed(1)}
          hint={`${loggedHours.toFixed(1)} hours logged in total`}
        />

        <div className="sm:col-span-2 rounded-box border border-base-300 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Monthly billable goal</span>
            <span className="opacity-70">
              {summary.billableMonth.toFixed(1)} of {summary.monthlyGoal} hours
            </span>
          </div>
          <progress
            className={`progress w-full mt-2 ${goalPct >= 75 ? "progress-success" : "progress-primary"}`}
            value={goalPct}
            max={100}
            aria-label="Monthly billable goal progress"
          />
          <p className="text-xs opacity-60 mt-1">{goalPct}% of goal completed</p>
        </div>
      </div>

      <div className="rounded-box border border-base-300 p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">Session timer</p>
          <p className="font-display text-3xl font-semibold mt-1 tabular-nums" aria-live="polite">
            {formatElapsed(seconds)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm gap-1 ${running ? "btn-warning" : "btn-primary"}`}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop timer" : "Start timer"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => {
              setRunning(false);
              setSeconds(0);
            }}
            disabled={seconds === 0 && !running}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          <Link href="/time/new" className="btn btn-outline btn-sm gap-1">
            <Plus className="h-4 w-4" />
            Add time entry
          </Link>
          <Link href="/expenses/new" className="btn btn-outline btn-sm gap-1">
            <Receipt className="h-4 w-4" />
            Add expense
          </Link>
        </div>

        <p className="text-xs opacity-60">
          The timer is a presentation aid. Save work through the time entry form to record it.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-box border border-base-300 p-4">
      <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
    </div>
  );
}
