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
