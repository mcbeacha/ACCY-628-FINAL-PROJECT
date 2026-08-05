export function SectionHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 min-w-0">
        {icon && <span className="text-primary mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight truncate">{title}</h2>
          {description && <p className="text-sm opacity-70">{description}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
    </div>
  );
}
