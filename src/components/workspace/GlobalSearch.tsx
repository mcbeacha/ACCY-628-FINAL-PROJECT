"use client";

import {
  SEARCH_CATEGORY_ORDER,
  searchWorkspace,
  type SearchCategory,
  type SearchRecord,
} from "@/lib/workspace-mock";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // The platform is only known in the browser, so the server renders the
  // Windows/Linux hint and the client swaps it during hydration.
  const shortcut = useSyncExternalStore(subscribeToNothing, getShortcut, () => "Ctrl K");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const grouped = useMemo(() => groupResults(searchWorkspace(query, 12)), [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm hidden md:flex w-64 lg:w-80 justify-start gap-2 border border-base-300 font-normal normal-case"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4 opacity-60 shrink-0" />
        <span className="truncate opacity-60">Search matters, clients, documents…</span>
        <kbd className="kbd kbd-xs ml-auto hidden lg:inline-flex">{shortcut}</kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-square btn-sm md:hidden"
        aria-label="Open global search"
      >
        <Search className="h-5 w-5" />
      </button>

      {open && (
        <dialog className="modal modal-open items-start" aria-label="Global search">
          <div className="modal-box max-w-2xl mt-16 p-0 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-base-300 px-4">
              <Search className="h-4 w-4 opacity-60 shrink-0" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={PLACEHOLDER}
                aria-label={PLACEHOLDER}
                className="input input-ghost w-full border-0 px-0 focus:outline-none"
              />
              <kbd className="kbd kbd-xs">Esc</kbd>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {query.trim() === "" ? (
                <p className="p-6 text-center text-sm opacity-60">
                  Start typing to search matters, clients, documents, tasks, contacts, and attorneys.
                </p>
              ) : grouped.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-medium">No matches for “{query}”</p>
                  <p className="text-sm opacity-60 mt-1">
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
                      {records.map((record) => (
                        <li key={record.id}>
                          <button
                            type="button"
                            onClick={() => go(record.href)}
                            className="w-full rounded-btn px-3 py-2 text-left hover:bg-base-200"
                          >
                            <span className="block text-sm font-medium truncate">
                              {record.title}
                            </span>
                            <span className="block text-xs opacity-60 truncate">
                              {record.subtitle}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close search"
          />
        </dialog>
      )}
    </>
  );
}
