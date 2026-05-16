"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listChannelQueue, type QueueItemSummary } from "@/lib/api";

type ChannelQueueContextValue = {
  queue: QueueItemSummary[];
  refreshQueue: () => Promise<void>;
  setQueueFromWs: (items: QueueItemSummary[] | undefined) => void;
};

export const ChannelQueueContext = createContext<ChannelQueueContextValue | null>(null);

export function ChannelQueueProvider({
  channelId,
  children,
  wsQueue,
}: {
  channelId: string;
  children: ReactNode;
  wsQueue?: QueueItemSummary[] | null;
}) {
  const [queue, setQueue] = useState<QueueItemSummary[]>([]);

  const refreshQueue = useCallback(async () => {
    const data = await listChannelQueue(channelId);
    setQueue(data.results);
  }, [channelId]);

  const setQueueFromWs = useCallback((items: QueueItemSummary[] | undefined) => {
    if (items && Array.isArray(items)) setQueue(items);
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (wsQueue && wsQueue.length >= 0) setQueue(wsQueue);
  }, [wsQueue]);

  useEffect(() => {
    const fn = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; payload?: { queue?: QueueItemSummary[]; action?: string } }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const q = e.detail?.payload?.queue;
      if (q && Array.isArray(q)) setQueue(q);
    };
    window.addEventListener("channel-playback-updated", fn);
    return () => window.removeEventListener("channel-playback-updated", fn);
  }, [channelId]);

  const value = useMemo(() => ({ queue, refreshQueue, setQueueFromWs }), [queue, refreshQueue, setQueueFromWs]);

  return <ChannelQueueContext.Provider value={value}>{children}</ChannelQueueContext.Provider>;
}

export function useChannelQueue() {
  const ctx = useContext(ChannelQueueContext);
  if (!ctx) throw new Error("useChannelQueue requires ChannelQueueProvider");
  return ctx;
}
