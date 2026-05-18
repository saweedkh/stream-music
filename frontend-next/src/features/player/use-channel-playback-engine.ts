"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Howl, Howler } from "howler";

/** One HTML5 track at a time; keep the pool tiny so leaked instances surface quickly. */
if (typeof window !== "undefined") {
  Howler.html5PoolSize = 2;
}
import type { ChannelPlaybackEventPayload } from "@/features/player/playback-payload";
import type { ChannelExperience } from "@/features/experience/room-experience-chrome";
import { mergePlaybackPayload, shouldApplyEventSeq } from "@/features/player/playback-payload";
import { isMediaOutputSuspended, resumeSharedAudioContext } from "@/features/player/audio-wave-visualizer";
import { applyDriftCorrection, expectedTimeSeconds } from "@/features/player/sync-client";
import { ChannelClosedError, getApiBase, getChannelState, getServerTime } from "@/lib/api";

export type PlaybackSyncSnapshot = {
  offsetMs: number;
  isPlaying: boolean;
  startedAt: number | null | undefined;
  pausedAt: number | null | undefined;
  trackPath: string | undefined;
};

function getHowlHtml5Audio(howl: Howl | null): HTMLAudioElement | null {
  if (!howl) return null;
  const sounds = (howl as unknown as { _sounds?: Array<{ _node?: unknown }> })._sounds;
  const node = sounds?.[0]?._node;
  return node instanceof HTMLAudioElement ? node : null;
}

function blendClockOffset(prevMs: number, sampleMs: number, alpha: number): number {
  if (!Number.isFinite(sampleMs)) return prevMs;
  if (!Number.isFinite(prevMs) || Math.abs(prevMs) < 1) return sampleMs;
  return prevMs + (sampleMs - prevMs) * alpha;
}

const AUDIO_RESYNC_SILENCE_MS = 1100;

function shouldAudienceHear(
  howl: Howl,
  canControl: boolean,
  experience: ChannelExperience | null,
): boolean {
  const exp = experience;
  const audio = getHowlHtml5Audio(howl);
  const posNow =
    audio && Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : typeof howl.seek() === "number"
        ? (howl.seek() as number)
        : 0;
  const introCap = Math.max(0, Math.min(120, Number(exp?.intro_preview_seconds) || 0));
  const introGate = !canControl && introCap > 0 && posNow >= introCap;
  const liftActive = Boolean(exp?.rehearsal_lift_until && Date.parse(exp.rehearsal_lift_until) > Date.now());
  const rehearsalMute = Boolean(exp?.rehearsal_mode && !canControl && !liftActive);
  return !rehearsalMute && !introGate;
}

function isLocalPlaybackAudible(howl: Howl, audio: HTMLAudioElement | null): boolean {
  if (!howl.playing()) return false;
  if (audio?.paused) return false;
  if (audio && isMediaOutputSuspended(audio)) return false;
  return true;
}

type EngineOptions = {
  channelId: string;
  socketState: "connecting" | "connected" | "reconnecting" | "closed";
  initialTrackPath?: string;
  initialStartedAt?: number | null;
  initialPausedAt?: number | null;
  initialIsPlaying?: boolean;
  canControl?: boolean;
  experience?: ChannelExperience | null;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  onToast?: (message: string, tone: "error" | "success" | "info") => void;
};

