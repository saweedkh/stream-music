"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRoomReactionEvents } from "@/features/channels/use-room-reaction-events";
import type { RoomReactionBurst, RoomReactionFloater } from "@/features/channels/room-reaction-constants";

type RoomReactionContextValue = {
  floaters: RoomReactionFloater[];
  bursts: RoomReactionBurst[];
  isLive: boolean;
  spawnReaction: (emoji: string) => void;
  sendLocalReaction: (emoji: string) => void;
};

const RoomReactionContext = createContext<RoomReactionContextValue | null>(null);

export function RoomReactionProvider({ channelId, children }: { channelId: string; children: ReactNode }) {
  const value = useRoomReactionEvents(channelId);
  return <RoomReactionContext.Provider value={value}>{children}</RoomReactionContext.Provider>;
}

export function useRoomReactions() {
  const ctx = useContext(RoomReactionContext);
  if (!ctx) {
    throw new Error("useRoomReactions must be used within RoomReactionProvider");
  }
  return ctx;
}

export function useRoomReactionsOptional() {
  return useContext(RoomReactionContext);
}
