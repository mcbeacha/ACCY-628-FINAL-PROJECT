import type { ReactNode } from "react";

/** Compact filter bar used across Billing screens (matches Accounts Receivable). */
export function FilterToolbar({
  children,
  actions,
  hint,
}: {
  children: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2">
      {children}
      {actions ? <div className="flex items-center gap-1.5 pb-0.5">{actions}</div> : null}
      {hint ? <div className="text-xs opacity-55 pb-1 sm:ml-auto">{hint}</div> : null}
    </div>
  );
}

export function FilterField({
  label,
  className = "w-full sm:w-40",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`form-control ${className}`}>
      <span className="label py-0 min-h-0">
        <span className="label-text text-[10px] uppercase tracking-wide opacity-60">{label}</span>
      </span>
      {children}
    </label>
  );
}
