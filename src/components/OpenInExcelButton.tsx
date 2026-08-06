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

export function OpenInExcelButton({ kind, label, className, title }: Props) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    const fallbackPath = exportPathForKind(kind);

    try {
      const res = await fetch(`/api/attorney/export-ticket?kind=${kind}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Export ticket missing URL.");
      }

      let excelLikelyOpened = false;
      const onBlur = () => {
        excelLikelyOpened = true;
      };
      window.addEventListener("blur", onBlur);
      window.location.href = `ms-excel:ofv|u|${encodeURIComponent(data.url)}`;

      await new Promise((resolve) => window.setTimeout(resolve, 1600));
      window.removeEventListener("blur", onBlur);

      if (!excelLikelyOpened && document.hasFocus()) {
        window.location.assign(fallbackPath);
      }
    } catch {
      window.location.assign(fallbackPath);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      title={title}
      disabled={busy}
      onClick={() => void onClick()}
    >
      {busy ? "Opening Excel…" : label}
    </button>
  );
}
