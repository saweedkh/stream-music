"use client";

import { cn } from "@/lib/utils";
import { resolvePlayerAccent } from "@/features/player/player-accent";

export type ArtworkSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<ArtworkSize, { outer: string; inner: string; text: string }> = {
  xs: {
    outer: "h-9 w-9 rounded-[11px] p-px",
    inner: "rounded-[10px]",
    text: "text-xs font-bold",
  },
  sm: {
    outer: "h-11 w-11 rounded-xl p-px",
    inner: "rounded-[10px]",
    text: "text-sm font-bold",
  },
  md: {
    outer: "h-28 w-28 rounded-2xl p-[2px] sm:h-32 sm:w-32",
    inner: "rounded-[14px]",
    text: "text-xl font-bold sm:text-2xl",
  },
  lg: {
    outer: "h-36 w-36 rounded-[22px] p-[2px] sm:h-44 sm:w-44",
    inner: "rounded-[20px]",
    text: "text-3xl font-bold sm:text-4xl",
  },
  xl: {
    outer: "h-44 w-44 rounded-[26px] p-[3px] sm:h-52 sm:w-52",
    inner: "rounded-[23px]",
    text: "text-4xl font-bold sm:text-5xl",
  },
};

type Props = {
  letter: string;
  size?: ArtworkSize;
  accent?: string;
  className?: string;
  pulse?: boolean;
};

export function ChannelPlayerArtwork({ letter, size = "md", accent = "emerald", className, pulse }: Props) {
  const pal = resolvePlayerAccent(accent);
  const s = SIZE[size];

  return (
    <div className={cn("relative shrink-0", pulse && "player-art-pulse", className)}>
      <div className={cn("bg-gradient-to-br", s.outer, pal.ring)}>
        <div className={cn("flex h-full w-full items-center justify-center bg-[var(--surface-inset)]", s.inner, pal.text, s.text)}>
          {letter}
        </div>
      </div>
    </div>
  );
}
