"use client";

import { useRoomReactionsOptional } from "@/features/channels/components/room-reaction-context";
import { RoomReactionFloatLayer } from "@/features/channels/components/room-reaction-float-layer";

export function RoomReactionOverlay() {
  const reactions = useRoomReactionsOptional();
  if (!reactions) return null;

  return <RoomReactionFloatLayer floaters={reactions.floaters} className="z-30" />;
}
