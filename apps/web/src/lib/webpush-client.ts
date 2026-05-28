/** Browser Web Push (VAPID) — service worker + subscription registration. */

import { getMe, registerWebPushSubscription } from "@/lib/api";

const IPV4_HOST =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export type WebPushRegisterResult =
  | { status: "ok" }
  | { status: "unsupported"; reason: string }
  | { status: "insecure"; reason: string }
  | { status: "no_key" }
  | { status: "denied" }
  | { status: "ssl_untrusted"; certInstallUrl: string; httpsUrl: string }
  | { status: "error"; message: string };

/** HTTP URL to download the dev CA on phones (LAN IP + nginx :8080). */
export function getDevCertInstallUrl(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (!IPV4_HOST.test(host)) return null;
  return `http://${host}:8080/dev-ssl.crt`;
}

export function getDevHttpsSiteUrl(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (!IPV4_HOST.test(host)) return null;
  const port = window.location.port === "8443" ? "8443" : window.location.port || "8443";
  return `https://${host}:${port}${window.location.pathname}`;
}

export function needsDevCertTrustOnThisDevice(): boolean {
  return Boolean(getDevCertInstallUrl());
}

export function isPushEnvironmentSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushEnvironmentIssue(): string | null {
  if (typeof window === "undefined") return "Not in browser.";
  if (!window.isSecureContext) {
    return "Push needs HTTPS or localhost. Opening the site as http://192.168.x.x will not work — use https://…:8443 or http://localhost:8080.";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "This browser does not support Web Push.";
  }
  return null;
}

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

/** True if this browser already has an active push subscription for our SW. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushEnvironmentSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub?.endpoint);
  } catch {
    return false;
  }
}

export async function registerWebPushOnDevice(options?: {
  requestPermission?: boolean;
}): Promise<WebPushRegisterResult> {
  const envIssue = pushEnvironmentIssue();
  if (envIssue) {
    return window.isSecureContext === false
      ? { status: "insecure", reason: envIssue }
      : { status: "unsupported", reason: envIssue };
  }

  const key = await resolveVapidPublicKey();
  if (!key) return { status: "no_key" };

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    let perm = Notification.permission;
    if (perm === "default" && options?.requestPermission) {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      return { status: "denied" };
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
      return { status: "error", message: "Browser returned an invalid subscription." };
    }

    await registerWebPushSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return { status: "ok" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/SSL certificate|certificate error|CERT_/i.test(message)) {
      const certInstallUrl = getDevCertInstallUrl();
      const httpsUrl =
        getDevHttpsSiteUrl() ||
        (typeof window !== "undefined" ? window.location.href : "https://<LAN-IP>:8443");
      if (certInstallUrl) {
        return { status: "ssl_untrusted", certInstallUrl, httpsUrl };
      }
      return {
        status: "error",
        message:
          "This device does not trust the dev HTTPS certificate. Install the dev CA from your server, enable full trust (iOS: Certificate Trust Settings), then reload and try again.",
      };
    }
    return { status: "error", message };
  }
}
