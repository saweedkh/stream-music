import type { LucideIcon } from "lucide-react";
import { Crown, LayoutGrid, LifeBuoy, ListMusic, Music, Radio, Share2, UserCircle } from "lucide-react";
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
  settings: UserCircle,
  admin: Crown,
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
  settings: {
    titleKey: "dashboard.page.settings.title",
    descriptionKey: "dashboard.page.settings.description",
  },
  admin: {
    titleKey: "dashboard.page.admin.title",
    descriptionKey: "dashboard.page.admin.description",
  },
};
