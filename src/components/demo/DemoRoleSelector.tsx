"use client";

import {
  DEMO_IDENTITIES,
  DEMO_MODE_NOTICE,
  formatDemoOptionLabel,
} from "@/lib/demo-config";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import { RotateCcw } from "lucide-react";

export function DemoRoleSelector() {
  const demo = useDemoRole();
  if (!demo) return null;

  const { activeIdentity, setActiveDemoRole, resetDemoView, switching } = demo;

  return (
    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
      <div className="hidden xl:flex flex-col items-end mr-1">
        <span className="text-[10px] uppercase tracking-wide opacity-50 font-semibold">
          View App As
        </span>
        <span
          className="tooltip tooltip-bottom tooltip-info text-[10px] opacity-60 cursor-help"
          data-tip="Switch roles to preview each user's workspace. Presentation only — not real authentication."
        >
          Presentation
        </span>
      </div>

      <label className="sr-only" htmlFor="demo-role-select">
        View App As
      </label>
      <select
        id="demo-role-select"
        className="select select-bordered select-sm max-w-[11rem] sm:max-w-[16rem] md:max-w-[20rem] text-xs sm:text-sm"
        value={activeIdentity.key}
        disabled={switching}
        title="Switch roles to preview each user's workspace. Not real authentication."
        aria-label="View App As"
        onChange={(e) => {
          void setActiveDemoRole(e.target.value as typeof activeIdentity.key);
        }}
      >
        {DEMO_IDENTITIES.map((identity) => (
          <option key={identity.key} value={identity.key}>
            {formatDemoOptionLabel(identity)}
          </option>
        ))}
      </select>

      <span className="badge badge-sm whitespace-nowrap hidden sm:inline-flex border border-base-content/15 bg-base-200 text-base-content/80 font-medium">
        Demo
      </span>

      <button
        type="button"
        className="btn btn-ghost btn-sm gap-1 shrink-0"
        disabled={switching}
        onClick={() => void resetDemoView()}
        title="Return to Managing Partner and clear saved demo preferences"
      >
        <RotateCcw className={`h-4 w-4 ${switching ? "animate-spin" : ""}`} />
        <span className="hidden lg:inline">Reset Demo View</span>
      </button>
    </div>
  );
}

export function DemoModeToast() {
  const demo = useDemoRole();
  if (!demo?.toast) return null;

  return (
    <div className="toast toast-top toast-end z-50 mt-16">
      <div className="alert alert-info shadow-lg max-w-sm text-sm">
        <span>{demo.toast}</span>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={demo.clearToast}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function DemoModeNoticeBar() {
  return (
    <div className="bg-primary text-primary-content border-b border-primary px-4 py-1.5 text-center text-xs sm:text-sm">
      {DEMO_MODE_NOTICE}
    </div>
  );
}
