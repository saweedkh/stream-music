"use client";

import { useEffect, useRef } from "react";
import { postChannelListenHeartbeat } from "@/lib/api/analytics";

/** Report listen time every 30s while playback is active. */
export function useListenHeartbeat(
  channelId: string | null,
  isPlaying: boolean,
  trackId: number | null | undefined,
) {
  const accRef = useRef(0);

  useEffect(() => {
    if (!channelId || !isPlaying) {
      accRef.current = 0;
      return;
    }
    const tick = window.setInterval(() => {
      accRef.current += 30;
      if (accRef.current >= 30) {
        const sec = accRef.current;
        accRef.current = 0;
        void postChannelListenHeartbeat(channelId, sec, trackId ?? null).catch(() => undefined);
      }
    }, 30_000);
    return () => window.clearInterval(tick);
  }, [channelId, isPlaying, trackId]);
}
