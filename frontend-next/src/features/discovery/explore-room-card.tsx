"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChannelAvatar } from "@/features/dashboard/channels/channel-shared";
import { ExploreChannelFollowControls } from "@/features/discovery/explore-channel-follow-controls";
import { exploreJoinHref } from "@/features/discovery/explore-utils";
import type { ExploreChannelFollowActions } from "@/features/discovery/hooks/use-explore-channel-follow";
import type { ChannelSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type ExploreRoomCardProps = {
  channel: ChannelSummary;
  variant?: "rail" | "row";
  eventCount?: number;
  showRecap?: boolean;
  follow?: ExploreChannelFollowActions | null;
  followLoading?: boolean;
};

export function ExploreRoomCard({
  channel,
  variant = "rail",
  eventCount,
  showRecap,
  follow,
  followLoading,
}: ExploreRoomCardProps) {
  const { t } = useTranslations();
  const isLive = channel.is_playing === true;
  const joinHref = exploreJoinHref(channel);
  const owner = channel.owner_username?.trim();

  if (variant === "row") {
    return (
      <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--workspace-divider)] bg-[var(--workspace-list)] px-3 py-2.5 sm:px-4">
        <ChannelAvatar channel={channel} isLive={isLive} className="size-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={joinHref} className="truncate text-sm font-semibold text-foreground hover:text-brand">
              {channel.name}
            </Link>
            {isLive ? <Badge variant="success">{t("channels.live")}</Badge> : null}
            {eventCount != null ? (
              <Badge variant="secondary" className="text-[10px]">
                {t("explore.eventCount", { count: eventCount })}
              </Badge>
            ) : null}
          </div>
          {owner ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
              @{owner}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {showRecap ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/party/${channel.id}`}>{t("explore.recap")}</Link>
            </Button>
          ) : null}
          {follow ? <ExploreChannelFollowControls follow={follow} layout="row" loading={followLoading} /> : null}
          <Button size="sm" asChild className={isLive ? "bg-brand text-brand-foreground hover:bg-brand-strong" : undefined}>
            <Link href={joinHref}>{isLive ? t("explore.join") : t("dashboard.following.open")}</Link>
          </Button>
        </div>
      </li>
    );
  }

  return (
    <article
      className={cn(
        "flex w-[min(100%,14.5rem)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[var(--workspace-divider)] bg-[var(--workspace-list)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md",
        isLive && "border-brand/40 shadow-[0_0_0_1px_rgba(34,197,94,0.2)]",
      )}
    >
      <div className="relative flex items-start gap-3 p-3.5">
        <ChannelAvatar channel={channel} isLive={isLive} className="size-12" />
        <div className="min-w-0 flex-1 pt-0.5">
          <Link href={joinHref} className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-brand">
            {channel.name}
          </Link>
          {owner ? (
            <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">
              @{owner}
            </p>
          ) : null}
        </div>
        {isLive ? (
          <Badge variant="success" className="shrink-0 gap-1">
            <Radio className="size-3" aria-hidden />
            {t("channels.live")}
          </Badge>
        ) : null}
      </div>
      <div className="mt-auto flex gap-2 border-t border-[var(--workspace-divider)] p-3 pt-2.5">
        <Button
          size="sm"
          asChild
          className={cn("h-9 min-w-0 flex-1 rounded-xl", isLive && "bg-brand text-brand-foreground hover:bg-brand-strong")}
        >
          <Link href={joinHref}>{t("explore.join")}</Link>
        </Button>
        {follow ? <ExploreChannelFollowControls follow={follow} layout="rail" loading={followLoading} /> : null}
      </div>
    </article>
  );
}
