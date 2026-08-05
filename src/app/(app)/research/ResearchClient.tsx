"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";

type ResearchTopic =
  | "Civil Procedure"
  | "Contracts"
  | "Employment"
  | "Evidence"
  | "Land Use";

type ResearchItem = {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  summary: string;
  topic: ResearchTopic;
  savedToMatter: string | null;
};

const INITIAL_ITEMS: ResearchItem[] = [
  {
    id: "rs-1",
    title: "Summary judgment standards after Celotex",
    citation: "Celotex Corp. v. Catrett, 477 U.S. 317",
    court: "U.S. Supreme Court",
    year: 1986,
    summary:
      "Clarifies the moving party's burden when there is no genuine dispute of material fact and the nonmovant lacks evidence of an essential element.",
    topic: "Civil Procedure",
    savedToMatter: "2026-0114",
  },
  {
    id: "rs-2",
    title: "Forum selection clauses in commercial contracts",
    citation: "Atlantic Marine Constr. Co. v. U.S. Dist. Ct., 571 U.S. 49",
    court: "U.S. Supreme Court",
    year: 2013,
    summary:
      "Valid forum-selection clauses should be enforced through transfer analysis under § 1404(a), with limited weight given to the plaintiff's choice of forum.",
    topic: "Contracts",
    savedToMatter: null,
  },
  {
    id: "rs-3",
    title: "At-will employment and public-policy exceptions",
    citation: "McArn v. Allied Bruce-Terminix Co., 626 So. 2d 603",
    court: "Mississippi Supreme Court",
    year: 1993,
    summary:
      "Recognizes a narrow wrongful-discharge claim when an employee is terminated for refusing to participate in illegal acts or for reporting illegal acts.",
    topic: "Employment",
    savedToMatter: null,
  },
  {
    id: "rs-4",
    title: "Authentication of electronically stored information",
    citation: "Lorraine v. Markel Am. Ins. Co., 241 F.R.D. 534",
    court: "D. Md.",
    year: 2007,
    summary:
      "Surveys Fed. R. Evid. requirements for admitting ESI, including authenticity, hearsay, original writing, and relevance considerations.",
    topic: "Evidence",
    savedToMatter: "2026-0108",
  },
  {
    id: "rs-5",
    title: "Standing to challenge local zoning ordinances",
    citation: "Lujan v. Defenders of Wildlife, 504 U.S. 555",
    court: "U.S. Supreme Court",
    year: 1992,
    summary:
      "Sets out injury-in-fact, causation, and redressability as the irreducible constitutional minimum of standing for land-use and environmental challenges.",
    topic: "Land Use",
    savedToMatter: "2026-0127",
  },
  {
    id: "rs-6",
    title: "Rule 12(b)(6) plausibility pleading",
    citation: "Ashcroft v. Iqbal, 556 U.S. 662",
    court: "U.S. Supreme Court",
    year: 2009,
    summary:
      "Complaints must state a claim that is plausible on its face; conclusory allegations are disregarded when assessing sufficiency under Rule 8.",
    topic: "Civil Procedure",
    savedToMatter: null,
  },
  {
    id: "rs-7",
    title: "Implied covenant of good faith in supply agreements",
    citation: "Restatement (Second) of Contracts § 205",
    court: "Secondary authority",
    year: 1981,
    summary:
      "Every contract imposes a duty of good faith and fair dealing in performance and enforcement, frequently invoked in vendor and logistics disputes.",
    topic: "Contracts",
    savedToMatter: "2026-0131",
  },
  {
    id: "rs-8",
    title: "Business records exception for carrier logs",
    citation: "Fed. R. Evid. 803(6)",
    court: "Federal Rules of Evidence",
    year: 2024,
    summary:
      "Records kept in the course of a regularly conducted activity may be admitted if made at or near the time by someone with knowledge and properly authenticated.",
    topic: "Evidence",
    savedToMatter: null,
  },
  {
    id: "rs-9",
    title: "Variance standards for dimensional zoning relief",
    citation: "Miss. Code Ann. § 17-1-17",
    court: "Mississippi statutes",
    year: 2023,
    summary:
      "Boards of adjustment may grant variances where strict application would cause unnecessary hardship and the public interest is not impaired.",
    topic: "Land Use",
    savedToMatter: null,
  },
  {
    id: "rs-10",
    title: "Retaliation under Title VII after Burlington Northern",
    citation: "Burlington N. & Santa Fe Ry. Co. v. White, 548 U.S. 53",
    court: "U.S. Supreme Court",
    year: 2006,
    summary:
      "Retaliation claims cover employer actions that would dissuade a reasonable worker from making or supporting a charge of discrimination.",
    topic: "Employment",
    savedToMatter: null,
  },
];

