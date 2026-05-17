import type { ChannelTabId } from "@/features/channels/channel-room-config";
import type { MessageKey } from "@/lib/i18n/messages";

export type AdminTabMeta = {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
};

export const ADMIN_TAB_META: Record<ChannelTabId, AdminTabMeta> = {
  chat: {
    titleKey: "room.admin.tab.chat.title",
    descriptionKey: "room.admin.tab.chat.description",
  },
  player: {
    titleKey: "room.admin.tab.player.title",
    descriptionKey: "room.admin.tab.player.description",
  },
  queue: {
    titleKey: "room.admin.tab.queue.title",
    descriptionKey: "room.admin.tab.queue.description",
  },
  suggestions: {
    titleKey: "room.admin.tab.suggestions.title",
    descriptionKey: "room.admin.tab.suggestions.description",
  },
  insights: {
    titleKey: "room.admin.tab.insights.title",
    descriptionKey: "room.admin.tab.insights.description",
  },
  listeners: {
    titleKey: "room.admin.tab.listeners.title",
    descriptionKey: "room.admin.tab.listeners.description",
  },
  admin: {
    titleKey: "room.admin.tab.admin.title",
    descriptionKey: "room.admin.tab.admin.description",
  },
  health: {
    titleKey: "room.admin.tab.health.title",
    descriptionKey: "room.admin.tab.health.description",
  },
};
