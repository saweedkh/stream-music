"use client";

import type { ComponentProps } from "react";
import { ChannelAdminPanel } from "@/features/channels/channel-admin-panel";

type Props = ComponentProps<typeof ChannelAdminPanel>;

export function ChannelAdminSettingsPanel(props: Props) {
  return <ChannelAdminPanel {...props} embedded />;
}
