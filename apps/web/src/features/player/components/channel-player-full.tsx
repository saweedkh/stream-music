"use client";

import type { ReactNode } from "react";
import { ChevronDown, Volume2 } from "lucide-react";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { AudioWaveVisualizer } from "@/features/player/components/audio-wave-visualizer";
import { ChannelPlayerArtwork } from "@/features/player/components/channel-player-artwork";
import {
  ChannelPlayerPlaybackControls,
  ChannelPlayerSeekBar,
} from "@/features/player/components/channel-player-controls";
import { formatPlayerTime, resolvePlayerAccent } from "@/features/player/model/player-accent";
import { Slider } from "@/shared/ui/slider";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  socketState: string;
  title: string;
  artworkLetter: string;
  accentKey: string;
  isPlaying: boolean;
  canControl: boolean;
  activeTrackPath?: string;
  seekValue: number;
  seekMax: number;
  duration: number;
  volume: number;
  vizAudioEl: HTMLAudioElement | null;
  queueMeta: { playlistName?: string; queueIndex?: number; queueLength?: number };
  syncDeltaMs: number;
  lastSyncAt: number | null;
  isBuffering: boolean;
  needsUnlock?: boolean;
  onUnlockAudio?: () => void;
  introRemainingSec: number | null;
  introCapSec: number;
  rehearsalMuted: boolean;
  rehearsalLiftActive: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeekPointerDown: () => void;
  onSeekChange: (value: number) => void;
  onSeekCommit: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onRefreshSync?: () => void;
  reactionsSlot?: ReactNode;
};

