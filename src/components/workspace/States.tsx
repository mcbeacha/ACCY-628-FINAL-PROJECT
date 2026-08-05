import { AlertTriangle } from "lucide-react";

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full rounded-box" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "We could not load this information",
  description = "The data source did not respond. Refresh the page to try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-box border border-dashed border-error/50 bg-base-100 p-8 text-center"
    >
      <AlertTriangle className="mx-auto h-6 w-6 text-error" aria-hidden="true" />
      <h3 className="font-display text-lg font-semibold mt-3">{title}</h3>
      <p className="mt-2 opacity-70 max-w-md mx-auto text-sm">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
