export function AlertBanner({
  type = "info",
  children,
}: {
  type?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
}) {
  const cls =
    type === "success"
      ? "alert-success"
      : type === "warning"
        ? "alert-warning"
        : type === "error"
          ? "alert-error"
          : "alert-info";

  return (
    <div role="alert" className={`alert ${cls}`}>
      <span>{children}</span>
    </div>
  );
}