export function ChannelPlayerFull({
  open,
  onOpenChange,
  channelId,
  socketState,
  title,
  artworkLetter,
  accentKey,
  isPlaying,
  canControl,
  activeTrackPath,
  seekValue,
  seekMax,
  duration,
  volume,
  vizAudioEl,
  queueMeta,
  syncDeltaMs,
  lastSyncAt,
  isBuffering,
  needsUnlock = false,
  onUnlockAudio,
  introRemainingSec,
  introCapSec: _introCapSec,
  rehearsalMuted,
  rehearsalLiftActive,
  onPrev,
  onPlayPause,
  onNext,
  onSeekPointerDown,
  onSeekChange,
  onSeekCommit,
  onVolumeChange,
  onRefreshSync,
  reactionsSlot,
}: Props) {
  const { t } = useTranslations();
  const pal = resolvePlayerAccent(accentKey);
  const waveActive = Boolean(activeTrackPath && isPlaying);
  const connected = socketState === "connected";

  const queueLabel =
    queueMeta.playlistName && queueMeta.queueLength != null && queueMeta.queueIndex != null
      ? `${queueMeta.playlistName} · ${queueMeta.queueIndex + 1}/${queueMeta.queueLength}`
      : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        className={cn(
          "player-full-panel inset-x-0 mx-auto w-full max-w-xl border-x border-border/60 px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-0",
          "max-h-[min(34rem,82dvh)] h-auto sm:rounded-t-2xl",
        )}
      >
        <DrawerTitle className="sr-only">{t("player.fullTitle")}</DrawerTitle>

        <div className="relative flex flex-col overflow-hidden">
          <div
            className={cn("pointer-events-none absolute inset-x-8 top-0 h-32 rounded-full blur-3xl", pal.mesh)}
            style={{ opacity: 0.35 }}
            aria-hidden
          />

          {/* Toolbar */}
          <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {isPlaying ? <span className="status-live h-2 w-2 shrink-0" aria-hidden /> : null}
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("player.nowPlaying")}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
              <span className="hidden text-xs sm:inline">{t("player.collapse")}</span>
              <span className="sr-only sm:hidden">{t("player.collapse")}</span>
            </Button>
          </div>

          <div className="relative overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5 sm:py-5">
            {!activeTrackPath ? (
              <Alert tone="error" className="mb-4 text-sm">
                {t("player.noActiveTrack")}
              </Alert>
            ) : null}

            {needsUnlock && onUnlockAudio ? (
              <Alert tone="info" className="mb-4 text-sm">
                <p className="font-medium">{t("player.unlockTitle")}</p>
                <p className="mt-1 text-muted-foreground">{t("player.unlockDescription")}</p>
                <Button type="button" size="sm" className="mt-3" onClick={onUnlockAudio}>
                  {t("player.unlockTitle")}
                </Button>
              </Alert>
            ) : null}

            {/* Hero */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="relative mx-auto shrink-0 sm:mx-0">
                <ChannelPlayerArtwork letter={artworkLetter} size="lg" accent={accentKey} pulse={isPlaying} />
                <div
                  className="absolute -inset-3 -z-10 overflow-hidden rounded-[28px] opacity-80"
                  aria-hidden
                >
                  <AudioWaveVisualizer
                    media={vizAudioEl}
                    isActive={waveActive}
                    accent={accentKey}
                    variant="compact"
                    className="h-full w-full min-h-[7rem] min-w-[7rem]"
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-start">
                <h2 className="line-clamp-2 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
                  {title || t("player.noTrack")}
                </h2>
                {queueLabel ? (
                  <p className="mt-1.5 truncate text-sm text-muted-foreground">{queueLabel}</p>
                ) : null}
                <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
                  <span className={connected ? "text-brand/90" : "text-amber-400/90"}>{socketState}</span>
                  <span className="mx-1.5 text-border">·</span>
                  <span title={channelId}>#{channelId.slice(0, 8)}</span>
                </p>
                {reactionsSlot}
              </div>
            </div>

            {/* Transport */}
            <div className="mt-6 space-y-5">
              <ChannelPlayerSeekBar
                seekValue={seekValue}
                seekMax={seekMax}
                duration={duration}
                disabled={!activeTrackPath}
                onPointerDown={onSeekPointerDown}
                onValueChange={onSeekChange}
                onValueCommit={onSeekCommit}
              />

              <div className="flex justify-center py-1">
                <ChannelPlayerPlaybackControls
                  compact={false}
                  density="full"
                  isPlaying={isPlaying}
                  canControl={canControl}
                  accent={accentKey}
                  onPrev={onPrev}
                  onPlayPause={onPlayPause}
                  onNext={onNext}
                />
              </div>

              <div className="flex items-center gap-3 border-t border-border/40 pt-4">
                <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Slider
                  value={[volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => onVolumeChange(v[0] ?? 0)}
                  className="min-w-0 flex-1"
                />
                <span className="w-9 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            {(rehearsalMuted || rehearsalLiftActive || introRemainingSec != null || isBuffering) && (
              <div className="mt-4 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                {rehearsalMuted ? <p className="text-warning/90">{t("player.status.rehearsalMuted")}</p> : null}
                {!rehearsalMuted && rehearsalLiftActive ? (
                  <p className="text-brand/90">{t("player.status.rehearsalLift")}</p>
                ) : null}
                {introRemainingSec != null ? (
                  <p>{t("player.status.introLeft", { seconds: introRemainingSec })}</p>
                ) : null}
                {isBuffering ? <p>{t("player.status.buffering")}</p> : null}
              </div>
            )}

            <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
              <span>
                {isPlaying ? t("player.status.playing") : t("player.status.paused")}
                <span className="mx-1.5 opacity-40">·</span>
                Δ {syncDeltaMs}ms
                {lastSyncAt ? (
                  <>
                    <span className="mx-1.5 opacity-40">·</span>
                    {formatPlayerTime(lastSyncAt / 1000)}
                  </>
                ) : null}
              </span>
              {canControl && onRefreshSync ? (
                <button type="button" className="text-brand hover:underline" onClick={onRefreshSync}>
                  {t("player.status.refreshSync")}
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
