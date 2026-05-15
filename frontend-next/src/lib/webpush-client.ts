/** Browser Web Push (VAPID) — service worker + subscription registration. */

import { getMe, registerWebPushSubscription } from "@/lib/api";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function resolveVapidPublicKey(): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const me = await getMe();
    return me?.webpush?.vapid_public_key?.trim() || null;
  } catch {
    return null;
  }
}

export async function registerWebPushOnDevice(options?: {
  /** When false, only re-sync if permission was already granted (no prompt). */
  requestPermission?: boolean;
}): Promise<"ok" | "unsupported" | "no_key" | "denied" | "error"> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  const key = await resolveVapidPublicKey();
  if (!key) return "no_key";

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    let perm = Notification.permission;
    if (perm === "default" && options?.requestPermission) {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      return perm === "denied" ? "denied" : "denied";
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return "error";
    }
    await registerWebPushSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return "ok";
  } catch {
    return "error";
  }
}
