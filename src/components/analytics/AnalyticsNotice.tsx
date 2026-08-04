import { FORMULAS } from "@/lib/analytics";

export function FormulaHelp({
  formulaKey,
  label = "How calculated",
}: {
  formulaKey: keyof typeof FORMULAS;
  label?: string;
}) {
  return (
    <div className="tooltip tooltip-left max-w-xs" data-tip={FORMULAS[formulaKey]}>
      <span className="badge badge-ghost badge-sm cursor-help">{label}</span>
    </div>
  );
}

export function AnalyticsNotice() {
  return (
    <div className="alert alert-info text-sm">
      <span>
        All financial and operational results in this application are based on fictional data
        created for an academic project. Values are management estimates for simulation, not audited
        financial statements.
      </span>
    </div>
  );
}
