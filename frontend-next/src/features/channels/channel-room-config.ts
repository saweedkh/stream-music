import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  Info,
  LayoutGrid,
  Lightbulb,
  ListMusic,
  MessageSquare,
  Radio,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";

export const CHANNEL_TAB_IDS = [
  "chat",
  "player",
  "queue",
  "suggestions",
  "insights",
  "listeners",
  "admin",
  "health",
] as const;

export type ChannelTabId = (typeof CHANNEL_TAB_IDS)[number];

export type ChannelTabGroup = "listen" | "social" | "dj";

export const CHANNEL_TAB_TO_GROUP: Record<ChannelTabId, ChannelTabGroup> = {
  chat: "social",
  player: "listen",
  queue: "listen",
  suggestions: "listen",
  insights: "social",
  listeners: "social",
  admin: "dj",
  health: "dj",
};

export const CHANNEL_GROUP_LABELS: Record<ChannelTabGroup, string> = {
  listen: "Listen",
  social: "Social",
  dj: "Studio",
};

export type ChannelNavItem = {
  id: ChannelTabId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  group: ChannelTabGroup;
  manageOnly?: boolean;
};

export const CHANNEL_NAV_ITEMS: ChannelNavItem[] = [
  { id: "chat", label: "Chat", shortLabel: "Chat", icon: MessageSquare, group: "social" },
  { id: "player", label: "Playlist", shortLabel: "Music", icon: Radio, group: "listen" },
  { id: "queue", label: "Queue", shortLabel: "Queue", icon: ListMusic, group: "listen" },
  { id: "suggestions", label: "Suggestions", shortLabel: "Suggest", icon: Sparkles, group: "listen" },
  { id: "insights", label: "Insights", shortLabel: "Tips", icon: Lightbulb, group: "social" },
  { id: "listeners", label: "Members", shortLabel: "People", icon: Users, group: "social", manageOnly: true },
  { id: "admin", label: "Control", shortLabel: "Control", icon: Settings2, group: "dj", manageOnly: true },
  { id: "health", label: "Health", shortLabel: "Sync", icon: HeartPulse, group: "dj" },
];

export function channelTabsInGroup(group: ChannelTabGroup, canManage: boolean): ChannelTabId[] {
  const ids = CHANNEL_NAV_ITEMS.filter((n) => n.group === group).map((n) => n.id);
  if (canManage) return ids;
  return ids.filter((id) => {
    const item = CHANNEL_NAV_ITEMS.find((n) => n.id === id);
    return !item?.manageOnly;
  });
}

export function channelGroupForTab(tab: ChannelTabId): ChannelTabGroup {
  return CHANNEL_TAB_TO_GROUP[tab];
}

export function channelTabFromSearch(value: string | null): ChannelTabId | null {
  const raw = value ?? "";
  if (raw === "playlist" || raw === "dj-booth") return "queue";
  return CHANNEL_TAB_IDS.includes(raw as ChannelTabId) ? (raw as ChannelTabId) : null;
}

export function channelNavItemsForContext(canManage: boolean, tabGroup: ChannelTabGroup): ChannelNavItem[] {
  return CHANNEL_NAV_ITEMS.filter((item) => {
    if (item.group !== tabGroup) return false;
    if (item.manageOnly && !canManage) return false;
    return true;
  });
}

// ── Listener-only navigation ──────────────────────────────────────────────────

export const LISTENER_TAB_IDS = ["chat", "suggestions", "queue", "info"] as const;
export type ListenerTabId = (typeof LISTENER_TAB_IDS)[number];

export type ListenerNavItem = {
  id: ListenerTabId;
  labelKey:
    | "room.listener.nav.chat"
    | "room.listener.nav.suggestions"
    | "room.listener.nav.queue"
    | "room.listener.nav.info";
  icon: LucideIcon;
};

export type ListenerNavSection = {
  titleKey: "room.listener.section.listen" | "room.listener.section.about";
  items: ListenerNavItem[];
};

