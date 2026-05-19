"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsBase } from "@/lib/api";

export type SupportSocketState = "connecting" | "connected" | "reconnecting" | "closed";

type Options = {
  ticketId: number | null;
  onMessage?: (payload: unknown) => void;
  enabled?: boolean;
};

export function useSupportTicketSocket({ ticketId, onMessage, enabled = true }: Options) {
  const [socketState, setSocketState] = useState<SupportSocketState>("closed");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const send = useCallback((data: Record<string, unknown>) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(data));
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || ticketId == null) {
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
      ws = new WebSocket(`${getWsBase()}/ws/support/tickets/${ticketId}`);
      socketRef.current = ws;

      ws.onopen = () => setSocketState("connected");

      ws.onmessage = (event) => {
        try {
          onMessageRef.current?.(JSON.parse(event.data) as unknown);
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
        reconnectTimerRef.current = setTimeout(() => connect(attempt + 1), delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect(0);

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current = null;
      ws?.close();
      setSocketState("closed");
    };
  }, [enabled, ticketId]);

  return { socketState, send };
}
