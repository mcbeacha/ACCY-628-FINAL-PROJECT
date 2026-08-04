export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "success" | "error";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40"
      : tone === "success"
        ? "border-success/40"
        : tone === "error"
          ? "border-error/40"
          : "border-base-300";

  return (
    <div className={`card bg-base-100 border ${toneClass} shadow-sm`}>
      <div className="card-body p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">{label}</p>
        <p className="text-3xl font-semibold font-display mt-1">{value}</p>
        {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
      </div>
    </div>
  );
}
