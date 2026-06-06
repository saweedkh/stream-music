import type { LucideIcon } from "lucide-react";
import { Bell, Headphones, KeyRound, LayoutGrid, LifeBuoy, ListMusic, Music, Radio, Share2, User } from "lucide-react";
import type { DashboardTab } from "@/features/dashboard/model/dashboard-types";
import type { MessageKey } from "@/lib/i18n/messages";

export type DashboardTabMeta = {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
};

export const DASHBOARD_TAB_ICONS: Record<DashboardTab, LucideIcon> = {
  channels: LayoutGrid,
  following: Radio,
  tracks: Music,
  playlists: ListMusic,
  sharing: Share2,
  support: LifeBuoy,
  support_staff: Headphones,
  profile: User,
  security: KeyRound,
  notifications: Bell,
};

export const DASHBOARD_TAB_META: Record<DashboardTab, DashboardTabMeta> = {
  channels: {
    titleKey: "dashboard.page.channels.title",
    descriptionKey: "dashboard.page.channels.description",
  },
  following: {
    titleKey: "dashboard.page.following.title",
    descriptionKey: "dashboard.page.following.description",
  },
  tracks: {
    titleKey: "dashboard.page.tracks.title",
    descriptionKey: "dashboard.page.tracks.description",
  },
  playlists: {
    titleKey: "dashboard.page.playlists.title",
    descriptionKey: "dashboard.page.playlists.description",
  },
  sharing: {
    titleKey: "dashboard.page.sharing.title",
    descriptionKey: "dashboard.page.sharing.description",
  },
  support: {
    titleKey: "dashboard.page.support.title",
    descriptionKey: "dashboard.page.support.description",
  },
  support_staff: {
    titleKey: "dashboard.page.supportStaff.title",
    descriptionKey: "dashboard.page.supportStaff.description",
  },
  profile: {
    titleKey: "dashboard.page.profile.title",
    descriptionKey: "dashboard.page.profile.description",
  },
  security: {
    titleKey: "dashboard.page.security.title",
    descriptionKey: "dashboard.page.security.description",
  },
  notifications: {
    titleKey: "dashboard.page.notifications.title",
    descriptionKey: "dashboard.page.notifications.description",
  },
};
