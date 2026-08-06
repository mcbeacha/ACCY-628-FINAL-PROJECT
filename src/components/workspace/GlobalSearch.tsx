"use client";

import {
  SEARCH_CATEGORY_ORDER,
  searchWorkspace,
  type SearchCategory,
  type SearchRecord,
} from "@/lib/workspace-mock";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

const PLACEHOLDER = "Search matters, clients, documents, tasks, or contacts…";

function groupResults(results: SearchRecord[]): [SearchCategory, SearchRecord[]][] {
  return SEARCH_CATEGORY_ORDER.map(
    (category) => [category, results.filter((r) => r.category === category)] as const
  ).filter((entry): entry is [SearchCategory, SearchRecord[]] => entry[1].length > 0);
}

export function GlobalSearch() {
  const router = useRouter();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const grouped = useMemo(() => groupResults(searchWorkspace(query, 12)), [query]);
  const flatResults = useMemo(() => grouped.flatMap(([, records]) => records), [grouped]);

  function openSearch() {
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(href: string) {
    closeSearch();
    router.push(href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter" && flatResults[activeIndex]) {
      event.preventDefault();
      go(flatResults[activeIndex].href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="btn btn-ghost btn-square"
        aria-label="Open search"
        title="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
          <button
            type="button"
            className="absolute inset-0 bg-base-content/40"
            aria-label="Close search"
            onClick={closeSearch}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[101] w-full max-w-xl overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-base-300 px-4">
              <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={PLACEHOLDER}
                aria-label={PLACEHOLDER}
                className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:opacity-60"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Close search"
                onClick={closeSearch}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p id={titleId} className="sr-only">
              Workspace search
            </p>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {query.trim() === "" ? (
                <p className="p-6 text-center text-sm opacity-70">
                  Type to search matters, clients, documents, tasks, contacts, and attorneys.
                  <span className="mt-2 block text-xs opacity-60">
                    Try “matter”, “harbor”, or “engagement”.
                  </span>
                </p>
              ) : grouped.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-medium">No matches for “{query}”</p>
                  <p className="mt-1 text-sm opacity-60">
                    Try a matter number, client name, or document title.
                  </p>
                </div>
              ) : (
                grouped.map(([category, records]) => (
                  <section key={category} className="mb-2">
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide opacity-50">
                      {category}
                    </p>
                    <ul>
                      {records.map((record) => {
                        const index = flatResults.indexOf(record);
                        const active = index === activeIndex;
                        return (
                          <li key={record.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => go(record.href)}
                              className={`w-full rounded-btn px-3 py-2.5 text-left ${
                                active ? "bg-base-200" : "hover:bg-base-200"
                              }`}
                            >
                              <span className="block truncate text-sm font-medium">
                                {record.title}
                              </span>
                              <span className="block truncate text-xs opacity-60">
                                {record.subtitle}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
