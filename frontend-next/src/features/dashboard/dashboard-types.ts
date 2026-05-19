export type DashboardTab = "channels" | "tracks" | "playlists" | "sharing" | "support" | "settings" | "admin";

export const DASHBOARD_TABS: DashboardTab[] = [
  "channels",
  "tracks",
  "playlists",
  "sharing",
  "support",
  "settings",
  "admin",
];

export function isDashboardTab(value: string | null): value is DashboardTab {
  return value !== null && (DASHBOARD_TABS as string[]).includes(value);
}
