"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { ChevronUp, Radio } from "lucide-react";
import { usePlayerMiniInset } from "@/shared/hooks/use-player-mini-inset";
import { useTranslations } from "@/shared/providers/locale-provider";
import { AudioWaveVisualizer } from "@/features/player/components/audio-wave-visualizer";
import { ChannelPlayerArtwork } from "@/features/player/components/channel-player-artwork";
import { ChannelPlayerPlaybackControls, ChannelPlayerSeekBar } from "@/features/player/components/channel-player-controls";
import { resolvePlayerAccent } from "@/features/player/model/player-accent";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  artworkLetter: string;
  accentKey: string;
  isPlaying: boolean;
  canControl: boolean;
  activeTrackPath?: string;
  seekValue: number;
  seekMax: number;
  duration: number;
  vizAudioEl: HTMLAudioElement | null;
  expanded: boolean;
  needsUnlock?: boolean;
  onExpand: () => void;
  onUnlockAudio?: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeekPointerDown: () => void;
  onSeekChange: (value: number) => void;
  onSeekCommit: (value: number) => void;
  reactionsSlot?: ReactNode;
};

export function ChannelPlayerMini({
  title,
  artworkLetter,
  accentKey,
  isPlaying,
  canControl,
  activeTrackPath,
  seekValue,
  seekMax,
  duration,
  vizAudioEl,
  expanded,
  needsUnlock = false,
  onExpand,
  onUnlockAudio,
  onPrev,
  onPlayPause,
  onNext,
  onSeekPointerDown,
  onSeekChange,
  onSeekCommit,
  reactionsSlot,
}: Props) {
  const { t } = useTranslations();
  const shellRef = useRef<HTMLDivElement>(null);
  usePlayerMiniInset(shellRef);
  const pal = resolvePlayerAccent(accentKey);
  const waveActive = Boolean(activeTrackPath && isPlaying);

  return (
    <div
      ref={shellRef}
      data-testid="channel-player-shell"
      className={cn(
        "player-shell fixed inset-x-0 bottom-0 z-40 border-t",
        expanded && "player-shell--expanded",
      )}
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r", pal.line)} aria-hidden />
      <div className="player-ambient" style={{ ["--player-glow" as string]: pal.glow }} aria-hidden />

      {/* Mobile */}
      <div className="relative flex flex-col gap-2 px-3 pb-3 pt-2.5 sm:hidden">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="touch-manipulation shrink-0 rounded-xl outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/45"
            onClick={onExpand}
            aria-label={t("player.expand")}
          >
            <ChannelPlayerArtwork letter={artworkLetter} size="sm" accent={accentKey} pulse={isPlaying} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isPlaying ? <span className="status-live h-1.5 w-1.5 shrink-0" aria-hidden /> : null}
              <p
                className="truncate text-sm font-semibold leading-tight text-foreground"
                data-testid="channel-now-playing-title"
              >
                {title || t("player.noTrack")}
              </p>
            </div>
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t("player.nowPlaying")}</p>
          </div>
          <ChannelPlayerPlaybackControls
            compact
            density="touch"
            isPlaying={isPlaying}
            canControl={canControl}
            accent={accentKey}
            onPrev={onPrev}
            onPlayPause={onPlayPause}
            onNext={onNext}
          />
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-border/70 bg-card/70 text-foreground/90 shadow-sm transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 active:scale-95"
            onClick={onExpand}
            aria-label={t("player.expand")}
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        </div>
        <ChannelPlayerSeekBar
          compact
          seekValue={seekValue}
          seekMax={seekMax}
          duration={duration}
          disabled={!activeTrackPath}
          onPointerDown={onSeekPointerDown}
          onValueChange={onSeekChange}
          onValueCommit={onSeekCommit}
        />
        {reactionsSlot}
        {needsUnlock && onUnlockAudio ? (
          <button
            type="button"
            className="w-full rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-100/95 transition hover:bg-amber-500/15"
            onClick={onUnlockAudio}
          >
            <span className="font-medium">{t("player.unlockTitle")}</span>
            <span className="mt-0.5 block text-[10px] text-amber-100/70">{t("player.unlockDescription")}</span>
          </button>
        ) : null}
        {!expanded ? (
          <div className="h-9 w-full overflow-hidden rounded-xl border border-border/50 bg-[var(--surface-inset)]">
            <AudioWaveVisualizer media={vizAudioEl} isActive={waveActive} accent={accentKey} variant="compact" className="h-full w-full" />
          </div>
        ) : null}
      </div>

      {/* Desktop */}
      <div className="relative hidden min-h-[4.25rem] items-center gap-3 px-4 py-2.5 sm:flex md:gap-4 md:px-5">
        <button type="button" className="shrink-0 rounded-xl outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-brand/45" onClick={onExpand} aria-label={t("player.expand")}>
          <ChannelPlayerArtwork letter={artworkLetter} size="sm" accent={accentKey} pulse={isPlaying} />
        </button>
        <div className="hidden min-w-[8rem] max-w-[min(22vw,280px)] shrink-0 flex-col justify-center md:flex">
          <div className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand/90">{t("player.nowPlaying")}</span>
          </div>
          <p
            className="mt-0.5 truncate text-sm font-semibold text-foreground"
            title={title || undefined}
            data-testid="channel-now-playing-title"
          >
            {title || t("player.noTrack")}
          </p>
        </div>
        <div className="hidden h-10 min-w-[120px] max-w-[min(24vw,280px)] shrink-0 overflow-hidden rounded-xl border border-border/50 bg-[var(--surface-inset)] lg:block">
          <AudioWaveVisualizer media={vizAudioEl} isActive={waveActive} accent={accentKey} variant="compact" className="h-full w-full" />
        </div>
        <ChannelPlayerSeekBar
          compact
          className="min-w-0 flex-1"
          seekValue={seekValue}
          seekMax={seekMax}
          duration={duration}
          disabled={!activeTrackPath}
          onPointerDown={onSeekPointerDown}
          onValueChange={onSeekChange}
          onValueCommit={onSeekCommit}
        />
        <ChannelPlayerPlaybackControls
          compact
          isPlaying={isPlaying}
          canControl={canControl}
          accent={accentKey}
          onPrev={onPrev}
          onPlayPause={onPlayPause}
          onNext={onNext}
        />
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/70 text-foreground/90 shadow-sm transition hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-brand/45"
          onClick={onExpand}
          aria-label={t("player.expand")}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
