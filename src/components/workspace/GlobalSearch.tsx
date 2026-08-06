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
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

const PLACEHOLDER = "Search matters, clients, documents, tasks, or contacts…";

/** The keyboard hint never changes after load, so there is nothing to watch. */
function subscribeToNothing(): () => void {
  return () => {};
}

function getShortcut(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
}

function groupResults(results: SearchRecord[]): [SearchCategory, SearchRecord[]][] {
  return SEARCH_CATEGORY_ORDER.map(
    (category) => [category, results.filter((r) => r.category === category)] as const
  ).filter((entry): entry is [SearchCategory, SearchRecord[]] => entry[1].length > 0);
}

export function GlobalSearch() {
  const router = useRouter();
  const resultsId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // The platform is only known in the browser, so the server renders the
  // Windows/Linux hint and the client swaps it during hydration.
  const shortcut = useSyncExternalStore(subscribeToNothing, getShortcut, () => "Ctrl K");

  const grouped = useMemo(() => groupResults(searchWorkspace(query, 12)), [query]);
  const flatResults = useMemo(() => grouped.flatMap(([, records]) => records), [grouped]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keep the panel open while interacting inside search; only close on outside click / Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
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

  const showPanel = open;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 shadow-sm">
        <Search className="h-4 w-4 opacity-60 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search…"
          aria-label={PLACEHOLDER}
          aria-expanded={showPanel}
          aria-controls={resultsId}
          className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:opacity-50"
        />
        {query ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="kbd kbd-xs hidden lg:inline-flex shrink-0">{shortcut}</kbd>
        )}
      </div>

      {showPanel && (
        <div
          id={resultsId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[60] rounded-box border border-base-300 bg-base-100 shadow-lg max-h-96 overflow-y-auto"
        >
          {query.trim() === "" ? (
            <p className="p-4 text-center text-sm opacity-60">
              Start typing to search matters, clients, documents, tasks, contacts, and attorneys.
            </p>
          ) : grouped.length === 0 ? (
            <div className="p-4 text-center">
              <p className="font-medium text-sm">No matches for “{query}”</p>
              <p className="text-xs opacity-60 mt-1">
                Try a matter number, client name, or document title.
              </p>
            </div>
          ) : (
            <div className="p-2">
              {grouped.map(([category, records]) => (
                <section key={category} className="mb-1">
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
                            role="option"
                            aria-selected={active}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => go(record.href)}
                            className={`w-full rounded-btn px-3 py-2 text-left ${
                              active ? "bg-base-200" : "hover:bg-base-200"
                            }`}
                          >
                            <span className="block text-sm font-medium truncate">
                              {record.title}
                            </span>
                            <span className="block text-xs opacity-60 truncate">
                              {record.subtitle}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
