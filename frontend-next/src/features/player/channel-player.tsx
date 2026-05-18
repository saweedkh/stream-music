"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { ChannelAudioUnlockDialog } from "@/features/player/channel-audio-unlock-dialog";
import { ChannelPlayerFull } from "@/features/player/channel-player-full";
import { ChannelPlayerMini } from "@/features/player/channel-player-mini";
import type { ChannelExperience } from "@/features/experience/room-experience-chrome";
import type { ChannelPlaybackEventPayload } from "@/features/player/playback-payload";
import { useChannelPlaybackEngine } from "@/features/player/use-channel-playback-engine";

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
    unlockChannelAudio,
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

  const onPlayPause = () => {
    const howl = howlRef.current;
    if (!howl) return;
    if (isPlaying) {
      void applyControl("pause", { position: howl.seek() as number });
    } else {
      const at = typeof howl.seek() === "number" ? (howl.seek() as number) : 0;
      void applyControl("play", { position: at });
    }
  };

  const seekHandlers = {
    onSeekPointerDown: () => {
      isDraggingSeekRef.current = true;
    },
    onSeekChange: (value: number) => setPosition(value),
    onSeekCommit: (value: number) => commitSeek(value),
  };

  const showUnlockDialog = Boolean(needsUserInteraction && isPlaying && activeTrackPath);

  const onEnableAudio = () => {
    void unlockChannelAudio();
  };

  return (
    <>
      <ChannelAudioUnlockDialog open={showUnlockDialog} title={title} onEnable={onEnableAudio} />

      <ChannelPlayerFull
        open={drawerOpen}
        onOpenChange={onDrawerOpenChange}
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
        introRemainingSec={introRemainingSec}
        introCapSec={introCapSec}
        rehearsalMuted={rehearsalMuted}
        rehearsalLiftActive={rehearsalLiftActive}
        needsUserInteraction={needsUserInteraction}
        onPrev={() => void applyControl("prev")}
        onPlayPause={onPlayPause}
        onNext={() => void applyControl("next")}
        onVolumeChange={setVolume}
        onEnableAudio={onEnableAudio}
        onRefreshSync={canControl ? () => void refreshChannelPlaybackState() : undefined}
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
        onExpand={() => onDrawerOpenChange(true)}
        onPrev={() => void applyControl("prev")}
        onPlayPause={onPlayPause}
        onNext={() => void applyControl("next")}
        {...seekHandlers}
      />
    </>
  );
}
