"use client";

import { useEffect, useRef, useState } from "react";
import { WS_BASE } from "@/lib/api";

export type ChannelSocketState = "connecting" | "connected" | "reconnecting" | "closed";

type Options = {
  channelId: string | number;
  onMessage?: (payload: unknown) => void;
  enabled?: boolean;
};

export function useReconnectingChannelSocket({ channelId, onMessage, enabled = true }: Options) {
  const [socketState, setSocketState] = useState<ChannelSocketState>("connecting");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef<((payload: unknown) => void) | undefined>(onMessage);

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
      setSocketState(attempt === 0 ? "connecting" : "reconnecting");
      ws = new WebSocket(`${WS_BASE}/ws/channels/${channelId}`);

      ws.onopen = () => {
        setSocketState("connected");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          onMessageRef.current?.(payload);
        } catch {
          // ignore malformed payloads
        }
      };

      ws.onclose = () => {
        if (cancelled) {
          setSocketState("closed");
          return;
        }
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        reconnectTimerRef.current = setTimeout(() => connect(attempt + 1), delay);
      };
    };

    connect(0);

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      ws?.close();
      setSocketState("closed");
    };
  }, [channelId, enabled]);

  return { socketState };
}