export function useChannelPlaybackEngine({
  channelId,
  socketState,
  initialTrackPath,
  initialStartedAt,
  initialPausedAt,
  initialIsPlaying = false,
  canControl = false,
  experience = null,
  sendSocketMessage,
  onToast,
}: EngineOptions) {
  const experienceRef = useRef(experience);
  experienceRef.current = experience;
  const canControlRef = useRef(canControl);
  canControlRef.current = canControl;
  const howlRef = useRef<Howl | null>(null);
  const loadGenerationRef = useRef(0);
  const lastTransportRef = useRef({
    playing: initialIsPlaying,
    track: initialTrackPath,
    started: initialStartedAt,
    paused: initialPausedAt,
  });
  const lastAppliedEventSeqRef = useRef(0);
  const autoNextSentForTrackRef = useRef<string | null>(null);
  const suppressDriftUntilRef = useRef(0);
  const isDraggingSeekRef = useRef(false);
  const isPlayingRef = useRef(initialIsPlaying);
  const socketConnectedRef = useRef(socketState === "connected");
  const sendSocketMessageRef = useRef(sendSocketMessage);
  const pendingSocketCommandRef = useRef<Record<string, unknown> | null>(null);
  const controlRequestInFlightRef = useRef(false);
  const loadedTrackSrcRef = useRef<string | null>(null);
  const hasServerClockRef = useRef(false);
  const needsUserInteractionRef = useRef(false);
  const audioSilentSinceRef = useRef<number | null>(null);
  const isBufferingRef = useRef(false);
  const propSnapshotRef = useRef({
    trackPath: initialTrackPath,
    startedAt: initialStartedAt,
    pausedAt: initialPausedAt,
    initialIsPlaying,
  });
  propSnapshotRef.current = {
    trackPath: initialTrackPath,
    startedAt: initialStartedAt,
    pausedAt: initialPausedAt,
    initialIsPlaying,
  };

  const syncRef = useRef<PlaybackSyncSnapshot>({
    offsetMs: 0,
    isPlaying: initialIsPlaying,
    startedAt: initialStartedAt,
    pausedAt: initialPausedAt,
    trackPath: initialTrackPath,
  });

  const [offsetMs, setOffsetMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
  const [syncStartedAt, setSyncStartedAt] = useState<number | null | undefined>(initialStartedAt);
  const [syncPausedAt, setSyncPausedAt] = useState<number | null | undefined>(initialPausedAt);
  const [activeTrackPath, setActiveTrackPath] = useState<string | undefined>(initialTrackPath);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  needsUserInteractionRef.current = needsUserInteraction;
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;
  const [queueVersion, setQueueVersion] = useState(0);
  const queueVersionRef = useRef(0);
  queueVersionRef.current = queueVersion;
  const [vizAudioEl, setVizAudioEl] = useState<HTMLAudioElement | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  isBufferingRef.current = isBuffering;

  syncRef.current = {
    offsetMs,
    isPlaying,
    startedAt: syncStartedAt,
    pausedAt: syncPausedAt,
    trackPath: activeTrackPath,
  };

  const teardownMainHowl = useCallback(() => {
    const prev = howlRef.current;
    howlRef.current = null;
    setVizAudioEl(null);
    if (!prev) return;
    try {
      prev.stop();
      prev.unload();
    } catch {
      /* ignore */
    }
  }, []);

  const requestAutoNext = useCallback(
    (howl: Howl) => {
      if (!isPlayingRef.current || !socketConnectedRef.current) return;

      const trackKey = syncRef.current.trackPath ?? "";
      if (autoNextSentForTrackRef.current === trackKey) return;

      const audio = getHowlHtml5Audio(howl);
      const dur =
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : typeof howl.duration === "function"
            ? Number(howl.duration()) || 0
            : 0;
      let pos = 0;
      if (audio && Number.isFinite(audio.currentTime)) pos = audio.currentTime;
      else if (typeof howl.seek() === "function") pos = Number(howl.seek()) || 0;

      // After a natural end Howler often resets seek to 0 — only skip mid-track stop/unload.
      if (dur > 3 && pos > 1.5 && pos < dur - 1.5) return;

      autoNextSentForTrackRef.current = trackKey;
      const payload = {
        action: "auto_next" as const,
        client_duration_sec: dur,
        client_event_id: `${channelId}:${trackKey}:${Date.now()}`,
      };
      const ok = sendSocketMessageRef.current?.(payload);
      if (!ok) pendingSocketCommandRef.current = payload;
    },
    [channelId],
  );

  const requestAutoNextRef = useRef(requestAutoNext);
  requestAutoNextRef.current = requestAutoNext;

  const seekHowlToSync = useCallback((howl: Howl, force = false) => {
    const snap = syncRef.current;
    const expected = expectedTimeSeconds({
      startedAt: snap.startedAt,
      pausedAt: snap.pausedAt,
      offsetMs: snap.offsetMs,
      isPlaying: true,
    });
    const current = typeof howl.seek() === "number" ? (howl.seek() as number) : 0;
    if (force || Math.abs(current - expected) > 0.85) {
      howl.seek(Math.max(0, expected));
      suppressDriftUntilRef.current = Date.now() + 2800;
    }
    return expected;
  }, []);

  const startHowlTransport = useCallback((howl: Howl, opts?: { forceSeek?: boolean }) => {
    const audio = getHowlHtml5Audio(howl);
    if (audio) audio.playbackRate = 1;
    if (typeof howl.rate === "function") howl.rate(1);
    seekHowlToSync(howl, Boolean(opts?.forceSeek));
    if (!howl.playing()) {
      const played = howl.play();
      if (played === undefined) {
        suppressDriftUntilRef.current = Date.now() + 2800;
      }
    }
  }, [seekHowlToSync]);

  const tryStartPendingTransport = useCallback(() => {
    const howl = howlRef.current;
    if (!howl || !isPlayingRef.current || !hasServerClockRef.current) return;
    if (needsUserInteractionRef.current) {
      seekHowlToSync(howl, true);
      return;
    }
    startHowlTransport(howl, { forceSeek: true });
  }, [seekHowlToSync, startHowlTransport]);

  const markNeedsAudioResync = useCallback(
    (howl?: Howl | null) => {
      const h = howl ?? howlRef.current;
      if (!h || !isPlayingRef.current || needsUserInteractionRef.current) return;
      if (!syncRef.current.trackPath) return;

      audioSilentSinceRef.current = null;
      needsUserInteractionRef.current = true;
      setNeedsUserInteraction(true);
      seekHowlToSync(h, true);
      if (h.playing()) {
        try {
          h.pause();
        } catch {
          /* ignore */
        }
      }
    },
    [seekHowlToSync],
  );

  const markNeedsAudioResyncRef = useRef(markNeedsAudioResync);
  markNeedsAudioResyncRef.current = markNeedsAudioResync;

  const unlockChannelAudio = useCallback(async () => {
    const howl = howlRef.current;
    if (!howl) return;

    let nextOffset = syncRef.current.offsetMs;
    try {
      const { offset } = await getServerTime();
      nextOffset = blendClockOffset(nextOffset, offset, 0.65);
      setOffsetMs(nextOffset);
    } catch {
      /* keep last offset */
    }

    syncRef.current = { ...syncRef.current, offsetMs: nextOffset };
    await resumeSharedAudioContext();
    audioSilentSinceRef.current = null;
    needsUserInteractionRef.current = false;
    setNeedsUserInteraction(false);
    startHowlTransport(howl, { forceSeek: true });
  }, [startHowlTransport]);

  const applySyncState = useCallback(
    (patch: Partial<PlaybackSyncSnapshot> & { queueVersion?: number }) => {
      if (typeof patch.isPlaying === "boolean") setIsPlaying(patch.isPlaying);
      if ("startedAt" in patch) setSyncStartedAt(patch.startedAt);
      if ("pausedAt" in patch) setSyncPausedAt(patch.pausedAt);
      if ("trackPath" in patch) setActiveTrackPath(patch.trackPath);
      if (typeof patch.queueVersion === "number") setQueueVersion(patch.queueVersion);
      setLastSyncAt(Date.now());
    },
    [],
  );

  const handleIncomingPlaybackPayload = useCallback(
    (payload: ChannelPlaybackEventPayload) => {
      const action = String(payload.action ?? "").toLowerCase();
      const seqDecision = shouldApplyEventSeq(lastAppliedEventSeqRef.current, payload, action);
      if (!seqDecision.apply) return;
      lastAppliedEventSeqRef.current = seqDecision.nextSeq;

      if (action === "initial_sync" && typeof payload.server_time === "number" && Number.isFinite(payload.server_time)) {
        const sample = payload.server_time * 1000 - Date.now();
        setOffsetMs((prev) => blendClockOffset(prev, sample, 0.45));
        hasServerClockRef.current = true;
      }

      const merged = mergePlaybackPayload(
        {
          isPlaying: syncRef.current.isPlaying,
          startedAt: syncRef.current.startedAt,
          pausedAt: syncRef.current.pausedAt,
          trackPath: syncRef.current.trackPath,
          queueVersion: queueVersionRef.current,
        },
        payload,
      );

      if (merged.trackPath !== syncRef.current.trackPath) {
        autoNextSentForTrackRef.current = null;
      }

      applySyncState({
        isPlaying: merged.isPlaying,
        startedAt: merged.startedAt,
        pausedAt: merged.pausedAt,
        trackPath: merged.trackPath,
        queueVersion: merged.queueVersion,
      });
    },
    [applySyncState],
  );

  const handleIncomingRef = useRef(handleIncomingPlaybackPayload);
  handleIncomingRef.current = handleIncomingPlaybackPayload;

  const refreshChannelPlaybackState = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        const data = await getChannelState(channelId);
        autoNextSentForTrackRef.current = null;
        applySyncState({
          isPlaying: data.playback.is_playing,
          startedAt: data.playback.started_at_server_time,
          pausedAt: data.playback.paused_at_position,
          trackPath: data.playback.track?.file ?? undefined,
          queueVersion: data.playback.queue_version,
        });
      } catch (error) {
        if (error instanceof ChannelClosedError) {
          if (!options?.silent) onToast?.("This channel is closed.", "info");
          return;
        }
        const message = error instanceof Error ? error.message : "Cannot refresh channel state";
        if (!options?.silent) onToast?.(message, "error");
      }
    },
    [applySyncState, channelId, onToast],
  );

  const applyControl = useCallback(
    async (action: "play" | "pause" | "seek" | "next" | "prev", payload?: Record<string, unknown>) => {
      if (!canControl || !sendSocketMessage) return;
      if (controlRequestInFlightRef.current) return;
      controlRequestInFlightRef.current = true;
      try {
        const sent = sendSocketMessage({ action, ...payload });
        if (!sent) {
          pendingSocketCommandRef.current = { action, ...payload };
          onToast?.("Socket reconnecting... command queued.", "error");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : `Cannot ${action} playback`;
        onToast?.(message, "error");
      } finally {
        controlRequestInFlightRef.current = false;
      }
    },
    [canControl, onToast, sendSocketMessage],
  );

  const commitSeek = useCallback(
    (next: number) => {
      isDraggingSeekRef.current = false;
      const clamped = Math.max(0, next);
      setPosition(clamped);
      const howl = howlRef.current;
      if (howl) {
        howl.seek(clamped);
        suppressDriftUntilRef.current = Date.now() + 2800;
      }
      if (canControl) void applyControl("seek", { position: clamped });
    },
    [applyControl, canControl],
  );

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      audioSilentSinceRef.current = null;
      needsUserInteractionRef.current = false;
      setNeedsUserInteraction(false);
    }
  }, [isPlaying]);

  useEffect(() => {
    socketConnectedRef.current = socketState === "connected";
  }, [socketState]);

  useEffect(() => {
    sendSocketMessageRef.current = sendSocketMessage;
  }, [sendSocketMessage]);

  useEffect(() => {
    const sync = () => {
      void getServerTime()
        .then(({ offset }) => {
          setOffsetMs((prev) => blendClockOffset(prev, offset, 0.5));
          hasServerClockRef.current = true;
          tryStartPendingTransport();
        })
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
  }, [tryStartPendingTransport]);

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
      .then(({ offset }) => {
        setOffsetMs((prev) => blendClockOffset(prev, offset, 0.55));
        hasServerClockRef.current = true;
        tryStartPendingTransport();
      })
      .catch(() => {});
  }, [socketState, channelId, tryStartPendingTransport]);

  useEffect(() => {
    lastAppliedEventSeqRef.current = 0;
    loadedTrackSrcRef.current = null;
    autoNextSentForTrackRef.current = null;
    suppressDriftUntilRef.current = 0;
    hasServerClockRef.current = false;
    setQueueVersion(0);
    teardownMainHowl();
    setPosition(0);
    setDuration(0);
    setIsBuffering(false);
    const snap = propSnapshotRef.current;
    const requireUnlock = Boolean(
      !canControlRef.current && snap.initialIsPlaying && snap.trackPath,
    );
    needsUserInteractionRef.current = requireUnlock;
    setNeedsUserInteraction(requireUnlock);
    void getServerTime()
      .then(({ offset }) => {
        setOffsetMs((prev) => blendClockOffset(prev, offset, 0.55));
        hasServerClockRef.current = true;
        tryStartPendingTransport();
      })
      .catch(() => {});
    applySyncState({
      isPlaying: snap.initialIsPlaying,
      startedAt: snap.startedAt,
      pausedAt: snap.pausedAt,
      trackPath: snap.trackPath,
    });
    lastTransportRef.current = {
      playing: snap.initialIsPlaying,
      track: snap.trackPath,
      started: snap.startedAt,
      paused: snap.pausedAt,
    };
  }, [applySyncState, channelId, teardownMainHowl]);

  useEffect(() => {
    return () => {
      teardownMainHowl();
    };
  }, [teardownMainHowl]);

  useEffect(() => {
    if (socketState !== "closed") return;
    void refreshChannelPlaybackState({ silent: true });
  }, [channelId, refreshChannelPlaybackState, socketState]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ channelId?: string; payload?: ChannelPlaybackEventPayload }>;
      if (String(customEvent.detail?.channelId ?? "") !== String(channelId)) return;
      const payload = customEvent.detail?.payload;
      if (payload) {
        handleIncomingRef.current(payload);
        return;
      }
      void refreshChannelPlaybackState({ silent: true });
    };
    window.addEventListener("channel-playback-updated", handler as EventListener);
    return () => window.removeEventListener("channel-playback-updated", handler as EventListener);
  }, [channelId, refreshChannelPlaybackState]);

  useEffect(() => {
    if (socketState !== "connected") return;
    const command = pendingSocketCommandRef.current;
    if (!command || !sendSocketMessage) return;
    const sent = sendSocketMessage(command);
    if (sent) {
      pendingSocketCommandRef.current = null;
      onToast?.("Queued command sent.", "success");
    }
  }, [onToast, sendSocketMessage, socketState]);

  useEffect(() => {
    const src = activeTrackPath ? `${getApiBase()}${activeTrackPath}` : null;
    const loadGen = ++loadGenerationRef.current;

    if (!src) {
      loadedTrackSrcRef.current = null;
      teardownMainHowl();
      setPosition(0);
      setDuration(0);
      setIsBuffering(false);
      return;
    }

    if (loadedTrackSrcRef.current === src && howlRef.current) {
      return;
    }
    loadedTrackSrcRef.current = src;
    autoNextSentForTrackRef.current = null;

    teardownMainHowl();
    setIsBuffering(true);

    const howl = new Howl({
      src: [src],
      html5: true,
      preload: true,
      volume: volumeRef.current,
      onload: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        setIsBuffering(false);
        setDuration(howl.duration() || 0);
        setVizAudioEl(getHowlHtml5Audio(howl));
        if (isPlayingRef.current) tryStartPendingTransport();
      },
      onplay: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        setIsBuffering(false);
        setVizAudioEl(getHowlHtml5Audio(howl));
      },
      onplayerror: () => {
        if (loadGen !== loadGenerationRef.current) return;
        setIsBuffering(false);
        markNeedsAudioResyncRef.current(howl);
      },
      onpause: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        if (!isPlayingRef.current || needsUserInteractionRef.current) return;
        markNeedsAudioResyncRef.current(howl);
      },
      onloaderror: () => {
        if (loadGen !== loadGenerationRef.current) return;
        loadedTrackSrcRef.current = null;
        setIsBuffering(false);
        onToastRef.current?.("Cannot load audio source", "error");
      },
      onend: () => {
        if (loadGen !== loadGenerationRef.current || howlRef.current !== howl) return;
        requestAutoNextRef.current(howl);
      },
    });

    howlRef.current = howl;

    return () => {
      if (loadGen !== loadGenerationRef.current) return;
      if (howlRef.current === howl) howlRef.current = null;
      try {
        howl.stop();
        howl.unload();
      } catch {
        /* ignore */
      }
      setVizAudioEl(null);
    };
  }, [activeTrackPath, channelId, seekHowlToSync, teardownMainHowl, tryStartPendingTransport]);

  useEffect(() => {
    const howl = howlRef.current;
    const audio = vizAudioEl;
    if (!howl || !audio) return;
    const onNativeEnded = () => {
      if (howlRef.current !== howl) return;
      requestAutoNextRef.current(howl);
    };
    const onNativePause = () => {
      if (howlRef.current !== howl) return;
      if (!isPlayingRef.current || needsUserInteractionRef.current) return;
      markNeedsAudioResyncRef.current(howl);
    };
    const onNativeStalled = () => {
      if (howlRef.current !== howl) return;
      if (!isPlayingRef.current || needsUserInteractionRef.current) return;
      markNeedsAudioResyncRef.current(howl);
    };
    audio.addEventListener("ended", onNativeEnded);
    audio.addEventListener("pause", onNativePause);
    audio.addEventListener("stalled", onNativeStalled);
    return () => {
      audio.removeEventListener("ended", onNativeEnded);
      audio.removeEventListener("pause", onNativePause);
      audio.removeEventListener("stalled", onNativeStalled);
    };
  }, [vizAudioEl, activeTrackPath]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const howl = howlRef.current;
      if (!howl || !isPlayingRef.current || needsUserInteractionRef.current) return;
      if (!shouldAudienceHear(howl, canControlRef.current, experienceRef.current)) return;
      window.setTimeout(() => {
        if (!isPlayingRef.current || needsUserInteractionRef.current) return;
        const audio = getHowlHtml5Audio(howl);
        if (!isLocalPlaybackAudible(howl, audio)) {
          markNeedsAudioResyncRef.current(howl);
        }
      }, 400);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    let raf = 0;
    let driftTick = 0;
    const tick = () => {
      const howl = howlRef.current;
      if (howl) {
        const audio = getHowlHtml5Audio(howl);
        const snap = syncRef.current;
        if (!isDraggingSeekRef.current) {
          const current =
            audio && Number.isFinite(audio.currentTime)
              ? audio.currentTime
              : typeof howl.seek() === "number"
                ? (howl.seek() as number)
                : 0;
          setPosition(current);
        }

        if (snap.isPlaying && audio && !isDraggingSeekRef.current && Date.now() >= suppressDriftUntilRef.current) {
          if (driftTick++ % 5 === 0) {
            applyDriftCorrection(audio, {
              startedAt: snap.startedAt,
              pausedAt: snap.pausedAt,
              offsetMs: snap.offsetMs,
              isPlaying: true,
            });
          }
          if (typeof howl.rate === "function") howl.rate(1);
        } else if (audio) {
          audio.playbackRate = 1;
        }

        const exp = experienceRef.current;
        const posNow =
          audio && Number.isFinite(audio.currentTime)
            ? audio.currentTime
            : typeof howl.seek() === "number"
              ? (howl.seek() as number)
              : 0;
        const introCap = Math.max(0, Math.min(120, Number(exp?.intro_preview_seconds) || 0));
        const introGate = !canControlRef.current && introCap > 0 && posNow >= introCap;
        const liftActive = Boolean(
          exp?.rehearsal_lift_until && Date.parse(exp.rehearsal_lift_until) > Date.now(),
        );
        const rehearsalMute = Boolean(exp?.rehearsal_mode && !canControlRef.current && !liftActive);
        howl.volume(rehearsalMute || introGate ? 0 : volume);

        const trackDur =
          audio && Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : typeof howl.duration === "function"
              ? Number(howl.duration()) || 0
              : 0;
        const trackKey = snap.trackPath ?? "";
        if (
          snap.isPlaying &&
          trackDur > 0.5 &&
          posNow >= trackDur - 0.35 &&
          autoNextSentForTrackRef.current !== trackKey
        ) {
          requestAutoNextRef.current(howl);
        }

        const nearTrackEnd = trackDur > 0.5 && posNow >= trackDur - 1.2;
        const howlReady = (howl as Howl & { state?: () => string }).state?.() === "loaded";
        if (
          snap.isPlaying &&
          snap.trackPath &&
          howlReady &&
          !isBufferingRef.current &&
          !needsUserInteractionRef.current &&
          !nearTrackEnd &&
          Date.now() >= suppressDriftUntilRef.current &&
          shouldAudienceHear(howl, canControlRef.current, experienceRef.current)
        ) {
          const audible = isLocalPlaybackAudible(howl, audio);
          if (!audible) {
            const since = audioSilentSinceRef.current;
            if (since == null) {
              audioSilentSinceRef.current = Date.now();
            } else if (Date.now() - since >= AUDIO_RESYNC_SILENCE_MS) {
              markNeedsAudioResyncRef.current(howl);
            }
          } else {
            audioSilentSinceRef.current = null;
          }
        } else if (!snap.isPlaying || needsUserInteractionRef.current) {
          audioSilentSinceRef.current = null;
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [volume]);

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
    const trackChanged = prev.track !== next.track;
    const playStateChanged = prev.playing !== next.playing;
    const startAnchorChanged = next.playing && prev.started !== next.started;
    const pausePosChanged = !next.playing && prev.paused !== next.paused;
    lastTransportRef.current = next;

    if (trackChanged) return;

    if (isPlaying) {
      if (needsUserInteractionRef.current) {
        seekHowlToSync(howl, playStateChanged || startAnchorChanged);
        return;
      }
      if (!playStateChanged && !startAnchorChanged && howl.playing()) return;
      startHowlTransport(howl, { forceSeek: playStateChanged || startAnchorChanged });
      return;
    }

    if (!playStateChanged && !pausePosChanged && !howl.playing()) return;
    const audio = getHowlHtml5Audio(howl);
    if (audio) audio.playbackRate = 1;
    if (typeof howl.rate === "function") howl.rate(1);
    if (howl.playing()) howl.pause();
    if (typeof syncPausedAt === "number") {
      howl.seek(Math.max(0, syncPausedAt));
      setPosition(Math.max(0, syncPausedAt));
      suppressDriftUntilRef.current = Date.now() + 1500;
    }
  }, [activeTrackPath, isPlaying, seekHowlToSync, startHowlTransport, syncPausedAt, syncStartedAt]);

  useEffect(() => {
    if (!needsUserInteraction || !isPlaying) return;
    const howl = howlRef.current;
    if (!howl) return;
    const expected = seekHowlToSync(howl, false);
    setPosition(Math.max(0, expected));
  }, [needsUserInteraction, isPlaying, offsetMs, seekHowlToSync, syncPausedAt, syncStartedAt]);

  return {
    howlRef,
    isPlaying,
    syncStartedAt,
    syncPausedAt,
    activeTrackPath,
    lastSyncAt,
    needsUserInteraction,
    setNeedsUserInteraction,
    position,
    setPosition,
    duration,
    volume,
    setVolume,
    queueVersion,
    vizAudioEl,
    isBuffering,
    offsetMs,
    isDraggingSeekRef,
    applyControl,
    commitSeek,
    refreshChannelPlaybackState,
    startHowlTransport,
    unlockChannelAudio,
  };
}
