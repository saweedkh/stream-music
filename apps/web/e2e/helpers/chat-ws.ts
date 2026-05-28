import type { APIRequestContext } from "@playwright/test";
import WebSocket from "ws";
import { apiURL } from "./auth";

export type ChatWsMessage = {
  id: number;
  body: string;
  reply_to_id?: number | null;
  reply_preview?: { body: string } | null;
};

/** Authenticated chat round-trip against Django (bypasses Next WS proxy). */
export async function chatReplyRoundTrip(
  request: APIRequestContext,
  channelId: number,
  parentText: string,
  replyText: string,
): Promise<{ parentId: number; reply: ChatWsMessage }> {
  const state = await request.storageState();
  const cookieHeader = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  if (!cookieHeader) throw new Error("chat WS: missing session cookies");

  const wsUrl = `${apiURL.replace(/^http/, "ws")}/ws/channels/${channelId}/chat`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieHeader } });
    let parentId = 0;
    let sentReply = false;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("chat WS timeout"));
    }, 25_000);

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(String(raw)) as {
          type?: string;
          message?: ChatWsMessage;
        };
        if (data.type === "CHAT_SYNC") {
          ws.send(JSON.stringify({ action: "send", body: parentText }));
          return;
        }
        if (data.type === "CHAT_EVENT" && data.message) {
          if (!parentId && data.message.body === parentText) {
            parentId = data.message.id;
            ws.send(JSON.stringify({ action: "send", body: replyText, reply_to_id: parentId }));
            sentReply = true;
            return;
          }
          if (sentReply && data.message.body === replyText && data.message.reply_preview) {
            clearTimeout(timer);
            ws.close();
            resolve({ parentId, reply: data.message });
          }
        }
      } catch (e) {
        clearTimeout(timer);
        ws.close();
        reject(e);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
