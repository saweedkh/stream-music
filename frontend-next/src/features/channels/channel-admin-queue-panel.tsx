"use client";

import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";

type Props = {
  channelId: string;
  readOnly?: boolean;
};

export function ChannelAdminQueuePanel({ channelId, readOnly }: Props) {
  return <ChannelQueuePanel channelId={channelId} readOnly={readOnly} variant="admin" embedded />;
}
