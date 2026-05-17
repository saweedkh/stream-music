"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useTranslations } from "@/components/providers/locale-provider";
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
  const { t } = useTranslations();
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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("sharing.cardTitle")}</CardTitle>
        <CardDescription>{t("sharing.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t("sharing.selectTrack")}</Label>
          <Select value={shareTrackId} valid={Boolean(shareTrackId)} onChange={(e) => onShareTrackIdChange(e.target.value)}>
            <option value="">{t("sharing.selectTrackPlaceholder")}</option>
            {tracks.map((track) => (
              <option key={track.id} value={String(track.id)}>
                {track.title} (#{track.id})
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("sharing.shareWithUser")}</Label>
            <Select value={shareUserId} valid={Boolean(shareUserId)} onChange={(e) => onShareUserIdChange(e.target.value)}>
              <option value="">{t("sharing.selectUserPlaceholder")}</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.username}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("sharing.shareWithChannel")}</Label>
            <Select value={shareChannelId} valid={Boolean(shareChannelId)} onChange={(e) => onShareChannelIdChange(e.target.value)}>
              <option value="">{t("sharing.selectChannelPlaceholder")}</option>
              {channels.map((channel) => (
                <option key={channel.id} value={String(channel.id)}>
                  {channel.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button onClick={onAddShare} className="w-full sm:w-auto">
          {t("sharing.addPermission")}
        </Button>
        {trackShares.length > 0 ? (
          <ul className="space-y-2 border-t border-border/60 pt-4">
            {trackShares.map((share) => (
              <li
                key={share.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/25 px-3 py-2"
              >
                <p className="min-w-0 flex-1 text-sm">
                  {share.username ? t("sharing.userTarget", { name: share.username }) : null}
                  {share.channel_name ? t("sharing.channelTarget", { name: share.channel_name }) : null}
                </p>
                <Button variant="destructive" size="sm" onClick={() => onRemoveShare(share.id)}>
                  {t("sharing.remove")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
