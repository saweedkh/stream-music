import { ChannelClosedError } from "./types";

/**
 * In the browser we always use the page origin (e.g. http://192.168.x.x:8080 on a phone on LAN).
 * For local `npm run dev` against a remote prod stack, set DEV_REMOTE_ORIGIN in `.env.local`;
 * Next.js rewrites proxy /api, /ws, and /audio to that host while the browser stays on localhost.
 * On the server (RSC) we call Django via INTERNAL_* or DEV_REMOTE_ORIGIN.
 */
export function devRemoteOrigin(): string | undefined {
  const raw = process.env.DEV_REMOTE_ORIGIN?.replace(/\/$/, "");
  return raw || undefined;
}

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.INTERNAL_API_BASE_URL ||
    devRemoteOrigin() ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  );
}

/** WebSocket: same host as the page in prod; optional NEXT_PUBLIC_WS_BASE_URL for local dev/E2E against a remote API. */
export function getWsBase(): string {
  if (typeof window !== "undefined") {
    const override = process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "");
    if (override) return override.replace(/^http/i, "ws");
    return window.location.protocol === "https:" ? `wss://${window.location.host}` : `ws://${window.location.host}`;
  }
  if (process.env.INTERNAL_WS_BASE_URL) return process.env.INTERNAL_WS_BASE_URL;
  const remote = devRemoteOrigin();
  if (remote) return remote.replace(/^http/i, "ws");
  return process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000";
}

export let csrfReady = false;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

export async function ensureCsrfCookie() {
  if (csrfReady && readCookie("csrftoken")) return;
  await fetch(`${getApiBase()}/api/auth/csrf`, { credentials: "include" });
  csrfReady = true;
}

export async function withAuthHeaders(init: RequestInit = {}): Promise<RequestInit> {
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken");
  return {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken ?? "",
      ...(init.headers ?? {}),
    },
  };
}

export async function withAuthFormData(init: RequestInit = {}): Promise<RequestInit> {
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken");
  return {
    ...init,
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken ?? "",
      ...(init.headers ?? {}),
    },
  };
}

export async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string; max?: number } | Record<string, unknown>;
    if (typeof (body as { detail?: string })?.detail === "string") {
      const detail = (body as { detail: string }).detail;
      const { localizeMessage, localizeMessageWithVars } = await import("@/lib/i18n/localize-message");
      if (detail === "too_many_tracks" && typeof (body as { max?: number }).max === "number") {
        return localizeMessageWithVars(detail, { max: (body as { max: number }).max });
      }
      if (
        detail === "playlist_has_inaccessible_tracks" &&
        typeof (body as { inaccessible_count?: number }).inaccessible_count === "number"
      ) {
        return localizeMessageWithVars(detail, {
          count: (body as { inaccessible_count: number }).inaccessible_count,
        });
      }
      return localizeMessage(detail);
    }
    if (body && typeof body === "object") {
      const firstEntry = Object.entries(body)[0];
      if (firstEntry) {
        const [field, value] = firstEntry;
        if (Array.isArray(value) && typeof value[0] === "string") {
          return `${field}: ${value[0]}`;
        }
        if (typeof value === "string") {
          return `${field}: ${value}`;
        }
      }
    }
  } catch {
    // ignore parse issues and use fallback
  }
  return fallback;
}

export function rejectIfChannelClosed(res: Response): void {
  if (res.status === 410) throw new ChannelClosedError();
}
