import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  Bell,
  Compass,
  Crown,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  ListMusic,
  Music,
  Palette,
  Radio,
  Server,
  Share2,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";
import type { MessageKey } from "@/lib/i18n/messages";

export const PROFILE_SECTIONS = ["overview", "profile", "appearance", "security", "notifications"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const ADMIN_SECTIONS = ["overview", "users", "badges", "channels", "system"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function isProfileSection(value: string | null): value is ProfileSection {
  return value !== null && (PROFILE_SECTIONS as readonly string[]).includes(value);
}

export function isAdminSection(value: string | null): value is AdminSection {
  return value !== null && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

export function profileSectionFromSearch(params: URLSearchParams): ProfileSection {
  const raw = params.get("section");
  return isProfileSection(raw) ? raw : "overview";
}

export function adminSectionFromSearch(params: URLSearchParams): AdminSection {
  const raw = params.get("adminSection");
  return isAdminSection(raw) ? raw : "overview";
}

export type ProfileNavItem = {
  id: ProfileSection;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export type AdminNavItem = {
  id: AdminSection;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export const PROFILE_NAV: ProfileNavItem[] = [
  { id: "overview", labelKey: "profile.nav.overview", icon: Sparkles },
  { id: "profile", labelKey: "profile.nav.profile", icon: User },
  { id: "appearance", labelKey: "profile.nav.appearance", icon: Palette },
  { id: "security", labelKey: "profile.nav.security", icon: KeyRound },
  { id: "notifications", labelKey: "profile.nav.notifications", icon: Bell },
];

export function profileNavIconForSection(section: ProfileSection): LucideIcon | undefined {
  return PROFILE_NAV.find((item) => item.id === section)?.icon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", labelKey: "admin.nav.overview", icon: Activity },
  { id: "users", labelKey: "admin.nav.users", icon: Users },
  { id: "badges", labelKey: "admin.nav.badges", icon: Award },
  { id: "channels", labelKey: "admin.nav.channels", icon: LayoutGrid },
  { id: "system", labelKey: "admin.nav.system", icon: Server },
];

export type DashboardMainTab = Exclude<DashboardTab, "settings" | "admin">;

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
      id: "channels" | "library" | "help" | "favorites";
      titleKey: MessageKey;
      variant: "main";
      items: DashboardMainNavItem[] | DashboardChannelsNavItem[];
    }
  | {
      id: "account";
      titleKey: MessageKey;
      variant: "account";
      items: ProfileNavItem[];
    }
  | {
      id: "admin";
      titleKey: MessageKey;
      variant: "admin";
      items: AdminNavItem[];
    };

export function dashboardNavSections(isSuperuser: boolean): DashboardNavSection[] {
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
      items: [{ id: "support", labelKey: "dashboard.tab.support", icon: LifeBuoy }],
    },
    {
      id: "favorites",
      titleKey: "dashboard.sidebar.section.favorites",
      variant: "main",
      items: [
        { id: "favoritePlaylists", labelKey: "profile.nav.favoritePlaylists", icon: ListMusic },
        { id: "favoriteTracks", labelKey: "profile.nav.favoriteTracks", icon: Music },
      ],
    },
    {
      id: "account",
      titleKey: "dashboard.sidebar.section.account",
      variant: "account",
      items: PROFILE_NAV,
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

export function profileSectionMeta(section: ProfileSection): { titleKey: MessageKey; descriptionKey: MessageKey } {
  const map: Record<ProfileSection, { titleKey: MessageKey; descriptionKey: MessageKey }> = {
    overview: { titleKey: "profile.sectionOverviewTitle", descriptionKey: "profile.sectionOverviewDescription" },
    profile: { titleKey: "profile.accountTitle", descriptionKey: "profile.accountDescription" },
    appearance: { titleKey: "profile.appearanceTitle", descriptionKey: "profile.appearanceDescription" },
    security: { titleKey: "profile.securityTitle", descriptionKey: "profile.securityDescription" },
    notifications: {
      titleKey: "profile.sectionNotificationsTitle",
      descriptionKey: "profile.sectionNotificationsDescription",
    },
  };
  return map[section];
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
