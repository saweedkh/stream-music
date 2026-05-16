"use client";

import { create } from "zustand";
import type { AppNotification, NotificationCategory, NotificationPrefs } from "@/lib/notifications/types";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications/types";
import { categoryEnabled, userWantsChatNotify } from "@/lib/notifications/prefs";

const MAX_ITEMS = 80;

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PushInput = {
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  channelId?: string;
  messageId?: number;
  /** For chat mention filtering */
  chatBody?: string;
  myUsername?: string;
};

type NotificationState = {
  items: AppNotification[];
  prefs: NotificationPrefs;
  setPrefs: (prefs: Partial<NotificationPrefs>) => void;
  push: (input: PushInput) => string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  unreadCount: () => number;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  prefs: DEFAULT_NOTIFICATION_PREFS,

  setPrefs: (partial) => set((s) => ({ prefs: { ...s.prefs, ...partial } })),

  push: (input) => {
    const { prefs } = get();
    if (input.category === "chat") {
      if (!categoryEnabled(prefs, "chat")) return null;
      const body = input.chatBody ?? input.body;
      const user = input.myUsername ?? "";
      if (!userWantsChatNotify(body, user, prefs.chat_notify)) return null;
    } else if (input.category === "playback") {
      if (!categoryEnabled(prefs, "playback")) return null;
    } else if (input.category === "moderation") {
      if (!categoryEnabled(prefs, "moderation")) return null;
    }

    const id = makeId();
    const item: AppNotification = {
      id,
      category: input.category,
      title: input.title,
      body: input.body,
      href: input.href,
      channelId: input.channelId,
      messageId: input.messageId,
      createdAt: Date.now(),
      read: false,
    };

    set((s) => {
      const dedupeKey =
        input.messageId != null
          ? `chat:${input.channelId}:${input.messageId}`
          : `${input.category}:${input.channelId}:${input.title}:${input.body}`.slice(0, 120);
      const filtered = s.items.filter((n) => {
        const key =
          n.messageId != null
            ? `chat:${n.channelId}:${n.messageId}`
            : `${n.category}:${n.channelId}:${n.title}:${n.body}`.slice(0, 120);
        return key !== dedupeKey;
      });
      return { items: [item, ...filtered].slice(0, MAX_ITEMS) };
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("stream-in-app-notification", { detail: item }));
    }
    return id;
  },

  markRead: (id) =>
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),

  clear: () => set({ items: [] }),

  unreadCount: () => get().items.filter((n) => !n.read).length,
}));

export function channelChatHref(channelId: string, messageId?: number): string {
  const base = `/channel/${encodeURIComponent(channelId)}?tab=chat`;
  return messageId != null ? `${base}&message=${messageId}` : base;
}

export function channelPlayerHref(channelId: string): string {
  return `/channel/${encodeURIComponent(channelId)}?tab=player`;
}
