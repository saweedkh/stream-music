"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ROOM_REACTION_FLOAT_MS,
  ROOM_REACTION_MAX_FLOATERS,
  randomReactionX,
  randomReactionY,
  type RoomReactionBurst,
  type RoomReactionFloater,
} from "@/features/channels/components/room-reaction-constants";

const MAX_BURSTS = 8;

export function useRoomReactionEvents(channelId: string) {
  const [floaters, setFloaters] = useState<RoomReactionFloater[]>([]);
  const floaterId = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());
  const recentLocal = useRef<{ emoji: string; at: number } | null>(null);

  const pushFloater = useCallback((emoji: string) => {
    const id = ++floaterId.current;
    const x = randomReactionX();
    const y = randomReactionY();
    setFloaters((prev) => [...prev.slice(-(ROOM_REACTION_MAX_FLOATERS - 1)), { id, emoji, x, y }]);

    const timer = window.setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
      timers.current.delete(id);
    }, ROOM_REACTION_FLOAT_MS);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    };
  }, []);

  useEffect(() => {
    function onSocial(ev: Event) {
      const e = ev as CustomEvent<{
        channelId?: string;
        payload?: { action?: string; emoji?: string };
      }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const action = (e.detail?.payload?.action ?? "").toLowerCase();
      const emoji = e.detail?.payload?.emoji;
      if (action !== "reaction" || !emoji) return;

      const lastLocal = recentLocal.current;
      if (lastLocal && lastLocal.emoji === emoji && Date.now() - lastLocal.at < 700) {
        recentLocal.current = null;
        return;
      }
      pushFloater(emoji);
    }

    window.addEventListener("channel-social", onSocial as EventListener);
    return () => window.removeEventListener("channel-social", onSocial as EventListener);
  }, [channelId, pushFloater]);

  const bursts = useMemo<RoomReactionBurst[]>(() => {
    const seen = new Set<string>();
    const result: RoomReactionBurst[] = [];
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const floater = floaters[i]!;
      if (seen.has(floater.emoji)) continue;
      seen.add(floater.emoji);
      result.unshift({ id: floater.id, emoji: floater.emoji });
      if (result.length >= MAX_BURSTS) break;
    }
    return result;
  }, [floaters]);

  const isLive = floaters.length > 0;

  const sendLocalReaction = useCallback(
    (emoji: string) => {
      recentLocal.current = { emoji, at: Date.now() };
      pushFloater(emoji);
    },
    [pushFloater],
  );

  return { floaters, bursts, isLive, spawnReaction: pushFloater, sendLocalReaction };
}
