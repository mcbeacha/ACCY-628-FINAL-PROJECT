/**
 * Helpers to keep demo role views looking like a busy working firm —
 * pad thin live data with curated mock rows without dropping real records.
 */
import type { FocusItem, WorkspaceTask, ActivityEvent } from "@/lib/workspace-mock";

export function padUniqueById<T extends { id: string }>(
  primary: T[],
  fallback: T[],
  limit: number
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...primary, ...fallback]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

export function padTasks(
  live: WorkspaceTask[],
  demo: WorkspaceTask[],
  limit = 20
): WorkspaceTask[] {
  const seen = new Set(live.map((t) => t.name.toLowerCase()));
  const merged = [...live];
  for (const task of demo) {
    if (seen.has(task.name.toLowerCase())) continue;
    seen.add(task.name.toLowerCase());
    merged.push(task);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function padFocus(live: FocusItem[], demo: FocusItem[], limit = 10): FocusItem[] {
  return padUniqueById(live, demo, limit);
}

export function padActivity(
  live: ActivityEvent[],
  demo: ActivityEvent[],
  limit = 12
): ActivityEvent[] {
  return padUniqueById(live, demo, limit);
}

/** Only pad empty weeks so real logged hours stay accurate. */
export function densifyWeekHours(liveHours: number, floor = 22): number {
  if (liveHours > 0) return liveHours;
  return floor;
}

export function densifyBillableHours(liveBillable: number, liveTotal: number, floorTotal = 22): number {
  if (liveTotal > 0) return liveBillable;
  return Math.round(floorTotal * 0.85 * 10) / 10;
}
