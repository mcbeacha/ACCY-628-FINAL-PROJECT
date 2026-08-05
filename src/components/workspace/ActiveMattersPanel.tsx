"use client";

import { EmptyState } from "@/components/EmptyState";
import { MatterCard, type MatterCardData } from "@/components/workspace/MatterCard";
import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const PINNED_KEY = "rlg-pinned-matters";

/**
 * Pinned matters live in localStorage, which is external to React, so the
 * panel subscribes to it rather than mirroring it into component state.
 */
let snapshot: string | null = null;
let listeners: (() => void)[] = [];

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): string {
  if (snapshot === null) {
    try {
      snapshot = window.localStorage.getItem(PINNED_KEY) ?? "[]";
    } catch {
      snapshot = "[]";
    }
  }
  return snapshot;
}

function getServerSnapshot(): string {
  return "[]";
}

function writeSnapshot(value: string[]) {
  snapshot = JSON.stringify(value);
  try {
    window.localStorage.setItem(PINNED_KEY, snapshot);
  } catch {
    // Storage is unavailable in private browsing; pinning lasts for the session.
  }
  for (const listener of listeners) listener();
}

export function ActiveMattersPanel({ matters }: { matters: MatterCardData[] }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pinned = useMemo<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [raw]);

  const togglePin = useCallback(
    (id: string) => {
      writeSnapshot(pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id]);
    },
    [pinned]
  );

  if (matters.length === 0) {
    return (
      <EmptyState
        title="No active matters"
        description="Matters assigned to you will appear here once they are opened and approved."
        action={
          <Link href="/matters/new" className="btn btn-primary btn-sm">
            Open a new matter
          </Link>
        }
      />
    );
  }

  const ordered = [...matters].sort((a, b) => {
    const ap = pinned.includes(a.id) ? 0 : 1;
    const bp = pinned.includes(b.id) ? 0 : 1;
    return ap - bp;
  });

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ordered.map((matter) => (
        <MatterCard
          key={matter.id}
          matter={matter}
          pinned={pinned.includes(matter.id)}
          onTogglePin={togglePin}
        />
      ))}
    </div>
  );
}
