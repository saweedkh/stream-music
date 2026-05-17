import type { DashboardTab } from "@/features/dashboard/dashboard-types";
import type { MessageKey } from "@/lib/i18n/messages";

export type DashboardTabMeta = {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
};

export const DASHBOARD_TAB_META: Record<DashboardTab, DashboardTabMeta> = {
  channels: {
    titleKey: "dashboard.page.channels.title",
    descriptionKey: "dashboard.page.channels.description",
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
  settings: {
    titleKey: "dashboard.page.settings.title",
    descriptionKey: "dashboard.page.settings.description",
  },
};
