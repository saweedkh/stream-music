"use client";

import { ChannelAdminPlaylistPanel } from "@/features/channels/components/channel-admin-playlist-panel";

type Props = {
  channelId: string;
  canManage: boolean;
  channelIsActive: boolean;
  sendSocketMessage: (payload: Record<string, unknown>) => boolean;
};

export function ChannelAdminPlayerPanel({ channelId, canManage, channelIsActive, sendSocketMessage }: Props) {
  return (
    <ChannelAdminPlaylistPanel
      channelId={channelId}
      canManage={canManage && channelIsActive}
      sendSocketMessage={sendSocketMessage}
    />
  );
}
