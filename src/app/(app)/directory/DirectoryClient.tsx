"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ProfileCard } from "@/components/workspace/ProfileCard";
import { DIRECTORY, type DirectoryPerson } from "@/lib/workspace-mock";

function uniqueValues(people: DirectoryPerson[], key: keyof DirectoryPerson): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const person of people) {
    const value = String(person[key]);
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values.sort((a, b) => a.localeCompare(b));
}

const OFFICE_OPTIONS = uniqueValues(DIRECTORY, "office");
const DEPARTMENT_OPTIONS = uniqueValues(DIRECTORY, "department");
const TITLE_OPTIONS = uniqueValues(DIRECTORY, "title");
const PRACTICE_AREA_OPTIONS = uniqueValues(DIRECTORY, "practiceArea");

export function DirectoryClient() {
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [practiceArea, setPracticeArea] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DIRECTORY.filter((person) => {
      if (office && person.office !== office) return false;
      if (department && person.department !== department) return false;
      if (title && person.title !== title) return false;
      if (practiceArea && person.practiceArea !== practiceArea) return false;
      if (!q) return true;
      const hay = `${person.name} ${person.title} ${person.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, office, department, title, practiceArea]);

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="form-control xl:col-span-1 sm:col-span-2">
              <span className="label-text text-sm font-medium">Search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input input-bordered"
                placeholder="Name, title, or email"
                aria-label="Search directory by name, title, or email"
              />
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Office</span>
              <select
                className="select select-bordered"
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                aria-label="Filter by office"
              >
                <option value="">All offices</option>
                {OFFICE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Department</span>
              <select
                className="select select-bordered"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                aria-label="Filter by department"
              >
                <option value="">All departments</option>
                {DEPARTMENT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Title</span>
              <select
                className="select select-bordered"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Filter by title"
              >
                <option value="">All titles</option>
                {TITLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Practice Area</span>
              <select
                className="select select-bordered"
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                aria-label="Filter by practice area"
              >
                <option value="">All practice areas</option>
                {PRACTICE_AREA_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <p className="text-sm opacity-70">
        Showing {filtered.length} of {DIRECTORY.length} people
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="No people match your filters"
          description="Try clearing search or selecting a broader office, department, title, or practice area."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((person) => (
            <ProfileCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}
