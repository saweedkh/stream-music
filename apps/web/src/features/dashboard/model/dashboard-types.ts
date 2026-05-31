export type DashboardTab =
  | "channels"
  | "following"
  | "tracks"
  | "playlists"
  | "sharing"
  | "support"
  | "profile"
  | "security"
  | "notifications"
  | "admin";

export const DASHBOARD_TABS: DashboardTab[] = [
  "channels",
  "following",
  "tracks",
  "playlists",
  "sharing",
  "support",
  "profile",
  "security",
  "notifications",
  "admin",
];

export const ACCOUNT_DASHBOARD_TABS = ["profile", "security", "notifications"] as const;
export type AccountDashboardTab = (typeof ACCOUNT_DASHBOARD_TABS)[number];

export function isAccountDashboardTab(value: string | null): value is AccountDashboardTab {
  return value !== null && (ACCOUNT_DASHBOARD_TABS as readonly string[]).includes(value);
}

export function isDashboardTab(value: string | null): value is DashboardTab {
  return value !== null && (DASHBOARD_TABS as string[]).includes(value);
}

/** @deprecated Use AccountDashboardTab */
export type ProfileSection = AccountDashboardTab;
