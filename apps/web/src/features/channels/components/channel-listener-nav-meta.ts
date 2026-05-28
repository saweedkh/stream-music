import type { ListenerTabId } from "@/features/channels/components/channel-room-config";
import type { MessageKey } from "@/lib/i18n/messages";

export type ListenerTabMeta = {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
};

export const LISTENER_TAB_META: Record<ListenerTabId, ListenerTabMeta> = {
  chat: {
    titleKey: "room.listener.tab.chat.title",
    descriptionKey: "room.listener.tab.chat.description",
  },
  suggestions: {
    titleKey: "room.listener.tab.suggestions.title",
    descriptionKey: "room.listener.tab.suggestions.description",
  },
  queue: {
    titleKey: "room.listener.tab.queue.title",
    descriptionKey: "room.listener.tab.queue.description",
  },
  info: {
    titleKey: "room.listener.tab.info.title",
    descriptionKey: "room.listener.tab.info.description",
  },
};
