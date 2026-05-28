"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { WorkspaceEmpty, WorkspaceList, WorkspaceSection } from "@/components/layout/workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { ExploreRoomCard } from "@/features/discovery/components/explore-room-card";
import type { useExploreChannelFollow } from "@/features/discovery/hooks/use-explore-channel-follow";
import type { ExploreFeed } from "@/lib/api";

type ChannelFollowApi = Pick<ReturnType<typeof useExploreChannelFollow>, "forChannel" | "loading">;

function PopularSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="h-[4.25rem] w-full rounded-xl" />
        </li>
      ))}
    </ul>
  );
}

type ExplorePopularSectionProps = {
  rows: ExploreFeed["popular_channels"];
  loading?: boolean;
  channelFollow?: ChannelFollowApi;
};

export function ExplorePopularSection({ rows, loading, channelFollow }: ExplorePopularSectionProps) {
  const { t } = useTranslations();

  return (
    <WorkspaceSection title={t("explore.popularWeek")}>
      {loading ? (
        <PopularSkeleton />
      ) : rows.length === 0 ? (
        <WorkspaceEmpty icon={TrendingUp} title={t("explore.noPopular")} />
      ) : (
        <WorkspaceList className="gap-2">
          {rows.map((row) => (
            <ExploreRoomCard
              key={row.channel.id}
              channel={row.channel}
              variant="row"
              eventCount={row.event_count}
              showRecap
              follow={channelFollow?.forChannel(row.channel) ?? null}
              followLoading={channelFollow?.loading}
            />
          ))}
        </WorkspaceList>
      )}
    </WorkspaceSection>
  );
}
