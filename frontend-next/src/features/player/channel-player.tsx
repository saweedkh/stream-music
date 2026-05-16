"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronUp, Pause, Play, Radio, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AudioWaveVisualizer } from "@/features/player/audio-wave-visualizer";
import { useChannelPlaybackEngine } from "@/features/player/use-channel-playback-engine";
import type { ChannelExperience } from "@/features/experience/room-experience-chrome";
import type { ChannelPlaybackEventPayload } from "@/features/player/playback-payload";

export type { ChannelPlaybackEventPayload } from "@/features/player/playback-payload";

type Props = {
  channelId: string;
  socketState: "connecting" | "connected" | "reconnecting" | "closed";
  trackPath?: string;
  startedAt?: number | null;
  pausedAt?: number | null;
  initialIsPlaying?: boolean;
  canControl?: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  experience?: ChannelExperience | null;
};

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const ACCENT_PALETTE: Record<string, { ring: string; text: string }> = {
  emerald: {
    ring: "from-brand-muted/95 via-teal-500 to-cyan-500 shadow-[0_20px_50px_-25px_rgba(16,185,129,0.75)]",
    text: "text-brand",
  },
  violet: {
    ring: "from-violet-400/95 via-purple-500 to-fuchsia-500 shadow-[0_20px_50px_-25px_rgba(139,92,246,0.55)]",
    text: "text-violet-100",
  },
  rose: {
    ring: "from-rose-400/95 via-pink-500 to-orange-400 shadow-[0_20px_50px_-25px_rgba(244,63,94,0.5)]",
    text: "text-rose-100",
  },
  amber: {
    ring: "from-amber-400/95 via-orange-500 to-yellow-500 shadow-[0_20px_50px_-25px_rgba(245,158,11,0.45)]",
    text: "text-amber-100",
  },
  sky: {
    ring: "from-sky-400/95 via-cyan-500 to-blue-500 shadow-[0_20px_50px_-25px_rgba(14,165,233,0.45)]",
    text: "text-sky-100",
  },
};

function ArtworkRing({
  letter,
  size = "md",
  accent = "emerald",
}: {
  letter: string;
  size?: "xs" | "sm" | "md" | "lg";
  accent?: string;
}) {
  const a = (accent || "emerald").toLowerCase();
  const pal = ACCENT_PALETTE[a] ?? ACCENT_PALETTE.emerald;
  if (size === "lg") {
    return (
      <div className={cn("h-44 w-44 shrink-0 overflow-hidden rounded-[22px] bg-gradient-to-br p-[2px]", pal.ring)}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-[20px] bg-[var(--surface-inset)] text-4xl font-bold", pal.text)}>
          {letter}
        </div>
      </div>
    );
  }
  if (size === "md") {
    return (
      <div className={cn("h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br p-[2px]", pal.ring)}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-[14px] bg-[var(--surface-inset)] text-xl font-bold", pal.text)}>{letter}</div>
      </div>
    );
  }
  if (size === "sm") {
    return (
      <div className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br p-px", pal.ring)}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-[10px] bg-[var(--surface-inset)] text-sm font-bold", pal.text)}>{letter}</div>
      </div>
    );
  }
  return (
    <div className={cn("h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br p-px", pal.ring)}>
      <div className={cn("flex h-full w-full items-center justify-center rounded-[7px] bg-[var(--overlay)] text-xs font-bold", pal.text)}>{letter}</div>
    </div>
  );
}

