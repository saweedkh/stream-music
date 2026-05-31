"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelPlaybackEventPayload } from "@/features/player/model/playback-payload";
import type { ChannelExperience } from "@/features/experience/components/room-experience-chrome";
import { mergePlaybackPayload, shouldApplyEventSeq } from "@/features/player/model/playback-payload";
import { resumeSharedAudioContext } from "@/features/player/components/audio-wave-visualizer";
import {
  createChannelAudio,
  haltChannelAudio,
  loadChannelTrack,
  playChannelAudio,
  readDuration,
  readPosition,
  seekChannelAudio,
} from "@/features/player/model/channel-audio-transport";
import { audienceVolume } from "@/features/player/model/playback-audience";
import { applyDriftCorrection, expectedTimeSeconds } from "@/features/player/model/sync-client";
import { ChannelClosedError, getChannelState, getServerTime } from "@/lib/api";
import { resolveMediaSrc } from "@/lib/media-url";

export type PlaybackSyncSnapshot = {
  offsetMs: number;
  isPlaying: boolean;
  startedAt: number | null | undefined;
  pausedAt: number | null | undefined;
  trackPath: string | undefined;
};

function blendClockOffset(prevMs: number, sampleMs: number, alpha: number): number {
  if (!Number.isFinite(sampleMs)) return prevMs;
  if (!Number.isFinite(prevMs) || Math.abs(prevMs) < 1) return sampleMs;
  return prevMs + (sampleMs - prevMs) * alpha;
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadGenerationRef = useRef(0);
  const loadedSrcRef = useRef<string | null>(null);
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
  const hasServerClockRef = useRef(false);
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
  const [isBuffering, setIsBuffering] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [vizAudioEl, setVizAudioEl] = useState<HTMLAudioElement | null>(null);

  syncRef.current = {
    offsetMs,
    isPlaying,
    startedAt: syncStartedAt,
    pausedAt: syncPausedAt,
    trackPath: activeTrackPath,
  };

  const invalidateLoads = useCallback(() => {
    loadGenerationRef.current += 1;
  }, []);

  const haltPlaybackNow = useCallback(() => {
    invalidateLoads();
    loadedSrcRef.current = null;
    haltChannelAudio(audioRef.current);
    suppressDriftUntilRef.current = Date.now() + 4000;
  }, [invalidateLoads]);

  const seekAudioToSync = useCallback((audio: HTMLAudioElement, force = false) => {
    const snap = syncRef.current;
    const expected = expectedTimeSeconds({
      startedAt: snap.startedAt,
      pausedAt: snap.pausedAt,
      offsetMs: snap.offsetMs,
      isPlaying: true,
    });
    const current = readPosition(audio);
    if (force || Math.abs(current - expected) > 0.85) {
      seekChannelAudio(audio, Math.max(0, expected));
      suppressDriftUntilRef.current = Date.now() + 2800;
    }
    return expected;
  }, []);

  const applyTransport = useCallback(
    async (opts?: { forceSeek?: boolean }) => {
      const audio = audioRef.current;
      if (!audio?.src) return;
      if (!isPlayingRef.current) return;

      audio.playbackRate = 1;
      seekAudioToSync(audio, Boolean(opts?.forceSeek));

      const pos = readPosition(audio);
      audio.volume = audienceVolume(pos, canControlRef.current, experienceRef.current, volumeRef.current);

      await resumeSharedAudioContext();
      const result = await playChannelAudio(audio);
      if (result === "playing") {
        setNeedsUnlock(false);
        setIsBuffering(false);
        return;
      }
      if (result === "blocked") {
        setNeedsUnlock(true);
        setIsBuffering(false);
      }
    },
    [seekAudioToSync],
  );

  const applyTransportRef = useRef(applyTransport);
  applyTransportRef.current = applyTransport;

  const pauseAudioAtSync = useCallback((audio: HTMLAudioElement) => {
    audio.playbackRate = 1;
    if (!audio.paused) audio.pause();
    const snap = syncRef.current;
    if (typeof snap.pausedAt === "number") {
      seekChannelAudio(audio, Math.max(0, snap.pausedAt));
      setPosition(Math.max(0, snap.pausedAt));
      suppressDriftUntilRef.current = Date.now() + 1500;
    }
  }, []);

  const requestAutoNext = useCallback(
    (audio: HTMLAudioElement) => {
      if (!isPlayingRef.current || !socketConnectedRef.current) return;

      const trackKey = syncRef.current.trackPath ?? "";
      if (autoNextSentForTrackRef.current === trackKey) return;

      const dur = readDuration(audio);
      const pos = readPosition(audio);
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

  const recordUserGesture = useCallback(() => {
    void resumeSharedAudioContext();
  }, []);

  const unlockChannelAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.src) return;

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
    await applyTransportRef.current({ forceSeek: true });
  }, []);

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
        haltPlaybackNow();
        suppressDriftUntilRef.current = Date.now() + 5000;
      }

      applySyncState({
        isPlaying: merged.isPlaying,
        startedAt: merged.startedAt,
        pausedAt: merged.pausedAt,
        trackPath: merged.trackPath,
        queueVersion: merged.queueVersion,
      });
    },
    [applySyncState, haltPlaybackNow],
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
        if (action === "next" || action === "prev") {
          haltPlaybackNow();
          setIsBuffering(true);
        }
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
    [canControl, haltPlaybackNow, onToast, sendSocketMessage],
  );

  const commitSeek = useCallback(
    (next: number) => {
      isDraggingSeekRef.current = false;
      const clamped = Math.max(0, next);
      setPosition(clamped);
      const audio = audioRef.current;
      if (audio?.src) {
        seekChannelAudio(audio, clamped);
        suppressDriftUntilRef.current = Date.now() + 2800;
      }
      if (canControl) void applyControl("seek", { position: clamped });
    },
    [applyControl, canControl],
  );

  const getCurrentPosition = useCallback(() => {
    const audio = audioRef.current;
    return audio?.src ? readPosition(audio) : position;
  }, [position]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (!isPlaying && !audio.paused) {
      pauseAudioAtSync(audio);
    }
  }, [isPlaying, pauseAudioAtSync]);

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
          if (isPlayingRef.current) void applyTransportRef.current();
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
      .then(({ offset }) => {
        setOffsetMs((prev) => blendClockOffset(prev, offset, 0.55));
        hasServerClockRef.current = true;
        if (isPlayingRef.current) void applyTransportRef.current({ forceSeek: true });
      })
      .catch(() => {});
  }, [socketState, channelId]);

  useEffect(() => {
    const audio = createChannelAudio();
    audio.setAttribute("data-channel-audio", channelId);
    audio.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    setVizAudioEl(audio);

    const onEnded = () => {
      requestAutoNextRef.current(audio);
    };

    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("ended", onEnded);
      haltChannelAudio(audio);
      audio.remove();
      if (audioRef.current === audio) audioRef.current = null;
      setVizAudioEl(null);
    };
  }, [channelId]);

  useEffect(() => {
    lastAppliedEventSeqRef.current = 0;
    loadedSrcRef.current = null;
    autoNextSentForTrackRef.current = null;
    suppressDriftUntilRef.current = 0;
    hasServerClockRef.current = false;
    setQueueVersion(0);
    setNeedsUnlock(false);
    haltPlaybackNow();
    setPosition(0);
    setDuration(0);
    setIsBuffering(false);

    const snap = propSnapshotRef.current;
    void getServerTime()
      .then(({ offset }) => {
        setOffsetMs((prev) => blendClockOffset(prev, offset, 0.55));
        hasServerClockRef.current = true;
        if (snap.initialIsPlaying) void applyTransportRef.current({ forceSeek: true });
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
  }, [applySyncState, channelId, haltPlaybackNow]);

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
    const audio = audioRef.current;
    if (!audio) return;

    const src = resolveMediaSrc(activeTrackPath);
    const loadId = ++loadGenerationRef.current;

    if (!src) {
      loadedSrcRef.current = null;
      haltChannelAudio(audio);
      setPosition(0);
      setDuration(0);
      setIsBuffering(false);
      return;
    }

    if (loadedSrcRef.current === src) {
      return;
    }

    loadedSrcRef.current = src;
    autoNextSentForTrackRef.current = null;
    setIsBuffering(true);

    let cancelled = false;

    void (async () => {
      const result = await loadChannelTrack(audio, src, () => loadGenerationRef.current === loadId);
      if (cancelled || loadGenerationRef.current !== loadId) return;

      if (result === "error") {
        loadedSrcRef.current = null;
        setIsBuffering(false);
        onToastRef.current?.("Cannot load audio source", "error");
        return;
      }
      if (result === "aborted") return;

      setDuration(readDuration(audio));
      setIsBuffering(false);

      if (isPlayingRef.current) {
        await applyTransportRef.current({ forceSeek: true });
      } else if (!isPlayingRef.current && typeof syncRef.current.pausedAt === "number") {
        seekChannelAudio(audio, Math.max(0, syncRef.current.pausedAt));
        setPosition(Math.max(0, syncRef.current.pausedAt));
      }
    })();

    return () => {
      cancelled = true;
      loadGenerationRef.current += 1;
      haltChannelAudio(audio);
      if (loadedSrcRef.current === src) loadedSrcRef.current = null;
    };
  }, [activeTrackPath, channelId]);

  useEffect(() => {
    let raf = 0;
    let driftTick = 0;

    const tick = () => {
      const audio = audioRef.current;
      if (audio?.src) {
        const snap = syncRef.current;
        const posNow = readPosition(audio);

        if (!isDraggingSeekRef.current) {
          setPosition(posNow);
        }

        if (snap.isPlaying && !isDraggingSeekRef.current && Date.now() >= suppressDriftUntilRef.current) {
          if (driftTick++ % 5 === 0) {
            applyDriftCorrection(audio, {
              startedAt: snap.startedAt,
              pausedAt: snap.pausedAt,
              offsetMs: snap.offsetMs,
              isPlaying: true,
            });
          }
        } else {
          audio.playbackRate = 1;
        }

        audio.volume = audienceVolume(posNow, canControlRef.current, experienceRef.current, volumeRef.current);

        const trackDur = readDuration(audio);
        const trackKey = snap.trackPath ?? "";
        if (snap.isPlaying && trackDur > 0.5 && posNow >= trackDur - 0.35 && autoNextSentForTrackRef.current !== trackKey) {
          requestAutoNextRef.current(audio);
        }
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio?.src) return;

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
      if (!playStateChanged && !startAnchorChanged && !audio.paused) return;
      void applyTransport({ forceSeek: playStateChanged || startAnchorChanged });
      return;
    }

    if (!playStateChanged && !pausePosChanged && audio.paused) return;
    pauseAudioAtSync(audio);
  }, [activeTrackPath, applyTransport, isPlaying, pauseAudioAtSync, syncPausedAt, syncStartedAt]);

  return {
    audioRef,
    isPlaying,
    syncStartedAt,
    syncPausedAt,
    activeTrackPath,
    lastSyncAt,
    position,
    setPosition,
    duration,
    volume,
    setVolume,
    queueVersion,
    vizAudioEl,
    isBuffering,
    needsUnlock,
    offsetMs,
    isDraggingSeekRef,
    applyControl,
    commitSeek,
    refreshChannelPlaybackState,
    unlockChannelAudio,
    recordUserGesture,
    getCurrentPosition,
  };
}