export type ListenerLinkItem = {
  href: string;
  labelKey: "room.listener.nav.dashboard";
  icon: LucideIcon;
};

export const LISTENER_LINK_ITEMS: ListenerLinkItem[] = [
  { href: "/dashboard", labelKey: "room.listener.nav.dashboard", icon: LayoutGrid },
];

export const LISTENER_NAV_SECTIONS: ListenerNavSection[] = [
  {
    titleKey: "room.listener.section.listen",
    items: [
      { id: "chat", labelKey: "room.listener.nav.chat", icon: MessageSquare },
      { id: "suggestions", labelKey: "room.listener.nav.suggestions", icon: Sparkles },
      { id: "queue", labelKey: "room.listener.nav.queue", icon: ListMusic },
    ],
  },
  {
    titleKey: "room.listener.section.about",
    items: [{ id: "info", labelKey: "room.listener.nav.info", icon: Info }],
  },
];

export const LISTENER_NAV_ITEMS: ListenerNavItem[] = LISTENER_NAV_SECTIONS.flatMap((s) => s.items);

// ── Admin / DJ navigation ─────────────────────────────────────────────────────

export type AdminNavItem = {
  id: ChannelTabId;
  labelKey:
    | "room.admin.nav.chat"
    | "room.admin.nav.player"
    | "room.admin.nav.queue"
    | "room.admin.nav.suggestions"
    | "room.admin.nav.insights"
    | "room.admin.nav.listeners"
    | "room.admin.nav.admin"
    | "room.admin.nav.health";
  icon: LucideIcon;
  group: ChannelTabGroup;
  manageOnly?: boolean;
};

export type AdminNavSection = {
  id: ChannelTabGroup;
  titleKey: "room.admin.section.listen" | "room.admin.section.social" | "room.admin.section.studio";
  items: AdminNavItem[];
};

export type AdminLinkItem = {
  href: string;
  labelKey: "room.admin.nav.dashboard";
  icon: LucideIcon;
};

export const ADMIN_LINK_ITEMS: AdminLinkItem[] = [
  { href: "/dashboard", labelKey: "room.admin.nav.dashboard", icon: LayoutGrid },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "listen",
    titleKey: "room.admin.section.listen",
    items: [
      { id: "player", labelKey: "room.admin.nav.player", icon: Radio, group: "listen" },
      { id: "queue", labelKey: "room.admin.nav.queue", icon: ListMusic, group: "listen" },
      { id: "suggestions", labelKey: "room.admin.nav.suggestions", icon: Sparkles, group: "listen" },
    ],
  },
  {
    id: "social",
    titleKey: "room.admin.section.social",
    items: [
      { id: "chat", labelKey: "room.admin.nav.chat", icon: MessageSquare, group: "social" },
      { id: "insights", labelKey: "room.admin.nav.insights", icon: Lightbulb, group: "social" },
      { id: "listeners", labelKey: "room.admin.nav.listeners", icon: Users, group: "social", manageOnly: true },
    ],
  },
  {
    id: "dj",
    titleKey: "room.admin.section.studio",
    items: [
      { id: "admin", labelKey: "room.admin.nav.admin", icon: Settings2, group: "dj", manageOnly: true },
      { id: "health", labelKey: "room.admin.nav.health", icon: HeartPulse, group: "dj" },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

/** Admin tabs that use the full-bleed inline panel layout (no page header / glass shell). */
export const ADMIN_FLUSH_TAB_IDS: ChannelTabId[] = [
  "player",
  "queue",
  "suggestions",
  "listeners",
  "insights",
  "admin",
  "health",
];

export function isAdminFlushTab(tab: ChannelTabId): boolean {
  return ADMIN_FLUSH_TAB_IDS.includes(tab);
}

export function adminNavSectionsForContext(canManage: boolean): AdminNavSection[] {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.manageOnly || canManage),
  })).filter((section) => section.items.length > 0);
}
