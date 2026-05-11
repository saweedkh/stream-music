"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsBase } from "@/lib/api";

export type ChannelChatSocketState = "connecting" | "connected" | "reconnecting" | "closed";

type Options = {
  channelId: string | number;
  onMessage?: (payload: unknown) => void;
  enabled?: boolean;
};

export function useReconnectingChannelChatSocket({ channelId, onMessage, enabled = true }: Options) {
  const debugSocket = process.env.NEXT_PUBLIC_DEBUG_CHANNEL_CHAT === "1";
  const [socketState, setSocketState] = useState<ChannelChatSocketState>("connecting");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef<((payload: unknown) => void) | undefined>(onMessage);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      setSocketState("closed");
      return;
    }

    let ws: WebSocket | null = null;
    let cancelled = false;

    const connect = (attempt = 0) => {
      if (cancelled) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setSocketState(attempt === 0 ? "connecting" : "reconnecting");
      if (debugSocket) console.debug("[channel-chat-socket] connecting", { channelId, attempt });
      ws = new WebSocket(`${getWsBase()}/ws/channels/${channelId}/chat`);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketState("connected");
        if (debugSocket) console.debug("[channel-chat-socket] connected", { channelId });
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          if (debugSocket) console.debug("[channel-chat-socket] message", { channelId, payload });
          onMessageRef.current?.(payload);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = (event) => {
        if (cancelled) {
          setSocketState("closed");
          return;
        }
        if (event.code === 4403 || event.code === 4401) {
          setSocketState("closed");
          return;
        }
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        if (debugSocket) console.debug("[channel-chat-socket] closed, reconnect", { channelId, attempt, delay });
        reconnectTimerRef.current = setTimeout(() => connect(attempt + 1), delay);
      };

      ws.onerror = () => {
        if (debugSocket) console.debug("[channel-chat-socket] error", { channelId });
        ws?.close();
      };
    };

    connect(0);

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      ws?.close();
      socketRef.current = null;
      setSocketState("closed");
    };
  }, [channelId, enabled, debugSocket]);

  const sendChat = useCallback((payload: Record<string, unknown>) => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return false;
    if (debugSocket) console.debug("[channel-chat-socket] send", { channelId, payload });
    s.send(JSON.stringify(payload));
    return true;
  }, [channelId, debugSocket]);

  return { chatSocketState: socketState, sendChat };
}
