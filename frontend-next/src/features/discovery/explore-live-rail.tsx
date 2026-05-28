"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { WorkspaceEmpty, WorkspaceSection } from "@/components/layout/workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { ExploreHorizontalRail } from "@/features/discovery/explore-horizontal-rail";
import { ExploreRoomCard } from "@/features/discovery/explore-room-card";
import type { useExploreChannelFollow } from "@/features/discovery/hooks/use-explore-channel-follow";
import type { ChannelSummary } from "@/lib/api";

type ChannelFollowApi = Pick<ReturnType<typeof useExploreChannelFollow>, "forChannel" | "loading">;

function LiveRailSkeleton() {
  return (
    <ExploreHorizontalRail>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[9.5rem] w-[14.5rem] shrink-0 snap-start rounded-2xl" />
      ))}
    </ExploreHorizontalRail>
  );
}

type ExploreLiveRailProps = {
  channels: ChannelSummary[];
  loading?: boolean;
  channelFollow?: ChannelFollowApi;
};

export function ExploreLiveRail({ channels, loading, channelFollow }: ExploreLiveRailProps) {
  const { t } = useTranslations();

  return (
    <WorkspaceSection title={t("explore.liveChannels")}>
      {loading ? (
        <LiveRailSkeleton />
      ) : channels.length === 0 ? (
        <WorkspaceEmpty icon={Radio} title={t("explore.noLive")} />
      ) : (
        <ExploreHorizontalRail>
          {channels.map((ch) => (
            <ExploreRoomCard
              key={ch.id}
              channel={ch}
              variant="rail"
              follow={channelFollow?.forChannel(ch) ?? null}
              followLoading={channelFollow?.loading}
            />
          ))}
        </ExploreHorizontalRail>
      )}
    </WorkspaceSection>
  );
}
