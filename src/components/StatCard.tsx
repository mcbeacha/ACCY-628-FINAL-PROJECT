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

  const card = (
    <div
      className={`card bg-base-100 border ${toneClass} shadow-sm h-full ${
        href
          ? "transition hover:border-primary/50 hover:shadow-md focus-within:border-primary/50 focus-within:shadow-md"
          : ""
      }`}
    >
      <div className="card-body p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">{label}</p>
        <p className="text-3xl font-semibold font-display mt-1">{value}</p>
        {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
        {href && (
          <p className="text-xs text-primary mt-2 opacity-80">Open related screen →</p>
        )}
      </div>
    </div>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block h-full rounded-box focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`${label}: ${value}. Open related screen.`}
    >
      {card}
    </Link>
  );
}
