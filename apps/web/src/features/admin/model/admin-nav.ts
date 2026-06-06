import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  Gift,
  LayoutGrid,
  Link2,
  ListMusic,
  Music,
  Server,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

export const ADMIN_SECTIONS = [
  "overview",
  "users",
  "badges",
  "channels",
  "tracks",
  "playlists",
  "imports",
  "premium",
  "system",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function isAdminSection(value: string | null | undefined): value is AdminSection {
  return value != null && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

export type AdminNavItem = {
  id: AdminSection;
  labelKey: MessageKey;
  icon: LucideIcon;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", labelKey: "admin.nav.overview", icon: Activity },
  { id: "users", labelKey: "admin.nav.users", icon: Users },
  { id: "badges", labelKey: "admin.nav.badges", icon: Award },
  { id: "channels", labelKey: "admin.nav.channels", icon: LayoutGrid },
  { id: "tracks", labelKey: "admin.nav.tracks", icon: Music },
  { id: "playlists", labelKey: "admin.nav.playlists", icon: ListMusic },
  { id: "imports", labelKey: "admin.nav.imports", icon: Link2 },
  { id: "premium", labelKey: "admin.nav.premium", icon: Gift },
  { id: "system", labelKey: "admin.nav.system", icon: Server },
];

export function adminSectionMeta(section: AdminSection): { titleKey: MessageKey; descriptionKey?: MessageKey } {
  const map: Record<AdminSection, { titleKey: MessageKey; descriptionKey?: MessageKey }> = {
    overview: { titleKey: "admin.overviewTitle", descriptionKey: "admin.overviewDescription" },
    users: { titleKey: "admin.usersTitle", descriptionKey: "admin.usersDescription" },
    badges: { titleKey: "admin.badgesTitle", descriptionKey: "admin.badgesDescription" },
    channels: { titleKey: "admin.channelsTitle", descriptionKey: "admin.channelsDescription" },
    tracks: { titleKey: "admin.tracksTitle", descriptionKey: "admin.tracksDescription" },
    playlists: { titleKey: "admin.playlistsTitle", descriptionKey: "admin.playlistsDescription" },
    imports: { titleKey: "admin.importsTitle", descriptionKey: "admin.importsDescription" },
    premium: { titleKey: "admin.premiumTitle", descriptionKey: "admin.premiumDescription" },
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
