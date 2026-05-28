"use client";

import Link from "next/link";
import { ListMusic } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { WorkspaceEmpty, WorkspaceSection } from "@/components/layout/workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExploreHorizontalRail } from "@/features/discovery/explore-horizontal-rail";
import type { ExploreFeed } from "@/lib/api";

function PlaylistRailSkeleton() {
  return (
    <ExploreHorizontalRail>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[8.5rem] w-[min(100%,16rem)] shrink-0 snap-start rounded-2xl" />
      ))}
    </ExploreHorizontalRail>
  );
}

type ExplorePlaylistsRailProps = {
  playlists: ExploreFeed["shared_playlists"];
  loading?: boolean;
};

export function ExplorePlaylistsRail({ playlists, loading }: ExplorePlaylistsRailProps) {
  const { t } = useTranslations();

  return (
    <WorkspaceSection title={t("explore.sharedPlaylists")}>
      {loading ? (
        <PlaylistRailSkeleton />
      ) : playlists.length === 0 ? (
        <WorkspaceEmpty icon={ListMusic} title={t("explore.noShared")} />
      ) : (
        <ExploreHorizontalRail>
          {playlists.map((sp) => (
            <article
              key={sp.token}
              className="flex w-[min(100%,16rem)] shrink-0 snap-start flex-col rounded-2xl border border-[var(--workspace-divider)] bg-[var(--workspace-list)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/12 text-brand">
                <ListMusic className="size-5" aria-hidden />
              </div>
              <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{sp.playlist.name}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                <span dir="ltr">@{sp.owner_username}</span>
                <span className="opacity-60"> · </span>
                {t("explore.trackCount", { count: sp.item_count })}
              </p>
              <Button size="sm" asChild className="mt-auto h-9 w-full rounded-xl">
                <Link href={sp.share_url}>{t("explore.openPlaylist")}</Link>
              </Button>
            </article>
          ))}
        </ExploreHorizontalRail>
      )}
    </WorkspaceSection>
  );
}
