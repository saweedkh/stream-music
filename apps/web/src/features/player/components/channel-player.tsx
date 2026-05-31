"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/shared/ui/toast-provider";
import { ChannelPlayerFull } from "@/features/player/components/channel-player-full";
import { ChannelPlayerMini } from "@/features/player/components/channel-player-mini";
import { NowPlayingReactions } from "@/features/player/components/now-playing-reactions";
import type { ChannelExperience } from "@/features/experience";
import type { ChannelPlaybackEventPayload } from "@/features/player/model/playback-payload";
import { useChannelPlaybackEngine } from "@/features/player/hooks/use-channel-playback-engine";
import { useListenHeartbeat } from "@/features/player/hooks/use-listen-heartbeat";
import { useCapacitorBackgroundPlayback } from "@/features/player/hooks/use-capacitor-background-playback";
import { useMediaSession } from "@/features/player/hooks/use-media-session";

export type { ChannelPlaybackEventPayload } from "@/features/player/model/playback-payload";

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
  currentTrackId?: number | null;
};

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
  currentTrackId = null,
}: Props) {
  const { showToast } = useToast();

  const {
    isPlaying,
    activeTrackPath,
    lastSyncAt,
    position,
    setPosition,
    duration,
    volume,
    setVolume,
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

  useListenHeartbeat(channelId, isPlaying, currentTrackId);
  useCapacitorBackgroundPlayback(isPlaying, channelId);

  const [queueMeta, setQueueMeta] = useState<{
    playlistName?: string;
    queueIndex?: number;
    queueLength?: number;
  }>({});

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

  const trackLabel = activeTrackPath ? decodeURIComponent(activeTrackPath.split("/").pop() ?? "Unknown track") : "";
  const title = useMemo(() => trackLabel.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim(), [trackLabel]);
  useMediaSession({
    title: title || "Stream Music",
    isPlaying,
    onPlay: canControl ? () => void applyControl("play") : undefined,
    onPause: canControl ? () => void applyControl("pause") : undefined,
    onNext: canControl ? () => void applyControl("next") : undefined,
  });
  const artworkLetter = title ? title.charAt(0).toUpperCase() : "♪";
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

  const primeAudio = () => {
    recordUserGesture();
    void unlockChannelAudio();
  };

  const onPlayPause = () => {
    recordUserGesture();
    if (!canControl) {
      primeAudio();
      return;
    }
    if (isPlaying) {
      void applyControl("pause", { position: getCurrentPosition() });
    } else {
      void applyControl("play", { position: getCurrentPosition() });
    }
  };

  const seekHandlers = {
    onSeekPointerDown: () => {
      recordUserGesture();
      isDraggingSeekRef.current = true;
    },
    onSeekChange: (value: number) => setPosition(value),
    onSeekCommit: (value: number) => commitSeek(value),
  };

  const handleExpand = () => {
    primeAudio();
    onDrawerOpenChange(true);
  };

  return (
    <>
      <ChannelPlayerFull
        open={drawerOpen}
        onOpenChange={(open) => {
          if (open) primeAudio();
          onDrawerOpenChange(open);
        }}
        channelId={channelId}
        socketState={socketState}
        title={title}
        artworkLetter={artworkLetter}
        accentKey={accentKey}
        isPlaying={isPlaying}
        canControl={canControl}
        activeTrackPath={activeTrackPath}
        seekValue={seekValue}
        seekMax={seekMax}
        duration={duration}
        volume={volume}
        vizAudioEl={vizAudioEl}
        queueMeta={queueMeta}
        syncDeltaMs={syncDeltaMs}
        lastSyncAt={lastSyncAt}
        isBuffering={isBuffering}
        needsUnlock={needsUnlock}
        introRemainingSec={introRemainingSec}
        introCapSec={introCapSec}
        rehearsalMuted={rehearsalMuted}
        rehearsalLiftActive={rehearsalLiftActive}
        onUnlockAudio={primeAudio}
        onPrev={() => void applyControl("prev")}
        onPlayPause={onPlayPause}
        onNext={() => void applyControl("next")}
        onVolumeChange={setVolume}
        onRefreshSync={canControl ? () => void refreshChannelPlaybackState() : undefined}
        reactionsSlot={<NowPlayingReactions channelId={channelId} trackId={currentTrackId} />}
        {...seekHandlers}
      />

      <ChannelPlayerMini
        title={title}
        artworkLetter={artworkLetter}
        accentKey={accentKey}
        isPlaying={isPlaying}
        canControl={canControl}
        activeTrackPath={activeTrackPath}
        seekValue={seekValue}
        seekMax={seekMax}
        duration={duration}
        vizAudioEl={vizAudioEl}
        expanded={drawerOpen}
        needsUnlock={needsUnlock}
        onExpand={handleExpand}
        onUnlockAudio={primeAudio}
        onPrev={() => void applyControl("prev")}
        onPlayPause={onPlayPause}
        onNext={() => void applyControl("next")}
        reactionsSlot={<NowPlayingReactions channelId={channelId} trackId={currentTrackId} compact />}
        {...seekHandlers}
      />
    </>
  );
}
