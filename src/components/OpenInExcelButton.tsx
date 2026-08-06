"use client";

import { useState } from "react";

type ExportKind = "metrics" | "clients";

type Props = {
  kind: ExportKind;
  label: string;
  className?: string;
  title?: string;
};

function exportPathForKind(kind: ExportKind): string {
  return kind === "metrics"
    ? "/api/attorney/metrics-export"
    : "/api/attorney/clients-export";
}

function filenameForKind(kind: ExportKind): string {
  return kind === "metrics" ? "attorney-metrics.xlsx" : "attorney-clients.xlsx";
}

export function OpenInExcelButton({ kind, label, className, title }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(exportPathForKind(kind), { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error((await res.text()) || "Export failed.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const named = disposition?.match(/filename="([^"]+)"/)?.[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = named || filenameForKind(kind);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        title={title}
        disabled={busy}
        onClick={() => void onClick()}
      >
        {busy ? "Preparing Excel…" : label}
      </button>
      {error ? <p className="text-xs text-error max-w-xs">{error}</p> : null}
    </div>
  );
}