export function ChannelPlayer({
  channelId,
  socketState,
  trackPath,
  startedAt,
  pausedAt,
  initialIsPlaying = false,
  canControl = false,
  sendSocketMessage,
  drawerOpen,
  onDrawerOpenChange,
  experience = null,
}: Props) {
  const { showToast } = useToast();

  const {
    howlRef,
    isPlaying,
    activeTrackPath,
    lastSyncAt,
    needsUserInteraction,
    setNeedsUserInteraction,
    position,
    setPosition,
    duration,
    volume,
    setVolume,
    vizAudioEl,
    isBuffering,
    offsetMs,
    isDraggingSeekRef,
    applyControl,
    commitSeek,
    refreshChannelPlaybackState,
  } = useChannelPlaybackEngine({
    channelId,
    socketState,
    initialTrackPath: trackPath,
    initialStartedAt: startedAt,
    initialPausedAt: pausedAt,
    initialIsPlaying,
    canControl,
    experience,
    sendSocketMessage,
    onToast: (message, tone) => showToast(message, tone),
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ channelId?: string; payload?: ChannelPlaybackEventPayload }>;
      if (String(customEvent.detail?.channelId ?? "") !== String(channelId)) return;
      const payload = customEvent.detail?.payload;
      if (!payload) return;
      if (
        typeof payload.queue_index === "number" ||
        typeof payload.queue_length === "number" ||
        payload.playlist_name
      ) {
        setQueueMeta({
          playlistName: typeof payload.playlist_name === "string" ? payload.playlist_name : undefined,
          queueIndex: typeof payload.queue_index === "number" ? payload.queue_index : undefined,
          queueLength: typeof payload.queue_length === "number" ? payload.queue_length : undefined,
        });
      }
    };
    window.addEventListener("channel-playback-updated", handler as EventListener);
    return () => window.removeEventListener("channel-playback-updated", handler as EventListener);
  }, [channelId]);

  const [queueMeta, setQueueMeta] = useState<{
    playlistName?: string;
    queueIndex?: number;
    queueLength?: number;
  }>({});

  const trackLabel = activeTrackPath ? decodeURIComponent(activeTrackPath.split("/").pop() ?? "Unknown track") : "No active track";
  const title = useMemo(() => trackLabel.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim(), [trackLabel]);
  const artworkLetter = title && title !== "No active track" ? title.charAt(0).toUpperCase() : "♪";
  const seekMax = Math.max(duration, 0.1);
  const seekValue = Math.min(position, seekMax);
  const accentKey = (experience?.accent || "emerald").toLowerCase();
  const introCapSec = Math.max(0, Math.min(120, Number(experience?.intro_preview_seconds) || 0));
  const syncDeltaMs = Math.round(offsetMs);
  const rehearsalLiftActive = Boolean(
    experience?.rehearsal_lift_until && Date.parse(experience.rehearsal_lift_until) > Date.now(),
  );
  const rehearsalMuted = Boolean(experience?.rehearsal_mode && !canControl && !rehearsalLiftActive);
  const introRemainingSec =
    !canControl && introCapSec > 0 && position < introCapSec ? Math.max(0, Math.ceil(introCapSec - position)) : null;

  type DockSize = "narrow" | "touch";

  const playbackControls = (compact: boolean, dock?: DockSize) => {
    const touch = dock === "touch";
    const tip = (label: string, control: ReactNode) => (
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    );
    return (
      <div className={cn("flex items-center justify-center", compact ? (touch ? "gap-1" : "gap-0.5") : "gap-3")}>
        {tip(
          "Previous track",
          <Button
            type="button"
            variant="secondary"
            className={cn(
              compact
                ? touch
                  ? "h-9 w-9 rounded-full border-border/80 bg-card/70 p-0 hover:bg-muted active:scale-95"
                  : "h-7 w-7 rounded-full border-border/70 bg-card/60 p-0 hover:bg-muted/90"
                : "h-12 w-12 rounded-full p-0",
            )}
            onClick={(e) => {
              e.stopPropagation();
              void applyControl("prev");
            }}
            disabled={!canControl}
          >
            <SkipBack className={compact ? (touch ? "h-4 w-4" : "h-3.5 w-3.5") : "h-6 w-6"} />
          </Button>,
        )}
        {tip(
          isPlaying ? "Pause" : "Play",
          <Button
            type="button"
            className={cn(
              compact
                ? touch
                  ? "h-10 w-10 rounded-full border border-brand/40 bg-gradient-to-br from-brand/95 to-teal-600/95 p-0 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] hover:from-brand-muted hover:to-teal-500 active:scale-95"
                  : "h-8 w-8 rounded-full border border-brand/35 bg-gradient-to-br from-brand/90 to-teal-600/90 p-0 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.65)] hover:from-brand-muted hover:to-teal-500"
                : "h-16 w-16 rounded-full border border-brand-muted/50 p-0 shadow-[0_20px_40px_-18px_rgba(16,185,129,0.85)]",
            )}
            onClick={(e) => {
              e.stopPropagation();
              const howl = howlRef.current;
              if (!howl) return;
              if (isPlaying) {
                void applyControl("pause", { position: howl.seek() as number });
              } else {
                const at = typeof howl.seek() === "number" ? (howl.seek() as number) : 0;
                void applyControl("play", { position: at });
              }
            }}
            disabled={!canControl}
          >
            {isPlaying ? (
              <Pause className={compact ? (touch ? "h-[18px] w-[18px]" : "h-4 w-4") : "h-7 w-7"} />
            ) : (
              <Play className={compact ? (touch ? "h-[18px] w-[18px] fill-current" : "h-4 w-4 fill-current") : "h-7 w-7 fill-current"} />
            )}
          </Button>,
        )}
        {tip(
          "Next track",
          <Button
            type="button"
            variant="secondary"
            className={cn(
              compact
                ? touch
                  ? "h-9 w-9 rounded-full border-border/80 bg-card/70 p-0 hover:bg-muted active:scale-95"
                  : "h-7 w-7 rounded-full border-border/70 bg-card/60 p-0 hover:bg-muted/90"
                : "h-12 w-12 rounded-full p-0",
            )}
            onClick={(e) => {
              e.stopPropagation();
              void applyControl("next");
            }}
            disabled={!canControl}
          >
            <SkipForward className={compact ? (touch ? "h-4 w-4" : "h-3.5 w-3.5") : "h-6 w-6"} />
          </Button>,
        )}
      </div>
    );
  };

  const seekSlider = (className?: string) => (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>{formatTime(seekValue)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <Slider
        value={[seekValue]}
        min={0}
        max={seekMax}
        step={0.1}
        disabled={!activeTrackPath}
        onPointerDown={() => {
          isDraggingSeekRef.current = true;
        }}
        onValueChange={(v) => setPosition(v[0] ?? 0)}
        onValueCommit={(v) => commitSeek(v[0] ?? 0)}
        className="w-full"
      />
    </div>
  );

  const volumeRow = (
    <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 sm:block sm:min-w-0">
        <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-xs text-muted-foreground sm:sr-only">Volume</span>
      </div>
      <Slider
        value={[volume]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => setVolume(v[0] ?? 0)}
        className="w-full flex-1"
      />
      <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round(volume * 100)}%</span>
    </div>
  );

  const miniSeekRow = (
    <div className="flex min-h-[40px] min-w-0 touch-manipulation items-center gap-1.5 sm:min-h-0 sm:gap-2">
      <span className="w-8 shrink-0 tabular-nums text-[10px] leading-none text-muted-foreground sm:w-9 sm:text-[11px]">{formatTime(seekValue)}</span>
      <Slider
        compact
        value={[seekValue]}
        min={0}
        max={seekMax}
        step={0.1}
        disabled={!activeTrackPath}
        onPointerDown={() => {
          isDraggingSeekRef.current = true;
        }}
        onValueChange={(v) => setPosition(v[0] ?? 0)}
        onValueCommit={(v) => commitSeek(v[0] ?? 0)}
        className="min-w-0 flex-1 py-1 sm:py-0.5"
      />
      <span className="w-8 shrink-0 text-right tabular-nums text-[10px] leading-none text-muted-foreground sm:w-9 sm:text-[11px]">{formatTime(duration)}</span>
    </div>
  );

  return (
    <>
      <Drawer open={drawerOpen} onOpenChange={onDrawerOpenChange} shouldScaleBackground={false}>
        <DrawerContent
          className={cn(
            "border-border/90 px-3 pb-6 pt-0 sm:px-6",
            "h-auto max-h-[92dvh] sm:max-h-[92dvh] overflow-hidden",
            // Desktop: sheet not edge-to-edge (no translate — avoids fighting Vaul slide)
            "inset-x-0 md:inset-x-10 lg:inset-x-16 xl:inset-x-[max(1.5rem,calc((100vw-72rem)/2))]",
            "md:rounded-t-2xl",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-none overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]",
              "max-h-[min(calc(92dvh-2.75rem),880px)]",
            )}
          >
            <span className="sr-only" aria-live="polite">
              {isPlaying ? "Playback is active" : "Playback is paused"}.
              {socketState === "connected" ? " Socket connected." : ` Socket ${socketState}.`}
              {` Sync delta ${syncDeltaMs} milliseconds.`}
            </span>
            <DrawerHeader className="space-y-1 border-b border-border/70 px-0.5 pb-3 pt-0">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Radio className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <DrawerTitle className="text-base sm:text-lg">Live channel player</DrawerTitle>
              </div>
              <DrawerDescription className="text-xs sm:text-sm">
                <span className="block sm:inline">Synced playback · Channel </span>
                <span className="font-mono text-[11px] text-muted-foreground sm:text-xs" title={channelId}>
                  #{channelId.slice(0, 8)}…
                </span>
                <span className="text-muted-foreground"> · socket </span>
                <span className={socketState === "connected" ? "text-brand/90" : "text-amber-400/85"}>{socketState}</span>
              </DrawerDescription>
              <div className="mt-3 w-full">
                <div className="mx-auto h-16 w-full max-w-xl overflow-hidden rounded-xl border border-border/55 bg-[var(--surface-inset)] shadow-inner shadow-black/40 sm:h-[72px]">
                  <AudioWaveVisualizer
                    media={vizAudioEl}
                    isActive={Boolean(activeTrackPath && isPlaying)}
                    accent={accentKey}
                    className="h-full w-full"
                    variant="full"
                  />
                </div>
              </div>
            </DrawerHeader>

            <div className="pb-1 pt-1">
              {!activeTrackPath ? (
                <Alert tone="error" className="mb-3 mt-3 sm:mb-4">
                  No active track in this channel.
                </Alert>
              ) : null}

              <div className="mt-2 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,220px)_1fr] md:items-start md:gap-6">
                <div className="flex flex-col items-center gap-2 sm:gap-3 md:items-start">
                  <div className="md:hidden">
                    <ArtworkRing letter={artworkLetter} size="md" accent={accentKey} />
                  </div>
                  <div className="hidden md:block">
                    <ArtworkRing letter={artworkLetter} size="lg" accent={accentKey} />
                  </div>
                  <div className="w-full text-center md:w-auto md:text-left">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-brand/90 sm:text-[11px] sm:tracking-[0.25em]">Now playing</p>
                    <p className="mt-0.5 line-clamp-2 text-lg font-semibold text-foreground sm:text-xl">{title || "No active track"}</p>
                    {queueMeta.playlistName && queueMeta.queueLength != null && queueMeta.queueIndex != null ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {queueMeta.playlistName} · {queueMeta.queueIndex + 1} / {queueMeta.queueLength}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
                  <Card className="border-border/80 bg-card/40 shadow-inner shadow-black/30">
                    <CardHeader className="space-y-0 pb-3 pt-5">
                      <CardTitle className="text-sm font-medium text-foreground/80">Playback</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pb-5 pt-0">
                      {seekSlider()}
                      <div className="flex justify-center py-1">{playbackControls(false)}</div>
                      <Separator className="bg-muted/90" />
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Volume</Label>
                        {volumeRow}
                      </div>
                      {rehearsalMuted ? (
                        <p className="text-xs text-warning/90">Soundcheck mode — main mix is muted for listeners.</p>
                      ) : rehearsalLiftActive ? (
                        <p className="text-xs text-brand/90">Temporary soundcheck lift — listeners can hear the mix.</p>
                      ) : null}
                    </CardContent>
                  </Card>

                  {needsUserInteraction && isPlaying ? (
                    <Alert tone="info" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm">Browser blocked autoplay. Tap to continue.</span>
                      <Button
                        type="button"
                        onClick={() => {
                          const howl = howlRef.current;
                          if (!howl) return;
                          howl.play();
                          setNeedsUserInteraction(false);
                        }}
                      >
                        Enable audio
                      </Button>
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <Badge variant={isPlaying ? "success" : "warning"}>{isPlaying ? "Playing" : "Paused"}</Badge>
                    {isBuffering ? (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">
                        Buffering…
                      </Badge>
                    ) : null}
                    <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
                    <Badge
                      className={cn(
                        "text-[10px] sm:text-xs",
                        Math.abs(offsetMs) > 240 && "border-amber-500/40 bg-[var(--warning-subtle)] text-amber-100",
                      )}
                      title="Difference between local estimated clock and server clock"
                    >
                      Δ {syncDeltaMs}ms
                    </Badge>
                    {introRemainingSec != null ? (
                      <Badge variant="secondary" className="max-w-[220px] truncate text-[10px] sm:text-xs">
                        Intro {introRemainingSec}s left
                      </Badge>
                    ) : introCapSec > 0 && !canControl ? (
                      <Badge variant="secondary" className="max-w-[220px] truncate text-[10px] sm:text-xs">
                        Intro ended — muted
                      </Badge>
                    ) : null}
                    <Badge className="hidden max-w-full truncate sm:inline-flex sm:max-w-none">
                      {lastSyncAt ? `Sync ${new Date(lastSyncAt).toLocaleTimeString()}` : "Sync …"}
                    </Badge>
                    {canControl ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 w-full px-3 text-xs sm:h-8 sm:w-auto"
                        onClick={() => void refreshChannelPlaybackState()}
                      >
                        Refresh sync
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <div
        className={cn(
          "fixed inset-x-2 z-40 mx-auto w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-2xl border border-border/90",
          "bg-gradient-to-r from-card/90 via-card/75 to-card/90",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
          "backdrop-blur-2xl backdrop-saturate-150",
          "transition-[box-shadow,transform] duration-300",
          "bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:inset-x-4 sm:bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
          drawerOpen && "ring-1 ring-brand/35 ring-offset-0 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.2)]",
        )}
      >
        {/* Narrow screens: two rows — more room for touch + wide seek */}
        <div className="flex flex-col gap-2.5 p-2.5 sm:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="touch-manipulation shrink-0 rounded-lg p-0.5 outline-none transition duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/45"
              onClick={() => onDrawerOpenChange(true)}
              aria-label="Open full player"
            >
              <ArtworkRing letter={artworkLetter} size="xs" accent={accentKey} />
            </button>
            <p
              className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight text-foreground/95"
              title={title || undefined}
            >
              {title || "No track"}
            </p>
            <div className="flex shrink-0 items-center border-l border-border/80 pl-2">{playbackControls(true, "touch")}</div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-border/80 bg-card/60 text-brand/95 shadow-sm transition duration-200 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 active:scale-95"
              onClick={() => onDrawerOpenChange(true)}
              aria-label="Expand player"
            >
              <ChevronUp className="h-[18px] w-[18px] opacity-90" />
            </button>
          </div>
          {miniSeekRow}
          <div className="mt-1.5 h-7 w-full overflow-hidden rounded-lg border border-border/45 bg-[var(--surface-inset)]">
            <AudioWaveVisualizer
              media={vizAudioEl}
              isActive={Boolean(activeTrackPath && isPlaying)}
              accent={accentKey}
              variant="compact"
              className="h-full w-full"
            />
          </div>
        </div>

        {/* sm and up: single compact row */}
        <div className="hidden h-[50px] items-center gap-2 px-2.5 py-1 sm:flex md:gap-2.5 md:px-3">
          <button
            type="button"
            className="touch-manipulation shrink-0 rounded-lg outline-none transition duration-200 active:scale-[0.98] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-brand/45"
            onClick={() => onDrawerOpenChange(true)}
            aria-label="Open full player"
          >
            <ArtworkRing letter={artworkLetter} size="xs" accent={accentKey} />
          </button>
          <p
            className="min-w-0 max-w-[min(22vw,200px)] shrink truncate text-left text-[11px] font-medium leading-tight text-foreground/95 md:max-w-[min(28vw,260px)] lg:max-w-[min(32vw,300px)]"
            title={title || undefined}
          >
            {title || "No track"}
          </p>
          <div className="hidden h-9 min-w-[100px] max-w-[200px] shrink-0 md:flex md:items-stretch lg:max-w-[240px]">
            <div className="h-full w-full overflow-hidden rounded-lg border border-border/45 bg-[var(--surface-inset)]">
              <AudioWaveVisualizer
                media={vizAudioEl}
                isActive={Boolean(activeTrackPath && isPlaying)}
                accent={accentKey}
                variant="compact"
                className="h-full w-full"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">{miniSeekRow}</div>
          <div className="flex shrink-0 items-center border-l border-border/80 pl-2 md:pl-2.5">{playbackControls(true)}</div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-full border border-border/80 bg-card/60 text-brand/90 shadow-sm transition duration-200 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 md:h-9 md:w-9"
            onClick={() => onDrawerOpenChange(true)}
            aria-label="Expand player"
          >
            <ChevronUp className="h-4 w-4 opacity-90" />
          </button>
        </div>
      </div>
    </>
  );
}
