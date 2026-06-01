"use client";

import { useEffect, useRef, useState } from "react";
import { getWsBase } from "@/lib/api";
import type { SupportSocketState } from "@/shared/hooks/use-support-ticket-socket";

type Options = {
  enabled?: boolean;
  onMessage?: (payload: unknown) => void;
};

export function useSupportStaffInboxSocket({ enabled = false, onMessage }: Options) {
  const [socketState, setSocketState] = useState<SupportSocketState>("closed");
  const onMessageRef = useRef(onMessage);

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
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      setSocketState(attempt === 0 ? "connecting" : "reconnecting");
      ws = new WebSocket(`${getWsBase()}/ws/support/inbox`);
      ws.onopen = () => {
        attempt = 0;
        setSocketState("connected");
      };
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
        attempt += 1;
        setSocketState("reconnecting");
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      ws?.close();
      setSocketState("closed");
    };
  }, [enabled]);

  return { connected: socketState === "connected", socketState };
}
