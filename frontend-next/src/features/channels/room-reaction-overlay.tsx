"use client";

import { useRoomReactionsOptional } from "@/features/channels/room-reaction-context";
import { RoomReactionFloatLayer } from "@/features/channels/room-reaction-float-layer";

export function RoomReactionOverlay() {
  const reactions = useRoomReactionsOptional();
  if (!reactions) return null;

  return <RoomReactionFloatLayer floaters={reactions.floaters} className="z-30" />;
}
