"use client";

import { useCallback, useEffect, useState } from "react";
import { listChannelSuggestions } from "@/lib/api";

/** Pending suggestion count for admin nav — live via playback WebSocket, REST on mount/reconnect fallback. */
export function usePendingSuggestionsCount(channelId: string, enabled: boolean) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const data = await listChannelSuggestions(channelId, "pending");
      setCount(data.results.length);
    } catch {
      setCount(0);
    }
  }, [channelId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    void refresh();

    const onPlayback = (ev: Event) => {
      const e = ev as CustomEvent<{
        channelId?: string;
        payload?: { type?: string; action?: string; pending_count?: number };
      }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const p = e.detail?.payload ?? {};
      const type = String(p.type ?? p.action ?? "").toLowerCase();
      if (type === "initial_sync" || type === "suggestions_updated") {
        if (typeof p.pending_count === "number") {
          setCount(Math.max(0, p.pending_count));
        }
        return;
      }
    };

    const onLegacy = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; pendingCount?: number }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      if (typeof e.detail?.pendingCount === "number") {
        setCount(Math.max(0, e.detail.pendingCount));
        return;
      }
      void refresh();
    };

    window.addEventListener("channel-playback-updated", onPlayback);
    window.addEventListener("channel-suggestions-changed", onLegacy);
    return () => {
      window.removeEventListener("channel-playback-updated", onPlayback);
      window.removeEventListener("channel-suggestions-changed", onLegacy);
    };
  }, [channelId, enabled, refresh]);

  return count;
}
