"use client";

import {
  formatTaxTotal,
  type TaxCategoryGroup,
} from "@/lib/tax-exports";
import { Download, FileSpreadsheet, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  taxYear: number;
  availableYears: number[];
  groups: TaxCategoryGroup[];
  exporterName: string;
  canExport: boolean;
};

export function TaxExportsClient({
  taxYear,
  availableYears,
  groups,
  exporterName,
  canExport,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const income = groups
      .filter((g) => g.id.startsWith("income_"))
      .reduce((s, g) => s + g.total, 0);
    const meals = groups.find((g) => g.id === "meals_50")?.total || 0;
    const entertainment = groups.find((g) => g.id === "entertainment_0")?.total || 0;
    return { income, meals, entertainment };
  }, [groups]);

  function onYearChange(nextYear: number) {
    if (nextYear === taxYear) return;
    router.push(`/exports?year=${nextYear}`);
  }

  async function onExport() {
    if (!canExport) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/tax-export?year=${taxYear}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax-year-end-${taxYear}.xlsx`;
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="form-control w-full max-w-xs">
          <span className="label-text text-sm font-medium">Tax year</span>
          <select
            className="select select-bordered"
            value={taxYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            aria-label="Select tax year"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        {!canExport ? (
          <div className="badge badge-ghost badge-lg">Managing partner preview</div>
        ) : null}
      </div>

      <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm">
        <div className="flex gap-2 items-start">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-info" />
          <div className="space-y-1 opacity-90">
            <p>
              Common year-end groupings for Tax CPA review. <strong>Meals</strong> are kept
              separate from <strong>entertainment</strong> (entertainment is generally
              nondeductible; business meals are often limited to 50%).
            </p>
            <p>
              Hybrid package: live seed data when available, with demo fallbacks so every
              CPA-critical bucket is visible for this academic simulation.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Fee / collections ({taxYear})</div>
          <div className="stat-value text-2xl">{formatTaxTotal(totals.income)}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Business meals</div>
          <div className="stat-value text-2xl">{formatTaxTotal(totals.meals)}</div>
          <div className="stat-desc">Often 50% deductible when substantiated</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Entertainment</div>
          <div className="stat-value text-2xl">{formatTaxTotal(totals.entertainment)}</div>
          <div className="stat-desc">Generally nondeductible</div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <section
            key={group.id}
            className="card bg-base-100 border border-base-300 shadow-sm"
          >
            <div className="card-body gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="card-title text-base">{group.title}</h2>
                  <p className="text-sm opacity-70">{group.summary}</p>
                  <p className="text-xs opacity-60 mt-1">{group.deductibilityHint}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-60">Category total</div>
                  <div className="font-semibold">{formatTaxTotal(group.total)}</div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Date</th>
                      <th>Source</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="font-medium">{item.description}</div>
                          {item.reference ? (
                            <div className="text-xs opacity-60">{item.reference}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-sm">{item.date || "—"}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${
                              item.source === "live" ? "badge-success" : "badge-ghost"
                            }`}
                          >
                            {item.source}
                          </span>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {formatTaxTotal(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 opacity-70" />
            <h2 className="card-title text-base">Export for Tax CPA</h2>
          </div>
          {canExport ? (
            <>
              <p className="text-sm opacity-70">
                Downloads an Excel workbook with category sheets plus an{" "}
                <strong>Audit Cover</strong> tab stamped with who exported and when (currently{" "}
                {exporterName}). Share that cover sheet with your Tax CPA for an audit trail.
              </p>
              {error ? (
                <div className="alert alert-error text-sm">
                  <span>{error}</span>
                </div>
              ) : null}
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void onExport()}
                  disabled={busy}
                >
                  <Download className="h-4 w-4" />
                  {busy ? "Preparing Excel…" : `Export ${taxYear} tax package to Excel`}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm opacity-70">
              This is a read-only managing partner preview of the {taxYear} package. Ask
              Billing / Accounting Staff to run the Excel export when the Tax CPA package is
              ready.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
