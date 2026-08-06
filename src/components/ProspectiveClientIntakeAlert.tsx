"use client";

import { evaluationDisplayName, type CaseEvaluation } from "@/lib/case-evaluations";
import { formatDate } from "@/lib/format";
import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "paralegal-intake-alert-dismissed";

type Props = {
  items: Pick<
    CaseEvaluation,
    | "id"
    | "reference_number"
    | "first_name"
    | "last_name"
    | "practice_area"
    | "urgency_level"
    | "submitted_at"
  >[];
};

/**
 * Top-of-workspace banner for new prospective-client case evaluation requests.
 * Reappears when a new (not previously dismissed) request arrives.
 */
export function ProspectiveClientIntakeAlert({ items }: Props) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      setDismissedIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissedIds([]);
    }
    setReady(true);
  }, []);

  const visible = useMemo(
    () => items.filter((item) => !dismissedIds.includes(item.id)),
    [items, dismissedIds]
  );

  function dismiss() {
    const next = Array.from(new Set([...dismissedIds, ...visible.map((i) => i.id)]));
    setDismissedIds(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  if (!ready || visible.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-box border border-warning/40 bg-warning/10 px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
            <BellRing className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-2">
            <div>
              <p className="font-display text-base font-semibold">
                {visible.length === 1
                  ? "New prospective client request"
                  : `${visible.length} new prospective client requests`}
              </p>
              <p className="text-sm opacity-70">
                A prospective client submitted the free case evaluation form. Review and contact them
                from the intake queue.
              </p>
            </div>
            <ul className="space-y-1.5">
              {visible.slice(0, 5).map((item) => (
                <li key={item.id} className="text-sm">
                  <Link
                    href={`/case-evaluations/${item.id}`}
                    className="link link-hover font-medium"
                  >
                    {evaluationDisplayName(item)}
                  </Link>
                  <span className="opacity-60">
                    {" "}
                    · {item.reference_number} · {item.practice_area} · {item.urgency_level} ·{" "}
                    {formatDate(item.submitted_at)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/case-evaluations" className="btn btn-warning btn-sm">
                Open intake queue
              </Link>
              {visible[0] && (
                <Link href={`/case-evaluations/${visible[0].id}`} className="btn btn-outline btn-sm">
                  Review newest
                </Link>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          aria-label="Dismiss intake notifications"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
