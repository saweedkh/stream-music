"use client";

import { useEffect, useRef, useState } from "react";
import { getWsBase } from "@/lib/api";

type Options = {
  enabled?: boolean;
  onMessage?: (payload: unknown) => void;
};

export function useSupportStaffInboxSocket({ enabled = false, onMessage }: Options) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(`${getWsBase()}/ws/support/inbox`);
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (event) => {
        try {
          onMessageRef.current?.(JSON.parse(event.data) as unknown);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = (event) => {
        setConnected(false);
        if (cancelled || event.code === 4403 || event.code === 4401) return;
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      ws?.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}
