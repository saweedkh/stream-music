"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { WorkspacePage } from "@/components/layout/workspace";
import { useToast } from "@/components/ui/toast-provider";
import { ExploreFiltersBar } from "@/features/discovery/explore-filters";
import { ExploreLiveRail } from "@/features/discovery/explore-live-rail";
import { ExplorePeopleSection } from "@/features/discovery/explore-people-section";
import { ExplorePlaylistsRail } from "@/features/discovery/explore-playlists-rail";
import { ExplorePopularSection } from "@/features/discovery/explore-popular-section";
import { collectExploreChannels, deriveSuggestedUsernames } from "@/features/discovery/explore-utils";
import { useDiscoverableUsers } from "@/features/discovery/hooks/use-discoverable-users";
import { useExploreChannelFollow } from "@/features/discovery/hooks/use-explore-channel-follow";
import { useExploreFeed, type ExploreFilters } from "@/features/discovery/hooks/use-explore-feed";

export function ExplorePage() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [filters, setFilters] = useState<ExploreFilters>({
    q: "",
    lang: "",
    genre: "",
    liveOnly: false,
  });
  const [peopleQuery, setPeopleQuery] = useState("");

  const onFeedError = useCallback(
    (message: string) => {
      showToast(message === "explore.loadFailed" ? t("explore.loadFailed") : message, "error");
    },
    [showToast, t],
  );

  const { feed, loading, refreshing } = useExploreFeed(filters, onFeedError);

  const suggestedUsernames = useMemo(
    () => (feed ? deriveSuggestedUsernames(feed, 6) : []),
    [feed],
  );

  const exploreChannels = useMemo(
    () => (feed ? collectExploreChannels(feed, filters.liveOnly) : []),
    [feed, filters.liveOnly],
  );

  const channelFollow = useExploreChannelFollow(exploreChannels, showToast, {
    followed: t("follow.followed"),
    unfollowed: t("follow.unfollowed"),
    notifyOn: t("follow.notifyOn"),
    notifyOff: t("follow.notifyOff"),
    failed: t("follow.failed"),
  });

  const people = useDiscoverableUsers(
    peopleQuery,
    suggestedUsernames,
    (message) => showToast(message, "error"),
    {
      followed: t("search.global.followed"),
      unfollowed: t("search.global.unfollowed"),
      failed: t("search.global.followFailed"),
    },
    showToast,
  );

  if (loading && !feed) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!feed) return null;

  const sectionLoading = loading || refreshing;

  return (
    <WorkspacePage className="gap-5 sm:gap-6">
      <ExploreFiltersBar filters={filters} onChange={setFilters} refreshing={refreshing} />

      <ExploreLiveRail channels={feed.live_channels} loading={sectionLoading} channelFollow={channelFollow} />

      {!filters.liveOnly ? (
        <>
          <ExplorePopularSection rows={feed.popular_channels} loading={sectionLoading} channelFollow={channelFollow} />
          <ExplorePlaylistsRail playlists={feed.shared_playlists} loading={sectionLoading} />
        </>
      ) : null}

      <ExplorePeopleSection
        query={peopleQuery}
        onQueryChange={setPeopleQuery}
        isSearching={people.isSearching}
        users={people.visibleUsers}
        profiles={people.publicProfiles}
        followState={people.followState}
        followBusy={people.followBusy}
        loading={people.loading}
        onToggleFollow={(username) => void people.toggleFollow(username)}
      />
    </WorkspacePage>
  );
}
