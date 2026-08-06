/** Shared headshot paths for fictional Rebel Law Group attorneys. */

export const TEAM_HEADSHOTS: Record<string, string> = {
  "Margaret Sinclair": "/team/margaret-sinclair.png",
  "Jordan Harper": "/team/jordan-harper.png",
  "Avery Chen": "/team/avery-chen.png",
};

export function teamHeadshot(name: string): string | undefined {
  return TEAM_HEADSHOTS[name];
}
