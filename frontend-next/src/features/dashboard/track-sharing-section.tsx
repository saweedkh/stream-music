"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ChannelSummary, TrackSharePermission, TrackSummary } from "@/lib/api";

type Props = {
  tracks: TrackSummary[];
  users: Array<{ id: number; username: string }>;
  channels: ChannelSummary[];
  trackShares: TrackSharePermission[];
  shareTrackId: string;
  shareUserId: string;
  shareChannelId: string;
  onShareTrackIdChange: (value: string) => void;
  onShareUserIdChange: (value: string) => void;
  onShareChannelIdChange: (value: string) => void;
  onAddShare: () => void;
  onRemoveShare: (shareId: number) => void;
};

export function TrackSharingSection(props: Props) {
  const {
    tracks,
    users,
    channels,
    trackShares,
    shareTrackId,
    shareUserId,
    shareChannelId,
    onShareTrackIdChange,
    onShareUserIdChange,
    onShareChannelIdChange,
    onAddShare,
    onRemoveShare,
  } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Share Permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Select track</Label>
          <Select value={shareTrackId} valid={Boolean(shareTrackId)} onChange={(e) => onShareTrackIdChange(e.target.value)}>
            <option value="">Select track</option>
            {tracks.map((track) => (
              <option key={track.id} value={String(track.id)}>
                {track.title} (#{track.id})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Share with user (optional)</Label>
          <Select value={shareUserId} valid={Boolean(shareUserId)} onChange={(e) => onShareUserIdChange(e.target.value)}>
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={String(user.id)}>
                {user.username}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Share with channel (optional)</Label>
          <Select value={shareChannelId} valid={Boolean(shareChannelId)} onChange={(e) => onShareChannelIdChange(e.target.value)}>
            <option value="">Select channel</option>
            {channels.map((channel) => (
              <option key={channel.id} value={String(channel.id)}>
                {channel.name}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={onAddShare}>Add Share Permission</Button>
        <div className="space-y-1 text-xs text-slate-300">
          {trackShares.map((share) => (
            <div key={share.id} className="flex items-center gap-2">
              <p className="flex-1">
                {share.username ? `user: ${share.username}` : ""} {share.channel_name ? `channel: ${share.channel_name}` : ""}
              </p>
              <Button variant="danger" className="px-2 py-1" onClick={() => onRemoveShare(share.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
