"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListMusic, Music } from "lucide-react";
import { FavoriteStarButton } from "@/components/ui/favorite-star-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  listPlaylists,
  listTracks,
  normalizeTrackList,
  setPlaylistFavorite,
  setTrackFavorite,
  type PlaylistSummary,
  type TrackSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ProfileFavoritesPanelProps = {
  kind: "tracks" | "playlists";
};

const TRACK_VISIBILITY_KEYS: Record<TrackSummary["visibility"], MessageKey> = {
  private: "tracks.visPrivate",
  shared_with_users: "tracks.visSharedUsers",
  shared_with_channels: "tracks.visSharedChannels",
  public_lan: "tracks.visPublicLan",
};

const visibilityTone: Record<TrackSummary["visibility"], "default" | "success" | "warning"> = {
  private: "default",
  shared_with_users: "warning",
  shared_with_channels: "warning",
  public_lan: "success",
};

export function ProfileFavoritesPanel({ kind }: ProfileFavoritesPanelProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === "tracks") {
        const data = await listTracks({ favorited: true });
        setTracks(normalizeTrackList(data));
      } else {
        const data = await listPlaylists(undefined, { favorited: true });
        setPlaylists(data);
      }
    } catch {
      showToast(t("dashboard.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [kind, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTrackFavoriteToggle(trackId: number, next: boolean) {
    setBusyId(trackId);
    try {
      await setTrackFavorite(trackId, next);
      if (!next) {
        setTracks((prev) => prev.filter((tr) => tr.id !== trackId));
      }
      showToast(t("favorites.updated"), "success");
    } catch {
      showToast(t("favorites.updateFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePlaylistFavoriteToggle(playlistId: number, next: boolean) {
    setBusyId(playlistId);
    try {
      await setPlaylistFavorite(playlistId, next);
      if (!next) {
        setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
      }
      showToast(t("favorites.updated"), "success");
    } catch {
      showToast(t("favorites.updateFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const isTracks = kind === "tracks";
  const count = isTracks ? tracks.length : playlists.length;
  const emptyKey = isTracks ? "profile.favoriteTracksEmpty" : "profile.favoritePlaylistsEmpty";
  const libraryHref = isTracks ? "/dashboard?tab=tracks" : "/dashboard?tab=playlists";
  const libraryLabelKey = isTracks ? "profile.openTrackLibrary" : "profile.openPlaylistLibrary";
  const titleKey = isTracks ? "profile.favoriteTracksTitle" : "profile.favoritePlaylistsTitle";
  const descriptionKey = isTracks ? "profile.favoriteTracksDescription" : "profile.favoritePlaylistsDescription";
  const Icon = isTracks ? Music : ListMusic;

  return (
    <Card className="border-border/60 bg-card/50 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-lg">{t(titleKey)}</CardTitle>
            <CardDescription>{t(descriptionKey)}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <div className="space-y-4 rounded-lg border border-dashed border-border/70 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
            <Button asChild variant="secondary" size="sm">
              <Link href={libraryHref}>{t(libraryLabelKey)}</Link>
            </Button>
          </div>
        ) : (
          <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pe-1">
            {isTracks
              ? tracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border/60 hover:bg-muted/30"
                  >
                    <FavoriteStarButton
                      favorited
                      busy={busyId === track.id}
                      label={t("favorites.remove")}
                      onToggle={() => void handleTrackFavoriteToggle(track.id, false)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{track.title}</p>
                      <p className="text-xs text-muted-foreground">{t("tracks.trackId", { id: track.id })}</p>
                    </div>
                    <Badge variant={visibilityTone[track.visibility]} className="shrink-0 text-[10px]">
                      {t(TRACK_VISIBILITY_KEYS[track.visibility])}
                    </Badge>
                  </li>
                ))
              : playlists.map((pl) => (
                  <li
                    key={pl.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors",
                      "hover:border-border/60 hover:bg-muted/30",
                    )}
                  >
                    <FavoriteStarButton
                      favorited
                      busy={busyId === pl.id}
                      label={t("favorites.remove")}
                      onToggle={() => void handlePlaylistFavoriteToggle(pl.id, false)}
                    />
                    <ListMusic className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{pl.name}</p>
                  </li>
                ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
