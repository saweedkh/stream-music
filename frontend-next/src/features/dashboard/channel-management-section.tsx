"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";
import { reopenChannel, type ChannelSummary } from "@/lib/api";
import { useToast } from "@/components/ui/toast-provider";

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
  currentUserId: number | null;
  onChannelsRefresh: () => void | Promise<void>;
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
    currentUserId,
    onChannelsRefresh,
  } = props;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Your channels</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[min(420px,55vh)] px-5 pb-5 pr-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  currentUserId={currentUserId}
                  onChannelsRefresh={onChannelsRefresh}
                />
              ))}
            </div>
            {channels.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">No channels yet — create one on the right.</p> : null}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/15 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">New channel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dash-new-channel-name">Name</Label>
            <Input
              id="dash-new-channel-name"
              value={channelName}
              aria-invalid={Boolean(errors.channelName)}
              valid={Boolean(channelName.trim())}
              onChange={(e) => onChannelNameChange(e.target.value)}
              placeholder="e.g. Friday Night Vinyl"
            />
            {errors.channelName ? <p className="text-xs text-red-400">{errors.channelName}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dash-new-channel-privacy">Privacy</Label>
            <Select
              id="dash-new-channel-privacy"
              value={channelPrivacy}
              valid={Boolean(channelPrivacy)}
              onChange={(e) => onChannelPrivacyChange(e.target.value as ChannelSummary["privacy"])}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dash-new-channel-limit">Member limit</Label>
            <Input
              id="dash-new-channel-limit"
              type="number"
              inputMode="numeric"
              value={memberLimit}
              aria-invalid={Boolean(errors.memberLimit)}
              valid={Boolean(memberLimit.trim() && Number(memberLimit) > 0)}
              onChange={(e) => onMemberLimitChange(e.target.value)}
            />
            {errors.memberLimit ? <p className="text-xs text-red-400">{errors.memberLimit}</p> : null}
          </div>
          <Separator />
          <Button type="button" className="w-full" onClick={onCreateChannel}>
            Create channel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelCard({
  channel,
  currentUserId,
  onChannelsRefresh,
}: {
  channel: ChannelSummary;
  currentUserId: number | null;
  onChannelsRefresh: () => void | Promise<void>;
}) {
  const { showToast } = useToast();
  const isOwner = channel.owner != null && currentUserId != null && Number(channel.owner) === Number(currentUserId);
  const isActive = channel.is_active !== false;
  const [isOnline, setIsOnline] = useState(channel.is_playing ?? false);
  const handleMessage = useCallback((payload: unknown) => {
    const data = (payload ?? {}) as { type?: string; action?: string };
    const action = (data.action ?? data.type ?? "").toLowerCase();
    if (action === "play") setIsOnline(true);
    if (action === "pause") setIsOnline(false);
  }, []);
  const { socketState } = useReconnectingChannelSocket({
    channelId: channel.id,
    onMessage: handleMessage,
    enabled: isActive,
  });

  useEffect(() => {
    setIsOnline(channel.is_playing ?? false);
  }, [channel.is_playing]);

  return (
    <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-md">
      <CardHeader className="space-y-3 border-0 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base">{channel.name}</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {!isActive ? <Badge variant="warning">Closed</Badge> : null}
            <Badge variant={isOnline ? "success" : "secondary"}>{isOnline ? "Live" : "Idle"}</Badge>
            {isActive ? (
              <Badge variant={socketState === "connected" ? "success" : "warning"} className="text-[10px]">
                {socketState}
              </Badge>
            ) : null}
            <Badge variant="outline" className="capitalize">
              {channel.privacy}
            </Badge>
            {channel.membership_is_active === false ? (
              <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                Left — tap Open to reconnect
              </Badge>
            ) : null}
            {channel.join_requires_approval ? (
              <Badge variant="warning" className="text-[10px]" title="New members need moderator approval">
                Approval required
              </Badge>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-zinc-500">Cap: {channel.member_limit ?? "—"}</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {!isActive && !isOwner ? (
          <Button variant="secondary" className="w-full" disabled type="button">
            Closed
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" asChild>
            <Link href={`/channel/${channel.id}`}>
              {!isActive && isOwner ? "Manage" : channel.membership_is_active === false ? "Reconnect" : "Open room"}
            </Link>
          </Button>
        )}
        {!isActive && isOwner ? (
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              void (async () => {
                try {
                  await reopenChannel(String(channel.id));
                  showToast("Channel reopened.", "success");
                  await onChannelsRefresh();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Reopen failed.", "error");
                }
              })();
            }}
          >
            Reopen
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
