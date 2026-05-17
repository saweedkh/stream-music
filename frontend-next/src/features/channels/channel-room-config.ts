import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  Lightbulb,
  ListMusic,
  MessageSquare,
  Radio,
  Settings2,
  Users,
} from "lucide-react";

export const CHANNEL_TAB_IDS = [
  "chat",
  "player",
  "queue",
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
