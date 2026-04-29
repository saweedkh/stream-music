"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ChannelSummary } from "@/lib/api";

type Props = {
  channels: ChannelSummary[];
  channelName: string;
  channelPrivacy: ChannelSummary["privacy"];
  memberLimit: string;
  errors: { channelName?: string; memberLimit?: string };
  onChannelNameChange: (value: string) => void;
  onChannelPrivacyChange: (value: ChannelSummary["privacy"]) => void;
  onMemberLimitChange: (value: string) => void;
  onCreateChannel: () => void;
};

export function ChannelManagementSection(props: Props) {
  const {
    channels,
    channelName,
    channelPrivacy,
    memberLimit,
    errors,
    onChannelNameChange,
    onChannelPrivacyChange,
    onMemberLimitChange,
    onCreateChannel,
  } = props;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Your Channels</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {channels.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}
          {channels.length === 0 ? <p className="text-sm text-slate-400">No channels yet. Create your first one.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Channel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Channel name</Label>
            <Input value={channelName} aria-invalid={Boolean(errors.channelName)} valid={Boolean(channelName.trim())} onChange={(e) => onChannelNameChange(e.target.value)} />
            {errors.channelName ? <p className="text-xs text-rose-400">{errors.channelName}</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Privacy</Label>
            <Select value={channelPrivacy} valid={Boolean(channelPrivacy)} onChange={(e) => onChannelPrivacyChange(e.target.value as ChannelSummary["privacy"])}>
              <option value="public">public</option>
              <option value="private">private</option>
              <option value="unlisted">unlisted</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Members limit</Label>
            <Input value={memberLimit} aria-invalid={Boolean(errors.memberLimit)} valid={Boolean(memberLimit.trim() && Number(memberLimit) > 0)} onChange={(e) => onMemberLimitChange(e.target.value)} />
            {errors.memberLimit ? <p className="text-xs text-rose-400">{errors.memberLimit}</p> : null}
          </div>
          <Button className="w-full" onClick={onCreateChannel}>
            Create
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelCard({ channel }: { channel: ChannelSummary }) {
  const [isOnline, setIsOnline] = useState(channel.is_playing ?? false);
  const handleMessage = useCallback((payload: unknown) => {
    const data = (payload ?? {}) as { type?: string; action?: string };
    const action = (data.action ?? data.type ?? "").toLowerCase();
    if (action === "play") setIsOnline(true);
    if (action === "pause") setIsOnline(false);
  }, []);
  const { socketState } = useReconnectingChannelSocket({ channelId: channel.id, onMessage: handleMessage });

  useEffect(() => {
    setIsOnline(channel.is_playing ?? false);
  }, [channel.is_playing]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{channel.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "success" : "warning"}>{isOnline ? "online" : "offline"}</Badge>
          <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
          <Badge variant={channel.privacy === "public" ? "success" : "warning"}>{channel.privacy}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-slate-400">Members limit: {channel.member_limit ?? "-"}</p>
        <Link href={`/channel/${channel.id}`}>
          <Button className="w-full">Open channel</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
