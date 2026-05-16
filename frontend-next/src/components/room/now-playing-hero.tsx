"use client";

import { cn } from "@/lib/utils";

const ACCENT_RING: Record<string, string> = {
  emerald: "from-emerald-400/95 via-teal-500 to-cyan-500 shadow-[0_20px_50px_-25px_rgba(16,185,129,0.55)]",
  violet: "from-violet-400/95 via-purple-500 to-fuchsia-500 shadow-[0_20px_50px_-25px_rgba(139,92,246,0.45)]",
  rose: "from-rose-400/95 via-pink-500 to-orange-400 shadow-[0_20px_50px_-25px_rgba(244,63,94,0.4)]",
  amber: "from-amber-400/95 via-orange-500 to-yellow-500 shadow-[0_20px_50px_-25px_rgba(245,158,11,0.4)]",
  sky: "from-sky-400/95 via-cyan-500 to-blue-500 shadow-[0_20px_50px_-25px_rgba(14,165,233,0.4)]",
};

type Props = {
  title: string;
  subtitle?: string | null;
  metaLine?: string | null;
  letter?: string;
  accent?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function NowPlayingHero({
  title,
  subtitle,
  metaLine,
  letter = "♪",
  accent = "emerald",
  size = "md",
  className,
}: Props) {
  const ring = ACCENT_RING[(accent || "emerald").toLowerCase()] ?? ACCENT_RING.emerald;
  const outer =
    size === "lg" ? "h-36 w-36 rounded-[22px]" : size === "sm" ? "h-14 w-14 rounded-xl" : "h-28 w-28 rounded-2xl";
  const inner =
    size === "lg" ? "rounded-[20px] text-4xl" : size === "sm" ? "rounded-[10px] text-lg" : "rounded-[14px] text-3xl";

  return (
    <div
      className={cn("flex animate-track-enter items-center gap-4", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={cn("shrink-0 overflow-hidden bg-gradient-to-br p-[2px]", outer, ring)}>
        <div className={cn("flex h-full w-full items-center justify-center bg-black/70 font-bold text-emerald-100", inner)}>
          {letter}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Now playing</p>
        <p className="mt-0.5 line-clamp-2 text-lg font-semibold text-white sm:text-xl">{title}</p>
        {subtitle ? <p className="mt-0.5 truncate text-sm text-zinc-400">{subtitle}</p> : null}
        {metaLine ? <p className="mt-1 text-xs text-zinc-500">{metaLine}</p> : null}
      </div>
    </div>
  );
}
