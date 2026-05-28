export type PlayerAccentKey = "emerald" | "violet" | "rose" | "amber" | "sky";

export type PlayerAccentPalette = {
  ring: string;
  text: string;
  glow: string;
  mesh: string;
  line: string;
  playBtn: string;
};

export const PLAYER_ACCENT_PALETTE: Record<string, PlayerAccentPalette> = {
  emerald: {
    ring: "from-brand-muted/95 via-teal-500 to-cyan-500 shadow-[0_20px_50px_-25px_rgba(16,185,129,0.75)]",
    text: "text-brand",
    glow: "rgba(16,185,129,0.35)",
    mesh: "from-brand/25 via-teal-500/15 to-cyan-500/10",
    line: "from-transparent via-brand/80 to-transparent",
    playBtn:
      "border-brand/40 bg-gradient-to-br from-brand/95 to-teal-600/95 shadow-[0_8px_28px_-8px_rgba(16,185,129,0.75)] hover:from-brand-muted hover:to-teal-500",
  },
  violet: {
    ring: "from-violet-400/95 via-purple-500 to-fuchsia-500 shadow-[0_20px_50px_-25px_rgba(139,92,246,0.55)]",
    text: "text-violet-100",
    glow: "rgba(139,92,246,0.4)",
    mesh: "from-violet-500/25 via-purple-500/15 to-fuchsia-500/10",
    line: "from-transparent via-violet-400/80 to-transparent",
    playBtn:
      "border-violet-400/40 bg-gradient-to-br from-violet-500/95 to-fuchsia-600/95 shadow-[0_8px_28px_-8px_rgba(139,92,246,0.55)] hover:from-violet-400 hover:to-fuchsia-500",
  },
  rose: {
    ring: "from-rose-400/95 via-pink-500 to-orange-400 shadow-[0_20px_50px_-25px_rgba(244,63,94,0.5)]",
    text: "text-rose-100",
    glow: "rgba(244,63,94,0.38)",
    mesh: "from-rose-500/25 via-pink-500/15 to-orange-400/10",
    line: "from-transparent via-rose-400/80 to-transparent",
    playBtn:
      "border-rose-400/40 bg-gradient-to-br from-rose-500/95 to-orange-500/95 shadow-[0_8px_28px_-8px_rgba(244,63,94,0.5)] hover:from-rose-400 hover:to-orange-400",
  },
  amber: {
    ring: "from-amber-400/95 via-orange-500 to-yellow-500 shadow-[0_20px_50px_-25px_rgba(245,158,11,0.45)]",
    text: "text-amber-100",
    glow: "rgba(245,158,11,0.38)",
    mesh: "from-amber-500/25 via-orange-500/15 to-yellow-500/10",
    line: "from-transparent via-amber-400/80 to-transparent",
    playBtn:
      "border-amber-400/40 bg-gradient-to-br from-amber-500/95 to-orange-500/95 shadow-[0_8px_28px_-8px_rgba(245,158,11,0.45)] hover:from-amber-400 hover:to-orange-400",
  },
  sky: {
    ring: "from-sky-400/95 via-cyan-500 to-blue-500 shadow-[0_20px_50px_-25px_rgba(14,165,233,0.45)]",
    text: "text-sky-100",
    glow: "rgba(14,165,233,0.38)",
    mesh: "from-sky-500/25 via-cyan-500/15 to-blue-500/10",
    line: "from-transparent via-sky-400/80 to-transparent",
    playBtn:
      "border-sky-400/40 bg-gradient-to-br from-sky-500/95 to-blue-600/95 shadow-[0_8px_28px_-8px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500",
  },
};

export function resolvePlayerAccent(accent?: string): PlayerAccentPalette {
  const key = (accent || "emerald").toLowerCase();
  return PLAYER_ACCENT_PALETTE[key] ?? PLAYER_ACCENT_PALETTE.emerald;
}

export function formatPlayerTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
