export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-10 text-center">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && <p className="mt-2 opacity-70 max-w-lg mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
