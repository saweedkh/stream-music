"use client";

import { Bell, BellOff, Loader2, UserMinus, UserPlus } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import type { ExploreChannelFollowActions } from "@/features/discovery/hooks/use-explore-channel-follow";
import { cn } from "@/lib/utils";

type ExploreChannelFollowControlsProps = {
  follow: ExploreChannelFollowActions;
  layout: "rail" | "row";
  loading?: boolean;
};

export function ExploreChannelFollowControls({ follow, layout, loading }: ExploreChannelFollowControlsProps) {
  const { t } = useTranslations();

  if (loading) {
    return (
      <Button type="button" size="sm" variant="secondary" disabled className={layout === "rail" ? "size-9 shrink-0 px-0" : undefined}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </Button>
    );
  }

  if (layout === "rail") {
    return (
      <Button
        type="button"
        size="sm"
        variant={follow.following ? "secondary" : "outline"}
        disabled={follow.busy}
        className="size-9 shrink-0 px-0"
        title={follow.following ? t("follow.following") : t("follow.follow")}
        onClick={follow.onToggleFollow}
      >
        {follow.busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : follow.following ? (
          <UserMinus className="size-4" aria-hidden />
        ) : (
          <UserPlus className="size-4" aria-hidden />
        )}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={follow.following ? "secondary" : "outline"}
        disabled={follow.busy}
        className={cn("gap-1.5", !follow.following && "border-brand/30")}
        onClick={follow.onToggleFollow}
      >
        {follow.busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : follow.following ? (
          <UserMinus className="size-4" aria-hidden />
        ) : (
          <UserPlus className="size-4" aria-hidden />
        )}
        {follow.following ? t("follow.following") : t("follow.follow")}
      </Button>
      {follow.following ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={follow.busy}
          title={follow.notifyLive ? t("follow.liveOn") : t("follow.liveOff")}
          onClick={follow.onToggleNotify}
        >
          {follow.notifyLive ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
        </Button>
      ) : null}
    </>
  );
}
