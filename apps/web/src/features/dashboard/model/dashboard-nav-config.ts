import type { LucideIcon } from "lucide-react";
import { Bell, Compass, Headphones, KeyRound, LayoutGrid, LifeBuoy, ListMusic, Music, Radio, Share2, User } from "lucide-react";
import {
  ACCOUNT_DASHBOARD_TABS,
  isAccountDashboardTab,
  isDashboardTab,
  type AccountDashboardTab,
  type DashboardTab,
} from "@/features/dashboard/model/dashboard-types";
import type { MessageKey } from "@/lib/i18n/messages";

export type {
  AdminNavItem,
  AdminSection,
} from "@/features/admin/model/admin-nav";
export {
  ADMIN_NAV,
  ADMIN_SECTIONS,
  adminSectionFromSearch,
  adminSectionHref,
  adminSectionMeta,
  isAdminSection,
} from "@/features/admin/model/admin-nav";

export const PROFILE_SECTIONS = ACCOUNT_DASHBOARD_TABS;
export type ProfileSection = AccountDashboardTab;

export function isProfileSection(value: string | null): value is ProfileSection {
  return isAccountDashboardTab(value);
}

/** Maps legacy `?tab=settings&section=` URLs to account dashboard tabs. */
export function dashboardTabFromSearch(params: URLSearchParams): DashboardTab {
  const tab = params.get("tab");
  if (tab === "settings") {
    const section = params.get("section");
    if (section === "security" || section === "notifications") return section;
    return "profile";
  }
  if (tab === "admin") return "channels";
  if (isDashboardTab(tab)) return tab;
  return "channels";
}

export type AccountNavItem = {
  id: AccountDashboardTab;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export const ACCOUNT_NAV: AccountNavItem[] = [
  { id: "profile", labelKey: "profile.nav.profile", icon: User },
  { id: "security", labelKey: "profile.nav.security", icon: KeyRound },
  { id: "notifications", labelKey: "profile.nav.notifications", icon: Bell },
];

/** @deprecated Use ACCOUNT_NAV */
export const PROFILE_NAV = ACCOUNT_NAV;

export type DashboardMainTab = Exclude<DashboardTab, AccountDashboardTab>;

export type DashboardMainNavItem = {
  id: DashboardMainTab;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export type DashboardRouteNavItem = {
  id: "explore";
  href: "/explore";
  labelKey: MessageKey;
  icon: LucideIcon;
};

export type DashboardChannelsNavItem = DashboardMainNavItem | DashboardRouteNavItem;

export function isDashboardRouteNavItem(item: DashboardChannelsNavItem): item is DashboardRouteNavItem {
  return "href" in item;
}

export type DashboardNavSection =
  | {
      id: "channels" | "library" | "help";
      titleKey: MessageKey;
      variant: "main";
      items: DashboardMainNavItem[] | DashboardChannelsNavItem[];
    }
  | {
      id: "account";
      titleKey: MessageKey;
      variant: "account";
      items: AccountNavItem[];
    };

export function dashboardNavSections(_isSuperuser: boolean, isSupportStaff = false): DashboardNavSection[] {
  const helpItems: DashboardMainNavItem[] = [{ id: "support", labelKey: "dashboard.tab.support", icon: LifeBuoy }];
  if (isSupportStaff) {
    helpItems.push({ id: "support_staff", labelKey: "dashboard.tab.supportStaff", icon: Headphones });
  }

  return [
    {
      id: "channels",
      titleKey: "dashboard.sidebar.section.channels",
      variant: "main",
      items: [
        { id: "channels", labelKey: "dashboard.tab.channels", icon: LayoutGrid },
        { id: "following", labelKey: "dashboard.tab.following", icon: Radio },
        { id: "explore", href: "/explore", labelKey: "explore.title", icon: Compass },
      ],
    },
    {
      id: "library",
      titleKey: "dashboard.sidebar.section.library",
      variant: "main",
      items: [
        { id: "tracks", labelKey: "dashboard.tab.tracks", icon: Music },
        { id: "playlists", labelKey: "dashboard.tab.playlists", icon: ListMusic },
        { id: "sharing", labelKey: "dashboard.tab.sharing", icon: Share2 },
      ],
    },
    {
      id: "help",
      titleKey: "dashboard.sidebar.section.help",
      variant: "main",
      items: helpItems,
    },
    {
      id: "account",
      titleKey: "dashboard.sidebar.section.account",
      variant: "account",
      items: ACCOUNT_NAV,
    },
  ];
}
