import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "success" | "error";
  href?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40"
      : tone === "success"
        ? "border-success/40"
        : tone === "error"
          ? "border-error/40"
          : "border-base-300";

  const body = (
    <div className="card-body p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">{label}</p>
      <p className="text-3xl font-semibold font-display mt-1">{value}</p>
      {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
      {href && <p className="text-xs mt-2 opacity-70">View details →</p>}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`card bg-base-100 border ${toneClass} shadow-sm block transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={`card bg-base-100 border ${toneClass} shadow-sm`}>
      {body}
    </div>
  );
}
