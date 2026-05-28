"use client";

import { ChannelTrackSuggestions } from "@/features/channels/components/channel-track-suggestions";

type Props = {
  channelId: string;
  canManage: boolean;
};

export function ChannelAdminSuggestionsPanel({ channelId, canManage }: Props) {
  return <ChannelTrackSuggestions channelId={channelId} canManage={canManage} variant="admin" embedded />;
}
