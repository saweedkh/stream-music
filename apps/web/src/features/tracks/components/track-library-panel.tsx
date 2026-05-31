"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Music2, Search, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import { TrackEditDialog } from "@/features/tracks/components/track-edit-dialog";
import { TrackLibraryRow } from "@/features/tracks/components/track-library-row";
import { useTrackLibrary } from "@/features/tracks/hooks/use-track-library";
import { fromBackendVisibility, type TrackAccess } from "@/features/tracks/model/track-access";
import { useIsLgUp } from "@/shared/hooks/use-media-query";
import { WorkspaceChip, WorkspaceChipGroup, WorkspaceEmpty } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import type { TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type TrackLibraryPanelProps = {
  refreshSignal?: number;
};

export function TrackLibraryPanel({ refreshSignal = 0 }: TrackLibraryPanelProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const onLoadError = useCallback(() => {
    showToast(t("tracks.loadFailed"), "error");
  }, [showToast, t]);
  const lib = useTrackLibrary(onLoadError);
  const { refresh } = lib;
  const isLgUp = useIsLgUp();

  useEffect(() => {
    if (refreshSignal > 0) void refresh();
  }, [refreshSignal, refresh]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editTrack, setEditTrack] = useState<TrackSummary | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [editAccess, setEditAccess] = useState<TrackAccess>("public");
  const [editBusy, setEditBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TrackSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const activeFilterCount = [lib.genre, lib.album, lib.favoritesOnly].filter(Boolean).length;

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

  const filterFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("tracks.filterGenre")}</Label>
        <Select value={lib.genre} onChange={(e) => lib.setGenre(e.target.value)}>
          <option value="">{t("tracks.filterAll")}</option>
          {lib.facetGenres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("tracks.filterAlbum")}</Label>
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
  );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <header className="border-b border-border/50 bg-gradient-to-r from-brand/[0.07] via-transparent to-violet-500/[0.05] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand shadow-inner">
                <Music2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold tracking-tight">{t("tracks.musicLibraryTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("tracks.musicLibraryDescription", { count: String(lib.total) })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-3 border-b border-border/40 px-4 py-3 sm:px-5">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="h-10 bg-background/60 ps-9"
                placeholder={t("tracks.searchPlaceholder")}
                value={lib.search}
                onChange={(e) => lib.setSearch(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant={filtersOpen || activeFilterCount > 0 ? "secondary" : "outline"}
              size="icon"
              className="relative h-10 w-10 shrink-0 sm:hidden"
              aria-label={t("tracks.filters")}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {activeFilterCount > 0 ? (
                <span className="absolute -end-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>

          <WorkspaceChipGroup>
            <WorkspaceChip selected={lib.favoritesOnly} onClick={() => lib.setFavoritesOnly(!lib.favoritesOnly)}>
              <span className="inline-flex items-center gap-1.5">
                <Star className={cn("size-3.5", lib.favoritesOnly && "fill-current")} aria-hidden />
                {lib.favoritesOnly ? t("favorites.showAll") : t("favorites.showOnly")}
              </span>
            </WorkspaceChip>
            {lib.genre ? (
              <WorkspaceChip selected onClick={() => lib.setGenre("")}>
                {lib.genre} ×
              </WorkspaceChip>
            ) : null}
            {lib.album ? (
              <WorkspaceChip selected onClick={() => lib.setAlbum("")}>
                {lib.album} ×
              </WorkspaceChip>
            ) : null}
          </WorkspaceChipGroup>

          <div className={cn("grid gap-3 sm:grid-cols-2", !filtersOpen && "hidden sm:grid")}>{filterFields}</div>
        </div>

        <div className="px-1 py-2 sm:px-2">
          {lib.loading ? (
            <div className="space-y-2 px-2 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[4.25rem] w-full rounded-xl" />
              ))}
            </div>
          ) : lib.tracks.length === 0 ? (
            <WorkspaceEmpty icon={Music2} title={lib.search || lib.genre || lib.album || lib.favoritesOnly ? undefined : t("tracks.empty")}>
              {lib.search || lib.genre || lib.album || lib.favoritesOnly ? t("tracks.emptyFiltered") : null}
            </WorkspaceEmpty>
          ) : (
            <ul className="divide-y divide-border/40">
              {lib.tracks.map((track) => (
                <TrackLibraryRow
                  key={track.id}
                  track={track}
                  favoriteBusy={lib.favoriteBusyId === track.id}
                  onToggleFavorite={() => void lib.toggleFavorite(track.id, !track.is_favorited)}
                  onEdit={() => openEdit(track)}
                  onDelete={() => setDeleteTarget(track)}
                />
              ))}
            </ul>
          )}
        </div>

        {lib.total > lib.pageSize ? (
          <footer className="flex items-center justify-between gap-3 border-t border-border/50 bg-muted/15 px-4 py-3 sm:px-5">
            <p className="text-xs text-muted-foreground">
              {t("tracks.pageInfo", {
                from: String(lib.total === 0 ? 0 : (lib.currentPage - 1) * lib.pageSize + 1),
                to: String(Math.min(lib.currentPage * lib.pageSize, lib.total)),
                total: String(lib.total),
              })}
            </p>
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                disabled={lib.currentPage <= 1 || lib.loading}
                onClick={() => lib.goToPage(lib.currentPage - 1)}
                aria-label={t("tracks.prevPage")}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <span className="min-w-[4.5rem] px-1 text-center text-xs font-medium tabular-nums text-muted-foreground">
                {lib.currentPage} / {lib.pageCount}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                disabled={lib.currentPage >= lib.pageCount || lib.loading}
                onClick={() => lib.goToPage(lib.currentPage + 1)}
                aria-label={t("tracks.nextPage")}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </footer>
        ) : null}
      </section>

      <TrackEditDialog
        track={editTrack}
        title={editTitle}
        artist={editArtist}
        album={editAlbum}
        access={editAccess}
        busy={editBusy}
        onTitleChange={setEditTitle}
        onArtistChange={setEditArtist}
        onAlbumChange={setEditAlbum}
        onAccessChange={setEditAccess}
        onClose={() => setEditTrack(null)}
        onSave={() => void saveEdit()}
      />

      <Sheet open={deleteTarget !== null && !isLgUp} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <SheetContent side="bottom" className="gap-0 p-0">
          <SheetTitle className="sr-only">{t("tracks.deleteTitle")}</SheetTitle>
          <div className="px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
              <Trash2 className="size-5" aria-hidden />
            </div>
            <h3 className="text-center text-lg font-semibold">{t("tracks.deleteTitle")}</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t("tracks.deleteDescription", { title: deleteTarget?.title ?? "" })}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("tracks.cancel")}
              </Button>
              <Button variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()}>
                {deleteBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t("tracks.delete")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteTarget !== null && isLgUp} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
