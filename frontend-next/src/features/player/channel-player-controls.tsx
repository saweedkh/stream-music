"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "@/components/providers/locale-provider";
import { formatPlayerTime, resolvePlayerAccent } from "@/features/player/player-accent";
import { cn } from "@/lib/utils";

export type PlayerControlDensity = "compact" | "touch" | "full";

type PlaybackProps = {
  compact: boolean;
  density?: PlayerControlDensity;
  isPlaying: boolean;
  canControl: boolean;
  accent?: string;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
};

export function ChannelPlayerPlaybackControls({
  compact,
  density = compact ? "compact" : "full",
  isPlaying,
  canControl,
  accent = "emerald",
  onPrev,
  onPlayPause,
  onNext,
}: PlaybackProps) {
  const { t } = useTranslations();
  const pal = resolvePlayerAccent(accent);
  const touch = density === "touch";
  const full = density === "full";

  const tip = (label: string, control: ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );

  const secondaryBtn = cn(
    "rounded-full border-border/80 bg-card/70 p-0 text-foreground shadow-sm hover:bg-muted/80",
    compact ? (touch ? "h-10 w-10" : "h-8 w-8 border-border/70 bg-card/60") : "h-12 w-12",
  );

  const playBtn = cn(
    "rounded-full border p-0 transition-transform active:scale-95",
    compact ? (touch ? "h-11 w-11" : "h-9 w-9") : "h-16 w-16",
    pal.playBtn,
    full && "h-[4.25rem] w-[4.25rem] shadow-[0_24px_48px_-16px_var(--glow-brand)]",
  );

  const iconSm = compact ? (touch ? "h-[18px] w-[18px]" : "h-4 w-4") : "h-6 w-6";
  const iconPlay = compact ? (touch ? "h-[18px] w-[18px]" : "h-4 w-4") : "h-7 w-7";

  return (
    <div className={cn("flex items-center justify-center", compact ? (touch ? "gap-1.5" : "gap-1") : "gap-4")}>
      {tip(
        t("player.control.prev"),
        <Button type="button" variant="secondary" className={secondaryBtn} onClick={(e) => { e.stopPropagation(); onPrev(); }} disabled={!canControl}>
          <SkipBack className={iconSm} />
        </Button>,
      )}
      {tip(
        isPlaying ? t("player.control.pause") : t("player.control.play"),
        <Button type="button" className={playBtn} onClick={(e) => { e.stopPropagation(); onPlayPause(); }} disabled={!canControl}>
          {isPlaying ? <Pause className={iconPlay} /> : <Play className={cn(iconPlay, "fill-current")} />}
        </Button>,
      )}
      {tip(
        t("player.control.next"),
        <Button type="button" variant="secondary" className={secondaryBtn} onClick={(e) => { e.stopPropagation(); onNext(); }} disabled={!canControl}>
          <SkipForward className={iconSm} />
        </Button>,
      )}
    </div>
  );
}

type SeekProps = {
  seekValue: number;
  seekMax: number;
  duration: number;
  disabled?: boolean;
  compact?: boolean;
  onPointerDown: () => void;
  onValueChange: (value: number) => void;
  onValueCommit: (value: number) => void;
  className?: string;
};

export function ChannelPlayerSeekBar({
  seekValue,
  seekMax,
  duration,
  disabled,
  compact,
  onPointerDown,
  onValueChange,
  onValueCommit,
  className,
}: SeekProps) {
  if (compact) {
    return (
      <div className={cn("flex min-w-0 touch-manipulation items-center gap-2", className)}>
        <span className="w-9 shrink-0 tabular-nums text-[10px] text-muted-foreground sm:text-[11px]">{formatPlayerTime(seekValue)}</span>
        <Slider
          compact
          value={[seekValue]}
          min={0}
          max={seekMax}
          step={0.1}
          disabled={disabled}
          onPointerDown={onPointerDown}
          onValueChange={(v) => onValueChange(v[0] ?? 0)}
          onValueCommit={(v) => onValueCommit(v[0] ?? 0)}
          className="min-w-0 flex-1"
        />
        <span className="w-9 shrink-0 text-right tabular-nums text-[10px] text-muted-foreground sm:text-[11px]">{formatPlayerTime(duration)}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
        <span>{formatPlayerTime(seekValue)}</span>
        <span>{formatPlayerTime(duration)}</span>
      </div>
      <Slider
        value={[seekValue]}
        min={0}
        max={seekMax}
        step={0.1}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onValueChange={(v) => onValueChange(v[0] ?? 0)}
        onValueCommit={(v) => onValueCommit(v[0] ?? 0)}
        className="w-full"
      />
    </div>
  );
}

type VolumeProps = {
  volume: number;
  onVolumeChange: (value: number) => void;
  showLabel?: boolean;
};

export function ChannelPlayerVolume({ volume, onVolumeChange, showLabel }: VolumeProps) {
  return (
    <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {showLabel ? <Label className="text-xs text-muted-foreground">Volume</Label> : <span className="sr-only">Volume</span>}
      </div>
      <Slider value={[volume]} min={0} max={1} step={0.01} onValueChange={(v) => onVolumeChange(v[0] ?? 0)} className="w-full flex-1" />
      <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round(volume * 100)}%</span>
    </div>
  );
}
