import type { UserNotificationSettings } from "@/lib/api";

export type NotificationCategory = "chat" | "playback" | "moderation" | "system";

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  channelId?: string;
  messageId?: number;
  createdAt: number;
  read: boolean;
};

export type NotificationPrefs = Pick<
  UserNotificationSettings,
  | "chat_notify"
  | "admin_notify_reactions"
  | "admin_notify_votes"
  | "push_category_playback"
  | "push_category_chat"
  | "push_category_moderation"
>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  chat_notify: "all",
  admin_notify_reactions: true,
  admin_notify_votes: true,
  push_category_playback: true,
  push_category_chat: true,
  push_category_moderation: true,
};
