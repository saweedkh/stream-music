import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  ClipboardList,
  CreditCard,
  Gift,
  Headphones,
  LayoutGrid,
  Link2,
  ListMusic,
  MessageSquareWarning,
  Music,
  Radio,
  Receipt,
  Server,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

export const ADMIN_SECTIONS = [
  "overview",
  "analytics",
  "auditLog",
  "users",
  "badges",
  "premium",
  "redemptions",
  "billing",
  "social",
  "channels",
  "tracks",
  "playlists",
  "imports",
  "support",
  "moderation",
  "joinRequests",
  "suggestions",
  "live",
  "integrations",
  "system",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export type AdminNavSectionId = "dashboard" | "people" | "content" | "operations";

export type AdminNavItem = {
  id: AdminSection;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export type AdminNavSection = {
  id: AdminNavSectionId;
  titleKey: MessageKey;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "dashboard",
    titleKey: "admin.sidebar.section.dashboard",
    items: [
      { id: "overview", labelKey: "admin.nav.overview", icon: Activity },
      { id: "analytics", labelKey: "admin.nav.analytics", icon: BarChart3 },
      { id: "auditLog", labelKey: "admin.nav.auditLog", icon: ClipboardList },
      { id: "system", labelKey: "admin.nav.system", icon: Server },
    ],
  },
  {
    id: "people",
    titleKey: "admin.sidebar.section.people",
    items: [
      { id: "users", labelKey: "admin.nav.users", icon: Users },
      { id: "badges", labelKey: "admin.nav.badges", icon: Award },
      { id: "premium", labelKey: "admin.nav.premium", icon: Gift },
      { id: "redemptions", labelKey: "admin.nav.redemptions", icon: Receipt },
      { id: "billing", labelKey: "admin.nav.billing", icon: CreditCard },
      { id: "social", labelKey: "admin.nav.social", icon: Share2 },
    ],
  },
  {
    id: "content",
    titleKey: "admin.sidebar.section.content",
    items: [
      { id: "channels", labelKey: "admin.nav.channels", icon: LayoutGrid },
      { id: "tracks", labelKey: "admin.nav.tracks", icon: Music },
      { id: "playlists", labelKey: "admin.nav.playlists", icon: ListMusic },
      { id: "imports", labelKey: "admin.nav.imports", icon: Link2 },
    ],
  },
  {
    id: "operations",
    titleKey: "admin.sidebar.section.operations",
    items: [
      { id: "support", labelKey: "admin.nav.support", icon: Headphones },
      { id: "moderation", labelKey: "admin.nav.moderation", icon: MessageSquareWarning },
      { id: "joinRequests", labelKey: "admin.nav.joinRequests", icon: UserPlus },
      { id: "suggestions", labelKey: "admin.nav.suggestions", icon: Sparkles },
      { id: "live", labelKey: "admin.nav.live", icon: Radio },
      { id: "integrations", labelKey: "admin.nav.integrations", icon: Webhook },
    ],
  },
];

/** Flat list — used by overview quick links and legacy exports. */
export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap((section) => section.items);

export function isAdminSection(value: string | null | undefined): value is AdminSection {
  return value != null && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

export function adminSectionMeta(section: AdminSection): { titleKey: MessageKey; descriptionKey?: MessageKey } {
  const map: Record<AdminSection, { titleKey: MessageKey; descriptionKey?: MessageKey }> = {
    overview: { titleKey: "admin.overviewTitle", descriptionKey: "admin.overviewDescription" },
    analytics: { titleKey: "admin.analyticsTitle", descriptionKey: "admin.analyticsDescription" },
    auditLog: { titleKey: "admin.auditTitle", descriptionKey: "admin.auditDescription" },
    users: { titleKey: "admin.usersTitle", descriptionKey: "admin.usersDescription" },
    badges: { titleKey: "admin.badgesTitle", descriptionKey: "admin.badgesDescription" },
    premium: { titleKey: "admin.premiumTitle", descriptionKey: "admin.premiumDescription" },
    redemptions: { titleKey: "admin.redemptionsTitle", descriptionKey: "admin.redemptionsDescription" },
    billing: { titleKey: "admin.billingTitle", descriptionKey: "admin.billingDescription" },
    social: { titleKey: "admin.socialTitle", descriptionKey: "admin.socialDescription" },
    channels: { titleKey: "admin.channelsTitle", descriptionKey: "admin.channelsDescription" },
    tracks: { titleKey: "admin.tracksTitle", descriptionKey: "admin.tracksDescription" },
    playlists: { titleKey: "admin.playlistsTitle", descriptionKey: "admin.playlistsDescription" },
    imports: { titleKey: "admin.importsTitle", descriptionKey: "admin.importsDescription" },
    support: { titleKey: "admin.supportTitle", descriptionKey: "admin.supportDescription" },
    moderation: { titleKey: "admin.moderationTitle", descriptionKey: "admin.moderationDescription" },
    joinRequests: { titleKey: "admin.joinRequestsTitle", descriptionKey: "admin.joinRequestsDescription" },
    suggestions: { titleKey: "admin.suggestionsTitle", descriptionKey: "admin.suggestionsDescription" },
    live: { titleKey: "admin.liveTitle", descriptionKey: "admin.liveDescription" },
    integrations: { titleKey: "admin.integrationsTitle", descriptionKey: "admin.integrationsDescription" },
    system: { titleKey: "admin.systemTitle", descriptionKey: "admin.systemDescription" },
  };
  return map[section];
}

/** `/admin` or `/admin/users` */
export function adminSectionHref(section: AdminSection): string {
  return section === "overview" ? "/admin" : `/admin/${section}`;
}

export function adminSectionFromPath(segments: string[] | undefined): AdminSection {
  const raw = segments?.[0];
  if (!raw) return "overview";
  return isAdminSection(raw) ? raw : "overview";
}

/** Legacy query param on /dashboard?tab=admin&adminSection=… */
export function adminSectionFromSearch(params: URLSearchParams): AdminSection {
  const raw = params.get("adminSection");
  return isAdminSection(raw) ? raw : "overview";
}

export function adminNavSectionForItem(section: AdminSection): AdminNavSectionId {
  for (const group of ADMIN_NAV_SECTIONS) {
    if (group.items.some((item) => item.id === section)) return group.id;
  }
  return "dashboard";
}

export function defaultExpandedAdminSections(activeSection: AdminSection): Record<AdminNavSectionId, boolean> {
  const activeGroup = adminNavSectionForItem(activeSection);
  return {
    dashboard: activeGroup === "dashboard",
    people: activeGroup === "people",
    content: activeGroup === "content",
    operations: activeGroup === "operations",
  };
}
