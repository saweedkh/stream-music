"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsBase } from "@/lib/api";

export type ChannelSocketState = "connecting" | "connected" | "reconnecting" | "closed";

type Options = {
  channelId: string | number;
  onMessage?: (payload: unknown) => void;
  enabled?: boolean;
};

export function useReconnectingChannelSocket({ channelId, onMessage, enabled = true }: Options) {
  const debugSocket = process.env.NEXT_PUBLIC_DEBUG_CHANNEL_SOCKET === "1";
  const [socketState, setSocketState] = useState<ChannelSocketState>("connecting");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      if (debugSocket) console.debug("[channel-socket] connecting", { channelId, attempt });
      ws = new WebSocket(`${getWsBase()}/ws/channels/${channelId}`);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketState("connected");
        if (debugSocket) console.debug("[channel-socket] connected", { channelId });
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          if (debugSocket) console.debug("[channel-socket] heartbeat -> PING_LATENCY", { channelId });
          ws.send(JSON.stringify({ action: "PING_LATENCY", client_ts: Date.now() }));
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          if (debugSocket) console.debug("[channel-socket] message", { channelId, payload });
          onMessageRef.current?.(payload);
        } catch {
          // ignore malformed payloads
        }
      };

      ws.onclose = () => {
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
        if (cancelled) {
          setSocketState("closed");
          return;
        }
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        if (debugSocket) console.debug("[channel-socket] closed, reconnect scheduled", { channelId, attempt, delay });
        reconnectTimerRef.current = setTimeout(() => connect(attempt + 1), delay);
      };

      ws.onerror = () => {
        if (debugSocket) console.debug("[channel-socket] error", { channelId });
        ws?.close();
      };
    };

    connect(0);

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      ws?.close();
      socketRef.current = null;
      setSocketState("closed");
    };
  }, [channelId, enabled]);

  const sendMessage = useCallback((payload: Record<string, unknown>) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (debugSocket) console.debug("[channel-socket] send", { channelId, payload });
    ws.send(JSON.stringify(payload));
    return true;
  }, [channelId, debugSocket]);

  return { socketState, sendMessage };
}
