"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency } from "@/lib/format";
import type { MatterRecognitionRow } from "@/lib/revenue-recognition";
import Link from "next/link";

export function MatterReviewDrawer({ detail }: { detail: MatterRecognitionRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("review");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="rr-drawer-title">
      <div className="modal-box ml-auto mr-0 h-full max-h-full w-full max-w-md rounded-none sm:rounded-l-box shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="rr-drawer-title" className="font-semibold text-lg">
              {detail.matterNumber}
            </h2>
            <p className="text-sm opacity-70">{detail.clientName}</p>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={close} aria-label="Close">
            Close
          </button>
        </div>

        <div className="overflow-y-auto flex-1 mt-4 space-y-5 pr-1">
          <section>
            <h3 className="text-xs uppercase tracking-wide opacity-60 font-semibold mb-2">
              Matter summary
            </h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Matter</dt>
                <dd className="text-right font-medium">{detail.matterNumber}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Client</dt>
                <dd className="text-right">{detail.clientName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Fee arrangement</dt>
                <dd className="text-right">{detail.billingMethod}</dd>
              </div>
              {detail.responsibleAttorney && (
                <div className="flex justify-between gap-2">
                  <dt className="opacity-60">Responsible attorney</dt>
                  <dd className="text-right">{detail.responsibleAttorney}</dd>
                </div>
              )}
              {detail.matterDescription && (
                <div className="pt-1">
                  <dt className="opacity-60 mb-0.5">Description</dt>
                  <dd className="text-sm leading-relaxed">{detail.matterDescription}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide opacity-60 font-semibold mb-2">
              Financial position
            </h3>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Billed</dt>
                <dd className="tabular-nums">{formatCurrency(detail.amountBilled)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Collected</dt>
                <dd className="tabular-nums">{formatCurrency(detail.amountCollected)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Recognized revenue</dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(detail.reportedRecognizedRevenue)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Unbilled earned fees</dt>
                <dd className="tabular-nums">
                  {detail.earnedButNotBilled != null
                    ? formatCurrency(detail.earnedButNotBilled)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-60">Client funds held</dt>
                <dd className="tabular-nums">{formatCurrency(detail.unearnedOrTrust)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide opacity-60 font-semibold mb-2">
              Recognition assessment
            </h3>
            <div className="mb-2">
              <span className="whitespace-nowrap inline-flex">
                <StatusBadge status={detail.recognitionStatus} />
              </span>
            </div>
            <p className="text-sm mb-2">{detail.statusDetail}</p>
            <dl className="text-sm space-y-2">
              <div>
                <dt className="opacity-60 text-xs uppercase tracking-wide">Recognition basis</dt>
                <dd>{detail.recognitionBasis}</dd>
              </div>
              <div>
                <dt className="opacity-60 text-xs uppercase tracking-wide">Recognition trigger</dt>
                <dd>{detail.recognitionTrigger}</dd>
              </div>
              <div>
                <dt className="opacity-60 text-xs uppercase tracking-wide">
                  Recommended accounting treatment
                </dt>
                <dd>{detail.recommendedTreatment}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide opacity-60 font-semibold mb-2">
              Supporting documentation
            </h3>
            <ul className="text-sm space-y-1.5">
              {detail.evidenceStatements.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-base-content/40 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            {detail.evidence.some((e) => e.href) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.evidence
                  .filter((e) => e.href && e.present)
                  .map((e) => (
                    <Link key={e.label} href={e.href!} className="btn btn-xs btn-outline">
                      {e.label}
                    </Link>
                  ))}
              </div>
            )}
          </section>

          {detail.collectionNotes.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide opacity-60 font-semibold mb-2">
                Collection notes
              </h3>
              <p className="text-xs opacity-60 mb-1">
                Collection status is separate from revenue recognition.
              </p>
              <ul className="text-sm list-disc list-inside space-y-0.5">
                {detail.collectionNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop bg-base-content/40"
        aria-label="Close drawer"
        onClick={close}
      />
    </div>
  );
}
