"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Search, Star, Trash2 } from "lucide-react";
import { useTrackLibrary } from "@/features/tracks/hooks/use-track-library";
import {
  fromBackendVisibility,
  toBackendVisibility,
  TRACK_ACCESS_LABEL_KEYS,
  type TrackAccess,
} from "@/features/tracks/model/track-access";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FavoriteStarButton } from "@/shared/ui/favorite-star-button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import type { TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type TrackLibraryPanelProps = {
  refreshSignal?: number;
};

export function TrackLibraryPanel({ refreshSignal = 0 }: TrackLibraryPanelProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const lib = useTrackLibrary((key) => showToast(t(key as "tracks.loadFailed"), "error"));
  const { refresh } = lib;

  useEffect(() => {
    if (refreshSignal > 0) void refresh();
  }, [refreshSignal, refresh]);

  const [editTrack, setEditTrack] = useState<TrackSummary | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [editAccess, setEditAccess] = useState<TrackAccess>("public");
  const [editBusy, setEditBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TrackSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openEdit(track: TrackSummary) {
    setEditTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist ?? "");
    setEditAlbum(track.album ?? "");
    setEditAccess(fromBackendVisibility(track.visibility));
  }

  async function saveEdit() {
    if (!editTrack) return;
    setEditBusy(true);
    try {
      await lib.saveTrack(editTrack.id, {
        title: editTitle,
        artist: editArtist,
        album: editAlbum,
        access: editAccess,
      });
      showToast(t("tracks.updated"), "success");
      setEditTrack(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("tracks.updateFailed"), "error");
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await lib.removeTrack(deleteTarget.id);
      showToast(t("tracks.deleted"), "success");
      setDeleteTarget(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("tracks.deleteFailed"), "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <Card className="border-border/60 bg-card/50 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("tracks.musicLibraryTitle")}</CardTitle>
              <CardDescription>{t("tracks.musicLibraryDescription", { count: String(lib.total) })}</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant={lib.favoritesOnly ? "default" : "outline"}
              className={cn("h-8 gap-1.5", lib.favoritesOnly && "bg-amber-500/90 hover:bg-amber-500")}
              onClick={() => lib.setFavoritesOnly(!lib.favoritesOnly)}
            >
              <Star className={cn("h-3.5 w-3.5", lib.favoritesOnly && "fill-current")} aria-hidden />
              {lib.favoritesOnly ? t("favorites.showAll") : t("favorites.showOnly")}
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="ps-9"
              placeholder={t("tracks.searchPlaceholder")}
              value={lib.search}
              onChange={(e) => lib.setSearch(e.target.value)}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("tracks.filterGenre")}</Label>
              <Select value={lib.genre} onChange={(e) => lib.setGenre(e.target.value)}>
                <option value="">{t("tracks.filterAll")}</option>
                {lib.facetGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("tracks.filterAlbum")}</Label>
              <Select value={lib.album} onChange={(e) => lib.setAlbum(e.target.value)}>
                <option value="">{t("tracks.filterAll")}</option>
                {lib.facetAlbums.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {lib.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : lib.tracks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-14 text-center text-sm text-muted-foreground">
              {lib.search || lib.genre || lib.album || lib.favoritesOnly ? t("tracks.emptyFiltered") : t("tracks.empty")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {lib.tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-muted/25 sm:gap-3 sm:px-3"
                >
                  <FavoriteStarButton
                    favorited={Boolean(track.is_favorited)}
                    busy={lib.favoriteBusyId === track.id}
                    label={track.is_favorited ? t("favorites.remove") : t("favorites.add")}
                    onToggle={() => void lib.toggleFavorite(track.id, !track.is_favorited)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[track.artist, track.album].filter(Boolean).join(" · ") || t("tracks.noMeta")}
                    </p>
                  </div>
                  <Badge variant={fromBackendVisibility(track.visibility) === "public" ? "success" : "secondary"} className="hidden shrink-0 text-[10px] sm:inline-flex">
                    {t(TRACK_ACCESS_LABEL_KEYS[fromBackendVisibility(track.visibility)])}
                  </Badge>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={t("tracks.edit")} onClick={() => openEdit(track)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-rose-500 hover:text-rose-600"
                      aria-label={t("tracks.delete")}
                      onClick={() => setDeleteTarget(track)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {lib.total > lib.pageSize ? (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-4">
              <p className="text-xs text-muted-foreground">
                {t("tracks.pageInfo", {
                  from: String(lib.total === 0 ? 0 : (lib.currentPage - 1) * lib.pageSize + 1),
                  to: String(Math.min(lib.currentPage * lib.pageSize, lib.total)),
                  total: String(lib.total),
                })}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={lib.currentPage <= 1 || lib.loading}
                  onClick={() => lib.goToPage(lib.currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <span className="min-w-[4rem] text-center text-xs tabular-nums text-muted-foreground">
                  {lib.currentPage} / {lib.pageCount}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={lib.currentPage >= lib.pageCount || lib.loading}
                  onClick={() => lib.goToPage(lib.currentPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editTrack !== null} onOpenChange={(open) => !open && setEditTrack(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tracks.editTitle")}</DialogTitle>
            <DialogDescription>{t("tracks.editDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-track-title">{t("tracks.title")}</Label>
              <Input id="edit-track-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-track-artist">{t("tracks.artist")}</Label>
              <Input id="edit-track-artist" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-track-album">{t("tracks.album")}</Label>
              <Input id="edit-track-album" value={editAlbum} onChange={(e) => setEditAlbum(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-track-access">{t("tracks.accessLabel")}</Label>
              <Select id="edit-track-access" value={editAccess} onChange={(e) => setEditAccess(e.target.value as TrackAccess)}>
                <option value="public">{t("tracks.accessPublic")}</option>
                <option value="private">{t("tracks.accessPrivate")}</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTrack(null)}>
              {t("tracks.cancel")}
            </Button>
            <Button disabled={editBusy || !editTitle.trim()} onClick={() => void saveEdit()}>
              {editBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("tracks.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tracks.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("tracks.deleteDescription", { title: deleteTarget?.title ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("tracks.cancel")}
            </Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("tracks.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
