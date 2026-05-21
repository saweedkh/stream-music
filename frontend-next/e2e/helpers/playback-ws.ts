import type { APIRequestContext } from "@playwright/test";
import WebSocket from "ws";
import { apiURL } from "./auth";

export type PlaybackWsPayload = {
  type?: string;
  action?: string;
  track?: { id?: number; title?: string | null };
  is_playing?: boolean;
  pending_count?: number;
};

/** Wait for a playback WebSocket event matching `predicate` (authenticated session cookies). */
export function playbackWsWaitFor(
  request: APIRequestContext,
  channelId: number,
  predicate: (payload: PlaybackWsPayload) => boolean,
  timeoutMs = 25_000,
): Promise<PlaybackWsPayload> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const state = await request.storageState();
      const cookieHeader = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      if (!cookieHeader) {
        reject(new Error("playback WS: missing session cookies"));
        return;
      }
      const wsUrl = `${apiURL.replace(/^http/, "ws")}/ws/channels/${channelId}`;
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieHeader } });
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("playback WS timeout"));
      }, timeoutMs);

      ws.on("message", (raw) => {
        try {
          const data = JSON.parse(String(raw)) as PlaybackWsPayload;
          if (predicate(data)) {
            clearTimeout(timer);
            ws.close();
            resolve(data);
          }
        } catch {
          /* ignore malformed */
        }
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    })();
  });
}
