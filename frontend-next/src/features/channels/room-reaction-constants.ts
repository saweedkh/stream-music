export const ROOM_REACTION_EMOJIS = ["🔥", "❤️", "😂", "👏", "🎧", "✨"] as const;

export type RoomReactionEmoji = (typeof ROOM_REACTION_EMOJIS)[number];

export type RoomReactionBurst = {
  id: number;
  emoji: string;
};

export type RoomReactionFloater = {
  id: number;
  emoji: string;
  /** Horizontal position (% of overlay width). */
  x: number;
  /** Vertical anchor from bottom (% of overlay height). */
  y: number;
};

export const ROOM_REACTION_FLOAT_MS = 3200;
export const ROOM_REACTION_MAX_FLOATERS = 12;

export function randomReactionX(): number {
  return 8 + Math.random() * 84;
}

export function randomReactionY(): number {
  return 12 + Math.random() * 76;
}
