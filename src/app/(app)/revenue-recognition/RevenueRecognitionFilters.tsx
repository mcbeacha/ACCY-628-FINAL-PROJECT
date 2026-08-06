"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import { BILLING_METHODS } from "@/lib/constants";
import { RECOGNITION_STATUSES } from "@/lib/revenue-recognition";
import Link from "next/link";

type MatterOption = {
  id: string;
  label: string;
};

export function RevenueRecognitionFilters({
  from,
  to,
  matter,
  method,
  status,
  review,
  matters,
  resultCount,
}: {
  from?: string;
  to?: string;
  matter?: string;
  method?: string;
  status?: string;
  review?: string;
  matters: MatterOption[];
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams();
      const next = {
        from: from || "",
        to: to || "",
        matter: matter || "",
        method: method || "",
        status: status || "",
        review: review || "",
        ...patch,
      };
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [from, to, matter, method, status, review, pathname, router]
  );

  const activeCount = [from, to, matter, method, status].filter(Boolean).length;

  return (
    <FilterToolbar
      actions={
        <Link href={pathname} className="btn btn-sm btn-ghost">
          Clear filters
        </Link>
      }
      hint={
        <span className={pending ? "opacity-40" : undefined}>
          {activeCount > 0
            ? `${activeCount} filter${activeCount === 1 ? "" : "s"} · ${resultCount} matters`
            : `${resultCount} matters`}
        </span>
      }
    >
      <FilterField label="Period from" className="w-[9.5rem]">
        <input
          type="date"
          className="input input-bordered input-sm"
          value={from || ""}
          onChange={(e) => pushParams({ from: e.target.value || undefined })}
        />
      </FilterField>
      <FilterField label="Period to" className="w-[9.5rem]">
        <input
          type="date"
          className="input input-bordered input-sm"
          value={to || ""}
          onChange={(e) => pushParams({ to: e.target.value || undefined })}
        />
      </FilterField>
      <FilterField label="Matter / client" className="min-w-[14rem] flex-1 max-w-xs">
        <select
          className="select select-bordered select-sm"
          value={matter || ""}
          onChange={(e) => pushParams({ matter: e.target.value || undefined })}
        >
          <option value="">All</option>
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Fee arrangement" className="w-[11rem]">
        <select
          className="select select-bordered select-sm"
          value={method || ""}
          onChange={(e) => pushParams({ method: e.target.value || undefined })}
        >
          <option value="">All</option>
          {BILLING_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Status" className="w-[11rem]">
        <select
          className="select select-bordered select-sm"
          value={status || ""}
          onChange={(e) => pushParams({ status: e.target.value || undefined })}
        >
          <option value="">All</option>
          {RECOGNITION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FilterField>
    </FilterToolbar>
  );
}
