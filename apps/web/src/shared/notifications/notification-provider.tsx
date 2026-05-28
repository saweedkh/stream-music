"use client";

import { useEffect } from "react";
import { getMe } from "@/lib/api";
import { useNotificationStore } from "@/lib/notifications/store";
import type { AppNotification } from "@/lib/notifications/types";
import { useToast } from "@/shared/ui/toast-provider";

/** Loads notification prefs and shows a brief toast for new in-app items. */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const setPrefs = useNotificationStore((s) => s.setPrefs);
  const { showToast } = useToast();

  useEffect(() => {
    void getMe()
      .then((me) => {
        if (me?.notification_settings) setPrefs(me.notification_settings);
      })
      .catch(() => undefined);
  }, [setPrefs]);

  useEffect(() => {
    const onItem = (event: Event) => {
      const item = (event as CustomEvent<AppNotification>).detail;
      if (!item || document.hidden) return;
      const label =
        item.category === "chat" ? "Chat" : item.category === "playback" ? "Now playing" : item.category === "moderation" ? "Room" : "Notice";
      showToast(`${label}: ${item.title}`, "info");
    };
    window.addEventListener("stream-in-app-notification", onItem);
    return () => window.removeEventListener("stream-in-app-notification", onItem);
  }, [showToast]);

  return children;
}
