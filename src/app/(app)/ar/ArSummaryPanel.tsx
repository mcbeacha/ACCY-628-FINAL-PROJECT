"use client";

import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

export type ArSummaryInvoiceItem = {
  id: string;
  invoiceNumber: string;
  clientLabel: string;
  matterNumber: string;
  dueDate: string;
  balanceLabel: string;
  status: string;
};

export type ArSummaryPaymentItem = {
  id: string;
  paymentNumber: string;
  totalLabel: string;
  unappliedLabel: string;
};

export type ArSummaryCategory = {
  id: string;
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success" | "error";
  kind: "invoice" | "payment";
  items: ArSummaryInvoiceItem[] | ArSummaryPaymentItem[];
};

function toneBorder(tone: ArSummaryCategory["tone"]) {
  if (tone === "warning") return "border-warning/40";
  if (tone === "success") return "border-success/40";
  if (tone === "error") return "border-error/40";
  return "border-base-300";
}

function CategoryDetails({
  category,
  onClose,
}: {
  category: ArSummaryCategory;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
      <div className="px-3 py-2 border-b border-base-200 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{category.label}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-55 tabular-nums">
            {category.items.length}{" "}
            {category.items.length === 1 ? "record" : "records"}
          </span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {category.items.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No records in this category." />
        </div>
      ) : category.kind === "payment" ? (
        <div className="table-wrap">
          <table className="table table-sm">
            <thead>
              <tr className="text-xs">
                <th>Payment</th>
                <th className="text-right">Total</th>
                <th className="text-right">Unapplied</th>
              </tr>
            </thead>
            <tbody>
              {(category.items as ArSummaryPaymentItem[]).map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href="/payments" className="link link-hover font-medium">
                      {p.paymentNumber}
                    </Link>
                  </td>
                  <td className="text-sm text-right tabular-nums">{p.totalLabel}</td>
                  <td className="text-sm text-right font-semibold tabular-nums">
                    {p.unappliedLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table-sm">
            <thead>
              <tr className="text-xs">
                <th>Invoice</th>
                <th>Client</th>
                <th>Matter</th>
                <th>Due</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(category.items as ArSummaryInvoiceItem[]).map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="link link-hover font-medium"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="text-sm">{inv.clientLabel}</td>
                  <td className="text-sm">{inv.matterNumber}</td>
                  <td className="text-sm whitespace-nowrap">{inv.dueDate}</td>
                  <td className="text-sm text-right font-semibold tabular-nums">
                    {inv.balanceLabel}
                  </td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ArSummaryPanel({ categories }: { categories: ArSummaryCategory[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  useEffect(() => {
    if (!openId || !detailRef.current) return;
    detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [openId]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {categories.map((cat) => {
        const selected = openId === cat.id;
        return (
          <Fragment key={cat.id}>
            <button
              type="button"
              onClick={() => toggle(cat.id)}
              aria-expanded={selected}
              aria-controls={selected ? `ar-category-${cat.id}` : undefined}
              className={[
                "card bg-base-100 border shadow-sm text-left interactive-card transition-shadow self-start",
                toneBorder(cat.tone),
                selected
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/40",
              ].join(" ")}
            >
              <div className="card-body p-4 sm:p-5">
                <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">
                  {cat.label}
                </p>
                <p className="text-3xl font-semibold font-display mt-1">{cat.value}</p>
                <p className="text-xs text-primary mt-2 opacity-80">
                  {selected ? "Hide details" : "Show details"}{" "}
                  <span className="cta-arrow-nudge inline-block" aria-hidden>
                    {selected ? "↑" : "→"}
                  </span>
                </p>
              </div>
            </button>

            {selected && (
              <div
                ref={detailRef}
                id={`ar-category-${cat.id}`}
                className="col-span-full"
              >
                <CategoryDetails category={cat} onClose={() => setOpenId(null)} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
