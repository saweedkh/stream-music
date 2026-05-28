import type { NotificationPrefs } from "@/lib/notifications/types";

const MENTION_RE = /@([\w-]{1,64})/gu;

export function userWantsChatNotify(body: string, username: string, mode: NotificationPrefs["chat_notify"]): boolean {
  if (mode === "muted") return false;
  if (mode === "all") return true;
  const low = body.toLowerCase();
  if (low.includes("@everyone") || low.includes("@all")) return true;
  const ru = username.toLowerCase();
  for (const m of body.matchAll(MENTION_RE)) {
    if ((m[1] ?? "").toLowerCase() === ru) return true;
  }
  return false;
}

export function categoryEnabled(prefs: NotificationPrefs, category: keyof NotificationPrefs | "chat" | "playback" | "moderation"): boolean {
  if (category === "chat") return prefs.push_category_chat !== false;
  if (category === "playback") return prefs.push_category_playback !== false;
  if (category === "moderation") return prefs.push_category_moderation !== false;
  return true;
}
