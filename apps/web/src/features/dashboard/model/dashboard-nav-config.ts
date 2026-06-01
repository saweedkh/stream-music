import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  Bell,
  Compass,
  KeyRound,
  LayoutGrid,
  Headphones,
  LifeBuoy,
  ListMusic,
  Music,
  Radio,
  Server,
  Share2,
  User,
  Users,
} from "lucide-react";
import {
  ACCOUNT_DASHBOARD_TABS,
  isAccountDashboardTab,
  isDashboardTab,
  type AccountDashboardTab,
  type DashboardTab,
} from "@/features/dashboard/model/dashboard-types";
import type { MessageKey } from "@/lib/i18n/messages";

export const PROFILE_SECTIONS = ACCOUNT_DASHBOARD_TABS;
export type ProfileSection = AccountDashboardTab;

export const ADMIN_SECTIONS = ["overview", "users", "badges", "channels", "system"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

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
  if (isDashboardTab(tab)) return tab;
  return "channels";
}

export function adminSectionFromSearch(params: URLSearchParams): AdminSection {
  const raw = params.get("adminSection");
  return isAdminSection(raw) ? raw : "overview";
}

export function isAdminSection(value: string | null): value is AdminSection {
  return value !== null && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

export type AccountNavItem = {
  id: AccountDashboardTab;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export type AdminNavItem = {
  id: AdminSection;
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

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", labelKey: "admin.nav.overview", icon: Activity },
  { id: "users", labelKey: "admin.nav.users", icon: Users },
  { id: "badges", labelKey: "admin.nav.badges", icon: Award },
  { id: "channels", labelKey: "admin.nav.channels", icon: LayoutGrid },
  { id: "system", labelKey: "admin.nav.system", icon: Server },
];

export type DashboardMainTab = Exclude<DashboardTab, AccountDashboardTab | "admin">;

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
    }
  | {
      id: "admin";
      titleKey: MessageKey;
      variant: "admin";
      items: AdminNavItem[];
    };

export function dashboardNavSections(isSuperuser: boolean, isSupportStaff = false): DashboardNavSection[] {
  const helpItems: DashboardMainNavItem[] = [{ id: "support", labelKey: "dashboard.tab.support", icon: LifeBuoy }];
  if (isSupportStaff) {
    helpItems.push({ id: "support_staff", labelKey: "dashboard.tab.supportStaff", icon: Headphones });
  }

  const sections: DashboardNavSection[] = [
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

  if (isSuperuser) {
    sections.push({
      id: "admin",
      titleKey: "dashboard.sidebar.section.admin",
      variant: "admin",
      items: ADMIN_NAV,
    });
  }

  return sections;
}

export function adminSectionMeta(section: AdminSection): { titleKey: MessageKey; descriptionKey?: MessageKey } {
  const map: Record<AdminSection, { titleKey: MessageKey; descriptionKey?: MessageKey }> = {
    overview: { titleKey: "admin.overviewTitle", descriptionKey: "admin.overviewDescription" },
    users: { titleKey: "admin.usersTitle" },
    badges: { titleKey: "admin.badgesTitle", descriptionKey: "admin.badgesDescription" },
    channels: { titleKey: "admin.channelsTitle" },
    system: { titleKey: "admin.systemTitle", descriptionKey: "admin.systemDescription" },
  };
  return map[section];
}
