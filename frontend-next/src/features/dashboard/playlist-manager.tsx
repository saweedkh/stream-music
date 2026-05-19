"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  GripVertical,
  ListMusic,
  Loader2,
  Music,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { FavoriteStarButton } from "@/components/ui/favorite-star-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  addPlaylistItem,
  bulkAddTracksToPlaylist,
  createPlaylist,
  deletePlaylist,
  deletePlaylistItem,
  deleteTrack,
  listChannels,
  listPlaylistItems,
  listPlaylists,
  listTracks,
  reorderPlaylistItem,
  setPlaylistFavorite,
  setTrackFavorite,
  updatePlaylist,
  updateTrack,
  uploadTrackChunked,
  type ChannelSummary,
  type PlaylistItemSummary,
  type PlaylistSummary,
  type TrackSummary,
} from "@/lib/api";
import { uploadTrackResumable } from "@/lib/resumable-upload";

const CHUNK = 50;
const DEBOUNCE_MS = 300;
const VISIBILITY_KEYS: Record<TrackSummary["visibility"], MessageKey> = {
  private: "tracks.visPrivate",
  shared_with_users: "tracks.visSharedUsers",
  shared_with_channels: "tracks.visSharedChannels",
  public_lan: "tracks.visPublicLan",
};
const VIS_TONE: Record<TrackSummary["visibility"], "default" | "warning" | "success"> = {
  private: "default",
  shared_with_users: "warning",
  shared_with_channels: "warning",
  public_lan: "success",
};