const TOPICS = Array.from(new Set(INITIAL_ITEMS.map((item) => item.topic))).sort((a, b) =>
  a.localeCompare(b)
);

export function ResearchClient() {
  const [items, setItems] = useState<ResearchItem[]>(INITIAL_ITEMS);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [sessionSavedIds, setSessionSavedIds] = useState<string[]>(() =>
    INITIAL_ITEMS.filter((item) => item.savedToMatter).map((item) => item.id)
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (topic && item.topic !== topic) return false;
      if (!q) return true;
      const hay = `${item.title} ${item.citation} ${item.summary}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, topic]);

  const savedItems = items.filter((item) => sessionSavedIds.includes(item.id));

  function toggleSave(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.savedToMatter) {
          return { ...item, savedToMatter: null };
        }
        return { ...item, savedToMatter: "2026-0114" };
      })
    );
    setSessionSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function openItem(title: string) {
    window.alert(`Opening research record (mock):\n\n${title}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body gap-3 sm:flex sm:flex-row sm:items-end">
            <label className="form-control w-full">
              <span className="label-text text-sm font-medium">Search</span>
              <input
                type="search"
                className="input input-bordered"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, citation, or summary"
                aria-label="Search legal research"
              />
            </label>
            <label className="form-control w-full sm:max-w-xs">
              <span className="label-text text-sm font-medium">Topic</span>
              <select
                className="select select-bordered"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                aria-label="Filter by topic"
              >
                <option value="">All topics</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No research results match your filters."
            description="Try a different search term or clear the topic filter."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isSaved = sessionSavedIds.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="card bg-base-100 border border-base-300 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="card-body gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-semibold">{item.title}</h2>
                        <p className="text-sm opacity-80 mt-0.5">{item.citation}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {item.court} · {item.year}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-ghost badge-sm">{item.topic}</span>
                        {isSaved && (
                          <span className="badge badge-success badge-sm">Saved</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm opacity-80">{item.summary}</p>
                    {isSaved && item.savedToMatter && (
                      <p className="text-xs opacity-60">Saved to matter {item.savedToMatter}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm ${isSaved ? "btn-outline" : "btn-primary"}`}
                        onClick={() => toggleSave(item.id)}
                      >
                        {isSaved ? "Remove save" : "Save to matter"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openItem(item.title)}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <aside className="lg:col-span-1">
        <div className="card bg-base-100 border border-base-300 shadow-sm lg:sticky lg:top-4">
          <div className="card-body gap-3">
            <h2 className="font-display text-lg font-semibold">Saved research</h2>
            <p className="text-xs opacity-60">
              Saves apply to this browser session only and are not persisted.
            </p>
            {savedItems.length === 0 ? (
              <p className="text-sm opacity-70">No items saved yet.</p>
            ) : (
              <ul className="space-y-3">
                {savedItems.map((item) => (
                  <li key={item.id} className="border-b border-base-300 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    <p className="text-xs opacity-60 mt-1">{item.citation}</p>
                    {item.savedToMatter && (
                      <p className="text-xs opacity-50 mt-1">Matter {item.savedToMatter}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
