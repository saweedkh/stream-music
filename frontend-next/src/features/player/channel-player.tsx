"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Howl } from "howler";
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
import { ChannelClosedError, getApiBase, getChannelState, getServerTime } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AudioWaveVisualizer } from "@/features/player/audio-wave-visualizer";
import { expectedTimeSeconds } from "./sync-client";
import type { ChannelExperience } from "@/features/experience/room-experience-chrome";

/** Blend repeated clock samples to reduce jitter (WS pong / sync). */
function blendClockOffset(prevMs: number, sampleMs: number, alpha: number): number {
  if (!Number.isFinite(sampleMs)) return prevMs;
  if (!Number.isFinite(prevMs) || Math.abs(prevMs) < 1) return sampleMs;
  return prevMs + (sampleMs - prevMs) * alpha;
}

export type ChannelPlaybackEventPayload = {
  action?: string;
  event_seq?: number;
  is_playing?: boolean;
  started_at_server_time?: number | null;
  position?: number | null;
  track_file?: string | null;
  queue_version?: number;
  playlist_id?: number;
  playlist_name?: string;
  queue_index?: number;
  queue_length?: number;
  start_index?: number;
  /** Unix seconds — refine client clock vs server on sync messages */
  server_time?: number;
};

type Props = {
  channelId: string;
  socketState: "connecting" | "connected" | "reconnecting" | "closed";
  trackPath?: string;
  startedAt?: number | null;
  pausedAt?: number | null;
  initialIsPlaying?: boolean;
  canControl?: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  latestSocketPayload?: ChannelPlaybackEventPayload | null;
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

function getHowlHtml5Audio(howl: Howl | null): HTMLAudioElement | null {
  if (!howl) return null;
  const sounds = (howl as unknown as { _sounds?: Array<{ _node?: unknown }> })._sounds;
  const node = sounds?.[0]?._node;
  return node instanceof HTMLAudioElement ? node : null;
}

const ACCENT_PALETTE: Record<string, { ring: string; text: string }> = {
  emerald: {
    ring: "from-emerald-400/95 via-teal-500 to-cyan-500 shadow-[0_20px_50px_-25px_rgba(16,185,129,0.75)]",
    text: "text-emerald-100",
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
        <div className={cn("flex h-full w-full items-center justify-center rounded-[20px] bg-black/65 text-4xl font-bold", pal.text)}>
          {letter}
        </div>
      </div>
    );
  }
  if (size === "md") {
    return (
      <div className={cn("h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br p-[2px]", pal.ring)}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-[14px] bg-black/65 text-xl font-bold", pal.text)}>{letter}</div>
      </div>
    );
  }
  if (size === "sm") {
    return (
      <div className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br p-px", pal.ring)}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-[10px] bg-black/65 text-sm font-bold", pal.text)}>{letter}</div>
      </div>
    );
  }
  return (
    <div className={cn("h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br p-px", pal.ring)}>
      <div className={cn("flex h-full w-full items-center justify-center rounded-[7px] bg-black/60 text-xs font-bold", pal.text)}>{letter}</div>
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
  latestSocketPayload = null,
  drawerOpen,
  onDrawerOpenChange,
  experience = null,
}: Props) {
  const { showToast } = useToast();

  const howlRef = useRef<Howl | null>(null);
  const loadGenerationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTransportRef = useRef({
    playing: initialIsPlaying,
    track: trackPath as string | undefined,
    started: startedAt,
    paused: pausedAt,
  });
  const controlRequestInFlightRef = useRef(false);
  const pendingSocketCommandRef = useRef<Record<string, unknown> | null>(null);
  const lastAppliedEventSeqRef = useRef(0);
  const autoNextEventRef = useRef(0);
  const isDraggingSeekRef = useRef(false);
  const isPlayingRef = useRef(initialIsPlaying);
  const socketConnectedRef = useRef(socketState === "connected");
  const sendSocketMessageRef = useRef(sendSocketMessage);

  const [offsetMs, setOffsetMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
  const [syncStartedAt, setSyncStartedAt] = useState<number | null | undefined>(startedAt);
  const [syncPausedAt, setSyncPausedAt] = useState<number | null | undefined>(pausedAt);
  const [activeTrackPath, setActiveTrackPath] = useState<string | undefined>(trackPath);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [queueVersion, setQueueVersion] = useState(0);
  const [vizAudioEl, setVizAudioEl] = useState<HTMLAudioElement | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
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

  function teardownMainHowl() {
    const prev = howlRef.current;
    if (!prev) {
      setVizAudioEl(null);
      return;
    }
    try {
      prev.stop();
      prev.unload();
    } catch {
      /* ignore */
    }
    howlRef.current = null;
    setVizAudioEl(null);
  }

  function startHowlTransport(howl: Howl) {
    const expected = expectedTimeSeconds({
      startedAt: syncStartedAt,
      pausedAt: syncPausedAt,
      offsetMs,
      isPlaying: true,
    });
    if (typeof howl.rate === "function") howl.rate(1);
    howl.seek(Math.max(0, expected));
    if (!howl.playing()) howl.play();
  }

  async function refreshChannelPlaybackState(options?: { silent?: boolean }) {
    try {
      const data = await getChannelState(channelId);
      setIsPlaying(data.playback.is_playing);
      setSyncStartedAt(data.playback.started_at_server_time);
      setSyncPausedAt(data.playback.paused_at_position);
      setActiveTrackPath(data.playback.track?.file ?? undefined);
      if (typeof data.playback.queue_version === "number") setQueueVersion(data.playback.queue_version);
      setLastSyncAt(Date.now());
    } catch (error) {
      if (error instanceof ChannelClosedError) {
        if (!options?.silent) showToast("This channel is closed.", "info");
        return;
      }
      const message = error instanceof Error ? error.message : "Cannot refresh channel state";
      if (!options?.silent) showToast(message, "error");
    }
  }

  function applySocketPayload(payload: ChannelPlaybackEventPayload) {
    if (typeof payload.is_playing === "boolean") setIsPlaying(payload.is_playing);
    if ("started_at_server_time" in payload) setSyncStartedAt(payload.started_at_server_time ?? null);
    if ("position" in payload && typeof payload.position === "number") setSyncPausedAt(Math.max(0, payload.position));
    if ("track_file" in payload) setActiveTrackPath(payload.track_file ?? undefined);
    if (typeof payload.queue_version === "number") setQueueVersion(payload.queue_version);
    if (typeof payload.queue_index === "number" || typeof payload.queue_length === "number" || payload.playlist_name) {
      setQueueMeta({
        playlistName: typeof payload.playlist_name === "string" ? payload.playlist_name : undefined,
        queueIndex: typeof payload.queue_index === "number" ? payload.queue_index : undefined,
        queueLength: typeof payload.queue_length === "number" ? payload.queue_length : undefined,
      });
    }
    setLastSyncAt(Date.now());
  }

  function handleIncomingPlaybackPayload(payload: ChannelPlaybackEventPayload) {
    const action = String(payload.action ?? "").toLowerCase();
    if (action === "initial_sync") {
      applySocketPayload(payload);
      if (typeof payload.server_time === "number" && Number.isFinite(payload.server_time)) {
        const sample = payload.server_time * 1000 - Date.now();
        setOffsetMs((prev) => blendClockOffset(prev, sample, 0.45));
      }
      const seq = typeof payload.event_seq === "number" ? payload.event_seq : null;
      if (seq !== null) {
        lastAppliedEventSeqRef.current = Math.max(lastAppliedEventSeqRef.current, seq);
      }
      return;
    }

    const seq = typeof payload.event_seq === "number" ? payload.event_seq : null;
    if (seq !== null) {
      if (seq <= lastAppliedEventSeqRef.current) return;
      lastAppliedEventSeqRef.current = seq;
    }
    applySocketPayload(payload);
  }

  async function applyControl(action: "play" | "pause" | "seek" | "next" | "prev", payload?: Record<string, unknown>) {
    if (!canControl || !sendSocketMessage) return;
    if (controlRequestInFlightRef.current) return;
    controlRequestInFlightRef.current = true;
    try {
      const sent = sendSocketMessage({ action, ...payload });
      if (!sent) {
        pendingSocketCommandRef.current = { action, ...payload };
        showToast("Socket reconnecting... command queued.", "error");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Cannot ${action} playback`;
      showToast(message, "error");
    } finally {
      controlRequestInFlightRef.current = false;
    }
  }

  function commitSeek(next: number) {
    isDraggingSeekRef.current = false;
    const clamped = Math.max(0, next);
    const howl = howlRef.current;
    if (howl) howl.seek(clamped);
    if (canControl) void applyControl("seek", { position: clamped });
  }

  useEffect(() => {
    const sync = () => {
      void getServerTime()
        .then(({ offset }) => setOffsetMs((prev) => blendClockOffset(prev, offset, 0.5)))
        .catch(() => {});
    };
    sync();
    const id = window.setInterval(sync, 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const onClock = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; offsetMs?: number }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const next = e.detail?.offsetMs;
      if (typeof next !== "number" || !Number.isFinite(next)) return;
      setOffsetMs((prev) => blendClockOffset(prev, next, 0.35));
    };
    window.addEventListener("channel-clock-sync", onClock as EventListener);
    return () => window.removeEventListener("channel-clock-sync", onClock as EventListener);
  }, [channelId]);

  useEffect(() => {
    if (socketState !== "connected") return;
    void getServerTime()
      .then(({ offset }) => setOffsetMs((prev) => blendClockOffset(prev, offset, 0.55)))
      .catch(() => {});
  }, [socketState, channelId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    socketConnectedRef.current = socketState === "connected";
  }, [socketState]);

  useEffect(() => {
    sendSocketMessageRef.current = sendSocketMessage;
  }, [sendSocketMessage]);

  useEffect(() => {
    setActiveTrackPath(trackPath);
    setSyncStartedAt(startedAt);
    setSyncPausedAt(pausedAt);
    setIsPlaying(initialIsPlaying);
  }, [trackPath, startedAt, pausedAt, initialIsPlaying]);

  useEffect(() => {
    lastAppliedEventSeqRef.current = 0;
    setQueueVersion(0);
    teardownMainHowl();
    setPosition(0);
    setDuration(0);
    setIsBuffering(false);
    lastTransportRef.current = {
      playing: initialIsPlaying,
      track: trackPath,
      started: startedAt,
      paused: pausedAt,
    };
  }, [channelId]);

  useEffect(() => {
    if (socketState !== "closed") return;
    void refreshChannelPlaybackState({ silent: true });
  }, [channelId, socketState]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ channelId?: string; payload?: ChannelPlaybackEventPayload }>;
      if (customEvent.detail?.channelId && customEvent.detail.channelId !== channelId) return;
      const payload = customEvent.detail?.payload;
      if (payload) {
        handleIncomingPlaybackPayload(payload);
        return;
      }
      void refreshChannelPlaybackState({ silent: true });
    };
    window.addEventListener("channel-playback-updated", handler as EventListener);
    return () => window.removeEventListener("channel-playback-updated", handler as EventListener);
  }, [channelId]);

  useEffect(() => {
    if (latestSocketPayload) handleIncomingPlaybackPayload(latestSocketPayload);
  }, [latestSocketPayload]);

  useEffect(() => {
    if (socketState !== "connected") return;
    const command = pendingSocketCommandRef.current;
    if (!command || !sendSocketMessage) return;
    const sent = sendSocketMessage(command);
    if (sent) {
      pendingSocketCommandRef.current = null;
      showToast("Queued command sent.", "success");
    }
  }, [socketState, sendSocketMessage, showToast]);

  useEffect(() => {
    const src = activeTrackPath ? `${getApiBase()}${activeTrackPath}` : null;
    const loadGen = ++loadGenerationRef.current;

    if (!src) {
      teardownMainHowl();
      setPosition(0);
      setDuration(0);
      setIsBuffering(false);
      return;
    }

    teardownMainHowl();
    setIsBuffering(true);
    const howl = new Howl({
      src: [src],
      html5: true,
      volume,
      onload: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        setIsBuffering(false);
        setDuration(howl.duration() || 0);
        setVizAudioEl(getHowlHtml5Audio(howl));
        if (isPlayingRef.current) startHowlTransport(howl);
      },
      onplay: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        setIsBuffering(false);
        setVizAudioEl(getHowlHtml5Audio(howl));
      },
      onplayerror: () => {
        if (loadGen !== loadGenerationRef.current) return;
        setIsBuffering(false);
        setNeedsUserInteraction(true);
      },
      onloaderror: () => {
        if (loadGen !== loadGenerationRef.current) return;
        setIsBuffering(false);
        showToast("Cannot load audio source", "error");
      },
      onend: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        if (!isPlayingRef.current || !socketConnectedRef.current) return;
        const send = sendSocketMessageRef.current;
        const clientDurationSec =
          typeof howl.duration === "function" ? Number(howl.duration()) || 0 : 0;
        autoNextEventRef.current += 1;
        const payload = {
          action: "auto_next" as const,
          client_duration_sec: clientDurationSec,
          client_event_id: `${channelId}:${activeTrackPath ?? "none"}:${autoNextEventRef.current}`,
        };
        const ok = send?.(payload);
        if (!ok) {
          pendingSocketCommandRef.current = payload;
        }
      },
    });

    howlRef.current = howl;

    return () => {
      if (loadGen !== loadGenerationRef.current) return;
      try {
        howl.stop();
        howl.unload();
      } catch {
        /* ignore */
      }
      if (howlRef.current === howl) {
        howlRef.current = null;
      }
      setVizAudioEl(null);
    };
  }, [activeTrackPath]);

  useEffect(() => {
    const tick = () => {
      const howl = howlRef.current;
      if (!howl) return;
      if (!isDraggingSeekRef.current) {
        const current = typeof howl.seek() === "number" ? (howl.seek() as number) : 0;
        setPosition(current);
      }

      const setHowlRate = (rate: number) => {
        if (typeof howl.rate === "function") howl.rate(rate);
      };

      if (isPlaying) {
        const expected = expectedTimeSeconds({
          startedAt: syncStartedAt,
          pausedAt: syncPausedAt,
          offsetMs,
          isPlaying,
        });
        const current = typeof howl.seek() === "number" ? (howl.seek() as number) : 0;
        const diff = current - expected;
        if (!isDraggingSeekRef.current) {
          const hardSeek = 0.38;
          const softLo = 0.045;
          if (Math.abs(diff) > hardSeek) {
            howl.seek(Math.max(0, expected));
            setHowlRate(1);
          } else if (Math.abs(diff) > softLo) {
            setHowlRate(diff > 0 ? 0.988 : 1.012);
          } else {
            setHowlRate(1);
          }
        }
      } else {
        setHowlRate(1);
      }

      const posNow = typeof howl.seek() === "number" ? (howl.seek() as number) : 0;
      const introCap = Math.max(0, Math.min(120, Number(experience?.intro_preview_seconds) || 0));
      const introGate = !canControl && introCap > 0 && posNow >= introCap;
      const liftActive = Boolean(
        experience?.rehearsal_lift_until && Date.parse(experience.rehearsal_lift_until) > Date.now(),
      );
      const rehearsalMute = Boolean(experience?.rehearsal_mode && !canControl && !liftActive);
      howl.volume(rehearsalMute || introGate ? 0 : volume);

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, syncStartedAt, syncPausedAt, offsetMs, volume, canControl, experience]);

  useEffect(() => {
    const howl = howlRef.current;
    if (!howl) return;

    const prev = lastTransportRef.current;
    const next = {
      playing: isPlaying,
      track: activeTrackPath,
      started: syncStartedAt,
      paused: syncPausedAt,
    };
    const sameTransport =
      prev.playing === next.playing &&
      prev.track === next.track &&
      prev.started === next.started &&
      prev.paused === next.paused;
    lastTransportRef.current = next;

    if (isPlaying) {
      if (sameTransport && howl.playing()) return;
      startHowlTransport(howl);
      return;
    }

    if (sameTransport && !howl.playing()) return;
    if (typeof howl.rate === "function") howl.rate(1);
    if (howl.playing()) howl.pause();
    if (typeof syncPausedAt === "number") {
      howl.seek(Math.max(0, syncPausedAt));
      setPosition(Math.max(0, syncPausedAt));
    }
  }, [isPlaying, syncStartedAt, syncPausedAt, activeTrackPath]);

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
                  ? "h-9 w-9 rounded-full border-zinc-700/80 bg-zinc-900/70 p-0 hover:bg-zinc-800 active:scale-95"
                  : "h-7 w-7 rounded-full border-zinc-700/70 bg-zinc-900/60 p-0 hover:bg-zinc-800/90"
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
                  ? "h-10 w-10 rounded-full border border-emerald-400/40 bg-gradient-to-br from-emerald-500/95 to-teal-600/95 p-0 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)] hover:from-emerald-400 hover:to-teal-500 active:scale-95"
                  : "h-8 w-8 rounded-full border border-emerald-400/35 bg-gradient-to-br from-emerald-500/90 to-teal-600/90 p-0 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.65)] hover:from-emerald-400 hover:to-teal-500"
                : "h-16 w-16 rounded-full border border-emerald-300/50 p-0 shadow-[0_20px_40px_-18px_rgba(16,185,129,0.85)]",
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
                  ? "h-9 w-9 rounded-full border-zinc-700/80 bg-zinc-900/70 p-0 hover:bg-zinc-800 active:scale-95"
                  : "h-7 w-7 rounded-full border-zinc-700/70 bg-zinc-900/60 p-0 hover:bg-zinc-800/90"
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
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-zinc-500">
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
        <Volume2 className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <span className="text-xs text-zinc-500 sm:sr-only">Volume</span>
      </div>
      <Slider
        value={[volume]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => setVolume(v[0] ?? 0)}
        className="w-full flex-1"
      />
      <span className="shrink-0 text-right text-xs tabular-nums text-zinc-500">{Math.round(volume * 100)}%</span>
    </div>
  );

  const miniSeekRow = (
    <div className="flex min-h-[40px] min-w-0 touch-manipulation items-center gap-1.5 sm:min-h-0 sm:gap-2">
      <span className="w-8 shrink-0 tabular-nums text-[10px] leading-none text-zinc-500 sm:w-9 sm:text-[11px]">{formatTime(seekValue)}</span>
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
      <span className="w-8 shrink-0 text-right tabular-nums text-[10px] leading-none text-zinc-500 sm:w-9 sm:text-[11px]">{formatTime(duration)}</span>
    </div>
  );

  return (
    <>
      <Drawer open={drawerOpen} onOpenChange={onDrawerOpenChange} shouldScaleBackground={false}>
        <DrawerContent
          className={cn(
            "border-zinc-800/90 px-3 pb-6 pt-0 sm:px-6",
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
            <DrawerHeader className="space-y-1 border-b border-zinc-800/70 px-0.5 pb-3 pt-0">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Radio className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                <DrawerTitle className="text-base sm:text-lg">Live channel player</DrawerTitle>
              </div>
              <DrawerDescription className="text-xs sm:text-sm">
                <span className="block sm:inline">Synced playback · Channel </span>
                <span className="font-mono text-[11px] text-slate-400 sm:text-xs" title={channelId}>
                  #{channelId.slice(0, 8)}…
                </span>
                <span className="text-slate-500"> · socket </span>
                <span className={socketState === "connected" ? "text-emerald-400/90" : "text-amber-400/85"}>{socketState}</span>
              </DrawerDescription>
              <div className="mt-3 w-full">
                <div className="mx-auto h-16 w-full max-w-xl overflow-hidden rounded-xl border border-zinc-800/55 bg-black/45 shadow-inner shadow-black/40 sm:h-[72px]">
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
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/90 sm:text-[11px] sm:tracking-[0.25em]">Now playing</p>
                    <p className="mt-0.5 line-clamp-2 text-lg font-semibold text-white sm:text-xl">{title || "No active track"}</p>
                    {queueMeta.playlistName && queueMeta.queueLength != null && queueMeta.queueIndex != null ? (
                      <p className="mt-1 text-xs text-zinc-400">
                        {queueMeta.playlistName} · {queueMeta.queueIndex + 1} / {queueMeta.queueLength}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
                  <Card className="border-zinc-800/80 bg-zinc-950/40 shadow-inner shadow-black/30">
                    <CardHeader className="space-y-0 pb-3 pt-5">
                      <CardTitle className="text-sm font-medium text-zinc-300">Playback</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pb-5 pt-0">
                      {seekSlider()}
                      <div className="flex justify-center py-1">{playbackControls(false)}</div>
                      <Separator className="bg-zinc-800/90" />
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-400">Volume</Label>
                        {volumeRow}
                      </div>
                      {rehearsalMuted ? (
                        <p className="text-xs text-amber-200/90">Soundcheck mode — main mix is muted for listeners.</p>
                      ) : rehearsalLiftActive ? (
                        <p className="text-xs text-emerald-200/90">Temporary soundcheck lift — listeners can hear the mix.</p>
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
                        Math.abs(offsetMs) > 240 && "border-amber-500/40 bg-amber-950/50 text-amber-100",
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
          "fixed inset-x-2 z-40 mx-auto w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-2xl border border-zinc-800/90",
          "bg-gradient-to-r from-zinc-950/90 via-zinc-900/75 to-zinc-950/90",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
          "backdrop-blur-2xl backdrop-saturate-150",
          "transition-[box-shadow,transform] duration-300",
          "bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:inset-x-4 sm:bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
          drawerOpen && "ring-1 ring-emerald-500/35 ring-offset-0 shadow-[0_12px_40px_-10px_rgba(16,185,129,0.2)]",
        )}
      >
        {/* Narrow screens: two rows — more room for touch + wide seek */}
        <div className="flex flex-col gap-2.5 p-2.5 sm:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="touch-manipulation shrink-0 rounded-lg p-0.5 outline-none transition duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500/45"
              onClick={() => onDrawerOpenChange(true)}
              aria-label="Open full player"
            >
              <ArtworkRing letter={artworkLetter} size="xs" accent={accentKey} />
            </button>
            <p
              className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight text-white/95"
              title={title || undefined}
            >
              {title || "No track"}
            </p>
            <div className="flex shrink-0 items-center border-l border-zinc-800/80 pl-2">{playbackControls(true, "touch")}</div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/60 text-emerald-400/95 shadow-sm transition duration-200 hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 active:scale-95"
              onClick={() => onDrawerOpenChange(true)}
              aria-label="Expand player"
            >
              <ChevronUp className="h-[18px] w-[18px] opacity-90" />
            </button>
          </div>
          {miniSeekRow}
          <div className="mt-1.5 h-7 w-full overflow-hidden rounded-lg border border-zinc-800/45 bg-black/35">
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
            className="touch-manipulation shrink-0 rounded-lg outline-none transition duration-200 active:scale-[0.98] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-emerald-500/45"
            onClick={() => onDrawerOpenChange(true)}
            aria-label="Open full player"
          >
            <ArtworkRing letter={artworkLetter} size="xs" accent={accentKey} />
          </button>
          <p
            className="min-w-0 max-w-[min(22vw,200px)] shrink truncate text-left text-[11px] font-medium leading-tight text-white/95 md:max-w-[min(28vw,260px)] lg:max-w-[min(32vw,300px)]"
            title={title || undefined}
          >
            {title || "No track"}
          </p>
          <div className="hidden h-9 min-w-[100px] max-w-[200px] shrink-0 md:flex md:items-stretch lg:max-w-[240px]">
            <div className="h-full w-full overflow-hidden rounded-lg border border-zinc-800/45 bg-black/35">
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
          <div className="flex shrink-0 items-center border-l border-zinc-800/80 pl-2 md:pl-2.5">{playbackControls(true)}</div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/60 text-emerald-400/90 shadow-sm transition duration-200 hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 md:h-9 md:w-9"
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