function useDebounce<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function PlaylistManager() {
  const { t } = useTranslations();
  const { showToast } = useToast();

  // ─── raw data ────────────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [allItems, setAllItems] = useState<PlaylistItemSummary[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<TrackSummary[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // ─── selected playlist ────────────────────────────────────────────────────
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const selectedPlaylist = useMemo(() => playlists.find((p) => p.id === selectedPlaylistId) ?? null, [playlists, selectedPlaylistId]);
  const playlistItems = useMemo(
    () => allItems.filter((i) => i.playlist === selectedPlaylistId).sort((a, b) => a.position - b.position),
    [allItems, selectedPlaylistId],
  );

  // ─── library search ───────────────────────────────────────────────────────
  const [libQuery, setLibQuery] = useState("");
  const debouncedLibQuery = useDebounce(libQuery, DEBOUNCE_MS);
  const [libLoading, setLibLoading] = useState(false);
  const [libOffset, setLibOffset] = useState(0);
  const LIB_PAGE = 40;

  // ─── playlist search ──────────────────────────────────────────────────────
  const [playlistQuery, setPlaylistQuery] = useState("");

  // ─── selection (for bulk add) ─────────────────────────────────────────────
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // ─── drag reorder ─────────────────────────────────────────────────────────
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);

  // ─── create playlist dialog ───────────────────────────────────────────────
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistChannel, setNewPlaylistChannel] = useState<string>("none");
  const [createBusy, setCreateBusy] = useState(false);

  // ─── rename playlist ───────────────────────────────────────────────────────
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // ─── delete playlist ──────────────────────────────────────────────────────
  const [deletePlaylistId, setDeletePlaylistId] = useState<number | null>(null);
  const [deletePlBusy, setDeletePlBusy] = useState(false);

  // ─── edit track ───────────────────────────────────────────────────────────
  const [editTrack, setEditTrack] = useState<TrackSummary | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [editVisibility, setEditVisibility] = useState<TrackSummary["visibility"]>("private");
  const [editTrackBusy, setEditTrackBusy] = useState(false);

  // ─── delete track ─────────────────────────────────────────────────────────
  const [deleteTrackTarget, setDeleteTrackTarget] = useState<TrackSummary | null>(null);
  const [deleteTrackBusy, setDeleteTrackBusy] = useState(false);

  // ─── upload ───────────────────────────────────────────────────────────────
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<TrackSummary["visibility"]>("private");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [libFavoritesOnly, setLibFavoritesOnly] = useState(false);
  const [playlistsFavoritesOnly, setPlaylistsFavoritesOnly] = useState(false);
  const [favoriteBusyTrackId, setFavoriteBusyTrackId] = useState<number | null>(null);
  const [favoriteBusyPlaylistId, setFavoriteBusyPlaylistId] = useState<number | null>(null);

  // ─── data loading ─────────────────────────────────────────────────────────
  const fetchLibrary = useCallback(
    async (search: string, offset: number, favoritedOnly = libFavoritesOnly) => {
      setLibLoading(true);
      try {
        const result = await listTracks({
          search,
          limit: LIB_PAGE,
          offset,
          favorited: favoritedOnly || undefined,
        });
        if (Array.isArray(result)) {
          setLibraryTracks(result);
          setLibraryTotal(result.length);
        } else {
          setLibraryTracks(result.results);
          setLibraryTotal(result.total);
        }
      } catch {
        showToast(t("playlists.cannotLoadTracks"), "error");
      } finally {
        setLibLoading(false);
      }
    },
    [libFavoritesOnly, showToast, t],
  );

  useEffect(() => {
    setLibOffset(0);
    void fetchLibrary(debouncedLibQuery, 0);
  }, [debouncedLibQuery, fetchLibrary]);

  const refreshMeta = useCallback(
    async (favoritedOnly = playlistsFavoritesOnly) => {
      try {
        const [c, p] = await Promise.all([
          listChannels(),
          listPlaylists(undefined, { favorited: favoritedOnly || undefined }),
        ]);
        setChannels(c);
        setPlaylists(p);
      } catch {
        showToast(t("playlists.cannotRefresh"), "error");
      }
    },
    [playlistsFavoritesOnly, showToast, t],
  );

  const refreshItems = useCallback(async () => {
    try {
      const items = await listPlaylistItems();
      setAllItems(items);
    } catch {
      showToast(t("playlists.cannotRefreshItems"), "error");
    }
  }, [showToast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([refreshMeta(), refreshItems(), fetchLibrary("", 0)]).finally(() => setLoading(false));
  }, [refreshMeta, refreshItems, fetchLibrary]);

  // ─── filtered playlist items ──────────────────────────────────────────────
  const filteredPlaylistItems = useMemo(() => {
    if (!playlistQuery.trim()) return playlistItems;
    const q = playlistQuery.toLowerCase();
    return playlistItems.filter((item) => {
      const t = item.track_detail;
      return t && (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    });
  }, [playlistItems, playlistQuery]);

  const isFiltering = playlistQuery.trim().length > 0;

  // ─── create playlist ──────────────────────────────────────────────────────
  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    setCreateBusy(true);
    try {
      const pl = await createPlaylist({
        name: newPlaylistName.trim(),
        channel: newPlaylistChannel !== "none" ? Number(newPlaylistChannel) : null,
      });
      showToast(t("playlists.created"), "success");
      setNewPlaylistName("");
      setNewPlaylistChannel("none");
      setShowCreatePlaylist(false);
      await refreshMeta();
      setSelectedPlaylistId(pl.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.createFailed"), "error");
    } finally {
      setCreateBusy(false);
    }
  }

  // ─── rename playlist ──────────────────────────────────────────────────────
  useEffect(() => {
    if (renamingPlaylistId !== null) setTimeout(() => renameRef.current?.select(), 50);
  }, [renamingPlaylistId]);

  async function commitRename() {
    if (!renamingPlaylistId || !renameValue.trim()) {
      setRenamingPlaylistId(null);
      return;
    }
    try {
      await updatePlaylist(renamingPlaylistId, { name: renameValue.trim() });
      showToast(t("playlists.renamed"), "success");
      await refreshMeta();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.renameFailed"), "error");
    } finally {
      setRenamingPlaylistId(null);
    }
  }

  // ─── delete playlist ──────────────────────────────────────────────────────
  async function confirmDeletePlaylist() {
    if (!deletePlaylistId) return;
    setDeletePlBusy(true);
    try {
      await deletePlaylist(deletePlaylistId);
      showToast(t("playlists.deleted"), "success");
      if (selectedPlaylistId === deletePlaylistId) setSelectedPlaylistId(null);
      await Promise.all([refreshMeta(), refreshItems()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.deleteFailed"), "error");
    } finally {
      setDeletePlBusy(false);
      setDeletePlaylistId(null);
    }
  }

  // ─── bulk add ─────────────────────────────────────────────────────────────
  async function handleBulkAdd() {
    if (!selectedPlaylistId || selectedTrackIds.size === 0) return;
    const ids = Array.from(selectedTrackIds);
    setBulkAdding(true);
    setBulkProgress(0);
    let done = 0;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        await bulkAddTracksToPlaylist(selectedPlaylistId, ids.slice(i, i + CHUNK));
        done = Math.min(i + CHUNK, ids.length);
        setBulkProgress(Math.round((done / ids.length) * 100));
      }
      showToast(t("playlists.bulkAdded", { count: ids.length }), "success");
      setSelectedTrackIds(new Set());
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.bulkAddFailed"), "error");
    } finally {
      setBulkAdding(false);
      setBulkProgress(0);
    }
  }

  // ─── single add ───────────────────────────────────────────────────────────
  async function handleAddSingle(trackId: number) {
    if (!selectedPlaylistId) {
      showToast(t("playlists.selectFirst"), "error");
      return;
    }
    try {
      const position = playlistItems.length;
      await addPlaylistItem({ playlist: selectedPlaylistId, track: trackId, position });
      showToast(t("playlists.trackAdded"), "success");
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.addTrackFailed"), "error");
    }
  }

  // ─── remove item from playlist ────────────────────────────────────────────
  async function handleRemoveItem(itemId: number) {
    try {
      await deletePlaylistItem(itemId);
      showToast(t("playlists.trackRemoved"), "success");
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.removeTrackFailed"), "error");
    }
  }

  // ─── drag reorder ─────────────────────────────────────────────────────────
  async function handleDrop(dropIndex: number) {
    if (!draggingItemId) return;
    try {
      await reorderPlaylistItem(draggingItemId, dropIndex);
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.reorderFailed"), "error");
    } finally {
      setDraggingItemId(null);
    }
  }

  // ─── edit track ───────────────────────────────────────────────────────────
  function openEditTrack(track: TrackSummary) {
    setEditTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist);
    setEditAlbum(track.album);
    setEditVisibility(track.visibility);
  }

  async function saveEditTrack() {
    if (!editTrack) return;
    setEditTrackBusy(true);
    try {
      await updateTrack(editTrack.id, {
        title: editTitle.trim() || undefined,
        artist: editArtist.trim() || undefined,
        album: editAlbum.trim() || undefined,
        visibility: editVisibility,
      });
      showToast(t("playlists.trackUpdated"), "success");
      setEditTrack(null);
      await fetchLibrary(debouncedLibQuery, libOffset);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.updateTrackFailed"), "error");
    } finally {
      setEditTrackBusy(false);
    }
  }

  // ─── delete track ─────────────────────────────────────────────────────────
  async function confirmDeleteTrack() {
    if (!deleteTrackTarget) return;
    setDeleteTrackBusy(true);
    try {
      await deleteTrack(deleteTrackTarget.id);
      showToast(t("playlists.trackDeleted"), "success");
      setDeleteTrackTarget(null);
      await Promise.all([fetchLibrary(debouncedLibQuery, libOffset), refreshItems()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.deleteTrackFailed"), "error");
    } finally {
      setDeleteTrackBusy(false);
    }
  }

  // ─── upload ───────────────────────────────────────────────────────────────
  function handleFileSelect(file: File | null) {
    setUploadFile(file);
    if (file && !uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim());
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) {
      showToast(t("playlists.titleFileRequired"), "error");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadTrackResumable(
        uploadTrackChunked,
        { title: uploadTitle.trim(), visibility: uploadVisibility, file: uploadFile },
        { onProgress: setUploadProgress },
      );
      showToast(t("playlists.trackUploaded"), "success");
      setUploadTitle("");
      setUploadFile(null);
      setUploadProgress(100);
      setShowUpload(false);
      await fetchLibrary(debouncedLibQuery, libOffset);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.uploadFailed"), "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleTrackFavoriteToggle(trackId: number, next: boolean) {
    setFavoriteBusyTrackId(trackId);
    try {
      await setTrackFavorite(trackId, next);
      if (libFavoritesOnly && !next) {
        setLibraryTracks((prev) => prev.filter((tr) => tr.id !== trackId));
        setLibraryTotal((n) => Math.max(0, n - 1));
      } else {
        setLibraryTracks((prev) => prev.map((tr) => (tr.id === trackId ? { ...tr, is_favorited: next } : tr)));
      }
      showToast(t("favorites.updated"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("favorites.updateFailed"), "error");
    } finally {
      setFavoriteBusyTrackId(null);
    }
  }

  async function handlePlaylistFavoriteToggle(playlistId: number, next: boolean, e?: React.MouseEvent) {
    e?.stopPropagation();
    setFavoriteBusyPlaylistId(playlistId);
    try {
      await setPlaylistFavorite(playlistId, next);
      if (playlistsFavoritesOnly && !next) {
        setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
        if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null);
      } else {
        setPlaylists((prev) => prev.map((pl) => (pl.id === playlistId ? { ...pl, is_favorited: next } : pl)));
      }
      showToast(t("favorites.updated"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("favorites.updateFailed"), "error");
    } finally {
      setFavoriteBusyPlaylistId(null);
    }
  }

  // ─── pagination helpers ───────────────────────────────────────────────────
  function prevPage() {
    const next = Math.max(0, libOffset - LIB_PAGE);
    setLibOffset(next);
    void fetchLibrary(debouncedLibQuery, next);
  }
  function nextPage() {
    const next = libOffset + LIB_PAGE;
    if (next < libraryTotal) {
      setLibOffset(next);
      void fetchLibrary(debouncedLibQuery, next);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        {t("playlists.loading")}
      </div>
    );
  }

  const allLibSelected = libraryTracks.length > 0 && libraryTracks.every((t) => selectedTrackIds.has(t.id));

  return (
    <div className="flex flex-1 flex-col gap-3 max-lg:overflow-visible md:grid md:grid-cols-[min(100%,240px)_1fr] md:gap-4 lg:min-h-0">
      {/* ── Sidebar: playlists list ──────────────────────────────────────── */}
      <Card className="flex flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden">
        <CardHeader className="flex flex-col gap-2 space-y-0 pb-3">
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{t("playlists.playlistsTitle")}</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-brand hover:text-brand" onClick={() => setShowCreatePlaylist(true)}>
              <Plus className="h-4 w-4" />
              {t("playlists.new")}
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant={playlistsFavoritesOnly ? "default" : "outline"}
            className={`h-7 w-full gap-1.5 text-xs ${playlistsFavoritesOnly ? "bg-amber-500/90 hover:bg-amber-500" : ""}`}
            onClick={() => {
              const next = !playlistsFavoritesOnly;
              setPlaylistsFavoritesOnly(next);
              void refreshMeta(next);
            }}
          >
            <Star className={`h-3.5 w-3.5 ${playlistsFavoritesOnly ? "fill-current" : ""}`} aria-hidden />
            {playlistsFavoritesOnly ? t("favorites.showAll") : t("favorites.showOnly")}
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 pt-0">
        <ScrollArea className="min-h-[12rem] flex-1">
          <div className="space-y-1 pr-1">
            {playlists.length === 0 && <p className="px-2 text-xs text-muted-foreground">{t("playlists.emptyList")}</p>}
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                  selectedPlaylistId === pl.id
                    ? "bg-brand/15 text-brand"
                    : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                }`}
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setPlaylistQuery("");
                }}
              >
                <FavoriteStarButton
                  favorited={Boolean(pl.is_favorited)}
                  busy={favoriteBusyPlaylistId === pl.id}
                  label={pl.is_favorited ? t("favorites.remove") : t("favorites.add")}
                  className="h-7 w-7"
                  onToggle={() => void handlePlaylistFavoriteToggle(pl.id, !pl.is_favorited)}
                />
                <ListMusic className="h-4 w-4 shrink-0 opacity-60" />
                {renamingPlaylistId === pl.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitRename();
                      if (e.key === "Escape") setRenamingPlaylistId(null);
                    }}
                    onBlur={commitRename}
                    className="w-full min-w-0 rounded bg-card px-1 text-sm text-foreground outline outline-1 outline-brand/60"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">{pl.name}</span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="rounded p-0.5 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingPlaylistId(pl.id);
                      setRenameValue(pl.name);
                    }}
                    title={t("playlists.rename")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 hover:text-rose-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePlaylistId(pl.id);
                    }}
                    title={t("playlists.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-col gap-4">
        {/* ── Track library ─────────────────────────────────────────────── */}
        <Card className="border-border/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                <Music className="mr-1.5 inline h-4 w-4 opacity-60" />
                {t("playlists.libraryTitle")}
                {libraryTotal > 0 && (
                  <span className="ms-2 text-xs font-normal text-muted-foreground">{t("playlists.tracksCount", { count: libraryTotal })}</span>
                )}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={libFavoritesOnly ? "default" : "outline"}
                  className={`h-7 gap-1 px-2 text-xs ${libFavoritesOnly ? "bg-amber-500/90 hover:bg-amber-500" : ""}`}
                  onClick={() => {
                    const next = !libFavoritesOnly;
                    setLibFavoritesOnly(next);
                    setLibOffset(0);
                    void fetchLibrary(debouncedLibQuery, 0, next);
                  }}
                >
                  <Star className={`h-3.5 w-3.5 ${libFavoritesOnly ? "fill-current" : ""}`} aria-hidden />
                  {libFavoritesOnly ? t("favorites.showAll") : t("favorites.showOnly")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-muted-foreground hover:text-foreground" onClick={() => setShowUpload((v) => !v)}>
                  <Plus className="h-4 w-4" />
                  {t("playlists.upload")}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showUpload ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>
            {/* Upload form (collapsible) */}
            {showUpload && (
              <div className="mt-3 grid gap-3 rounded-xl border border-border/80 bg-card/60 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("playlists.titleLabel")}</Label>
                  <Input className="h-8 text-sm" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder={t("playlists.titlePlaceholder")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("playlists.visibilityLabel")}</Label>
                  <Select
                    className="h-8 text-sm"
                    value={uploadVisibility}
                    valid={Boolean(uploadVisibility)}
                    onChange={(e) => setUploadVisibility(e.target.value as TrackSummary["visibility"])}
                  >
                    <option value="private">{t("tracks.visPrivate")}</option>
                    <option value="shared_with_users">{t("tracks.visSharedUsers")}</option>
                    <option value="shared_with_channels">{t("tracks.visSharedChannels")}</option>
                    <option value="public_lan">{t("tracks.visPublicLan")}</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <div
                    className="mb-2 rounded-lg border border-dashed border-border/80 bg-card/60 px-4 py-3 text-center text-xs text-muted-foreground transition hover:border-brand/40"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFileSelect(e.dataTransfer.files?.[0] ?? null);
                    }}
                  >
                    {uploadFile ? uploadFile.name : t("playlists.dropOrSelect")}
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="mb-2 w-full rounded border border-border/80 bg-card/80 px-3 py-1.5 text-xs text-foreground/80 file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                  {uploading && (
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  <Button size="sm" className="w-full" disabled={uploading} onClick={handleUpload}>
                    {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {uploading ? t("playlists.uploading") : t("playlists.upload")}
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {/* Search + select all */}
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder={t("playlists.searchLibrary")}
                  value={libQuery}
                  onChange={(e) => setLibQuery(e.target.value)}
                />
                {libQuery && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80" onClick={() => setLibQuery("")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {libraryTracks.length > 0 && (
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card/60 transition hover:border-brand/50"
                  title={allLibSelected ? t("playlists.deselectAllPage") : t("playlists.selectAllPage")}
                  onClick={() => {
                    if (allLibSelected) {
                      setSelectedTrackIds((prev) => {
                        const next = new Set(prev);
                        libraryTracks.forEach((t) => next.delete(t.id));
                        return next;
                      });
                    } else {
                      setSelectedTrackIds((prev) => {
                        const next = new Set(prev);
                        libraryTracks.forEach((t) => next.add(t.id));
                        return next;
                      });
                    }
                  }}
                >
                  {allLibSelected ? <Check className="h-4 w-4 text-brand" /> : <Check className="h-4 w-4 text-muted-foreground" />}
                </button>
              )}
            </div>

            {/* Selection bar */}
            {selectedTrackIds.size > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-brand/30 bg-[var(--brand-subtle)] px-3 py-2 text-sm text-brand">
                <span>{selectedTrackIds.size} selected</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedTrackIds(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-brand px-3 hover:bg-brand"
                    disabled={!selectedPlaylistId || bulkAdding}
                    onClick={handleBulkAdd}
                  >
                    {bulkAdding ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {bulkProgress}%
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Add to playlist
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {libLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : libraryTracks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {libQuery ? t("playlists.noSearchResults") : t("playlists.libraryEmpty")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {libraryTracks.map((track) => {
                  const selected = selectedTrackIds.has(track.id);
                  return (
                    <div
                      key={track.id}
                      className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                        selected
                          ? "border-brand/40 bg-[var(--brand-subtle)]"
                          : "border-border/70 bg-card/40 hover:border-border/80"
                      }`}
                    >
                      <button
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          selected
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border hover:border-brand/60"
                        }`}
                        onClick={() =>
                          setSelectedTrackIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(track.id)) next.delete(track.id);
                            else next.add(track.id);
                            return next;
                          })
                        }
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </button>

                      <FavoriteStarButton
                        favorited={Boolean(track.is_favorited)}
                        busy={favoriteBusyTrackId === track.id}
                        label={track.is_favorited ? t("favorites.remove") : t("favorites.add")}
                        className="h-7 w-7"
                        onToggle={() => void handleTrackFavoriteToggle(track.id, !track.is_favorited)}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{track.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {track.artist || <span className="italic">No artist</span>}
                          {track.album ? ` · ${track.album}` : ""}
                        </p>
                      </div>

                      <Badge variant={VIS_TONE[track.visibility]} className="hidden shrink-0 text-xs sm:flex">
                        {t(VISIBILITY_KEYS[track.visibility])}
                      </Badge>

                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="rounded p-1 text-muted-foreground hover:text-brand"
                          title={t("playlists.addToPlaylist")}
                          onClick={() => void handleAddSingle(track.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          title={t("playlists.editTrack")}
                          onClick={() => openEditTrack(track)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1 text-muted-foreground hover:text-rose-400"
                          title={t("playlists.deleteTrack")}
                          onClick={() => setDeleteTrackTarget(track)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {libraryTotal > LIB_PAGE && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {libOffset + 1}–{Math.min(libOffset + LIB_PAGE, libraryTotal)} of {libraryTotal}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 px-3" disabled={libOffset === 0} onClick={prevPage}>
                    ← Prev
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-3" disabled={libOffset + LIB_PAGE >= libraryTotal} onClick={nextPage}>
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Selected playlist items ──────────────────────────────────── */}
        {selectedPlaylist ? (
          <Card className="border-border/90">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="flex-1 text-base">
                  <ListMusic className="mr-1.5 inline h-4 w-4 opacity-60" />
                  {selectedPlaylist.name}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    {t("playlists.tracksCount", { count: playlistItems.length })}
                  </span>
                </CardTitle>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder={t("playlists.searchInPlaylist")}
                  value={playlistQuery}
                  onChange={(e) => setPlaylistQuery(e.target.value)}
                />
                {playlistQuery && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80" onClick={() => setPlaylistQuery("")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredPlaylistItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {isFiltering ? t("playlists.noSearchResults") : t("playlists.playlistEmpty")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {filteredPlaylistItems.map((item, index) => {
                    const trackDetail = item.track_detail;
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-2 rounded-lg border border-border/70 bg-card/40 px-3 py-2 transition-colors hover:border-border/80"
                        draggable={!isFiltering}
                        onDragStart={() => setDraggingItemId(item.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => void handleDrop(index)}
                      >
                        <GripVertical className={`h-4 w-4 shrink-0 text-muted-foreground ${isFiltering ? "opacity-20" : "cursor-grab"}`} />
                        <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{item.position + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {trackDetail ? trackDetail.title : t("tracks.trackId", { id: item.track })}
                          </p>
                          {trackDetail ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {trackDetail.artist || <span className="italic">{t("playlists.noArtist")}</span>}
                              {trackDetail.album ? ` · ${trackDetail.album}` : ""}
                            </p>
                          ) : null}
                        </div>
                        <button
                          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                          title={t("playlists.removeFromPlaylist")}
                          onClick={() => void handleRemoveItem(item.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
            {t("playlists.selectPlaylistHint")}
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Create playlist */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("playlists.newDialogTitle")}</DialogTitle>
            <DialogDescription>{t("playlists.newDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>{t("playlists.nameLabel")}</Label>
              <Input
                placeholder={t("playlists.namePlaceholder")}
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreatePlaylist(); }}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("playlists.channelOptional")}</Label>
              <Select
                value={newPlaylistChannel}
                valid={newPlaylistChannel !== "none"}
                onChange={(e) => setNewPlaylistChannel(e.target.value)}
              >
                <option value="none">{t("playlists.noChannelPrivate")}</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={String(ch.id)}>
                    {ch.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreatePlaylist(false)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!newPlaylistName.trim() || createBusy} onClick={handleCreatePlaylist}>
              {createBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete playlist */}
      <Dialog open={deletePlaylistId !== null} onOpenChange={(open) => { if (!open) setDeletePlaylistId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("playlists.deleteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("playlists.deleteDialogDescription", {
                name: playlists.find((p) => p.id === deletePlaylistId)?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletePlaylistId(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={deletePlBusy} onClick={confirmDeletePlaylist}>
              {deletePlBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit track */}
      <Dialog open={editTrack !== null} onOpenChange={(open) => { if (!open) setEditTrack(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("playlists.editTrackDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>{t("playlists.titleLabel")}</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("playlists.artistLabel")}</Label>
              <Input value={editArtist} onChange={(e) => setEditArtist(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("playlists.albumLabel")}</Label>
              <Input value={editAlbum} onChange={(e) => setEditAlbum(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("playlists.visibilityLabel")}</Label>
              <Select value={editVisibility} valid onChange={(e) => setEditVisibility(e.target.value as TrackSummary["visibility"])}>
                <option value="private">{t("tracks.visPrivate")}</option>
                <option value="shared_with_users">{t("tracks.visSharedUsers")}</option>
                <option value="shared_with_channels">{t("tracks.visSharedChannels")}</option>
                <option value="public_lan">{t("tracks.visPublicLan")}</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTrack(null)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={editTrackBusy} onClick={saveEditTrack}>
              {editTrackBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete track */}
      <Dialog open={deleteTrackTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTrackTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("playlists.deleteTrackDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("playlists.deleteTrackDialogDescription", { title: deleteTrackTarget?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTrackTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={deleteTrackBusy} onClick={confirmDeleteTrack}>
              {deleteTrackBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
