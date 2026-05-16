"use client";

import { ChannelPlayer } from "@/features/player/channel-player";
import { useGlobalChannelPlayer } from "@/features/player/global-channel-player-context";

export function GlobalChannelPlayerDock() {
  const { state, expanded, setExpanded } = useGlobalChannelPlayer();

  if (!state.channelId) return null;

  return (
    <ChannelPlayer
      channelId={state.channelId}
      socketState={state.socketState}
      trackPath={state.trackPath}
      startedAt={state.startedAt}
      pausedAt={state.pausedAt}
      initialIsPlaying={state.initialIsPlaying}
      canControl={state.canControl}
      sendSocketMessage={state.sendSocketMessage}
      experience={state.experience ?? null}
      drawerOpen={expanded}
      onDrawerOpenChange={setExpanded}
    />
  );
}
