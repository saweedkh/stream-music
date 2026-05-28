"use client";

import {
  ChevronDown,
  GripVertical,
  Library,
  ListMusic,
  ListPlus,
  Loader2,
  Download,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Radio,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "@/components/providers/locale-provider";
import { listenerFieldClass } from "@/features/channels/channel-listener-panel-styles";
import { ImportPlaylistToChannelDialog } from "@/features/playlists/import-playlist-to-channel-dialog";
import { useToast } from "@/components/ui/toast-provider";
import {
  addPlaylistItem,
  bulkAddTracksToPlaylist,
  createPlaylist,
  deletePlaylist,
  deletePlaylistItem,
  getSimilarTracks,
  listPlaylistItems,
  listPlaylists,
  listTracks,
  normalizeTrackList,
  playPlaylistInChannel,
  playTrackInChannel,
  reorderPlaylistItem,
  shufflePlayInChannel,
  updatePlaylist,
  uploadTrackChunked,
  type PlaylistItemSummary,
  type PlaylistSummary,
  type TrackSummary,
} from "@/lib/api";
import { uploadTrackResumable } from "@/lib/resumable-upload";
import { cn } from "@/lib/utils";

const LIBRARY_SEARCH_LIMIT = 200;
const BULK_ADD_CHUNK = 50;

type Props = {
  channelId: string;
  canManage: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
};

const rowBtn =
  "h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground";

export function ChannelAdminPlaylistPanel({ channelId, canManage, sendSocketMessage }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [items, setItems] = useState<PlaylistItemSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<TrackSummary["visibility"]>("private");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [shuffling, setShuffling] = useState(false);

  const [libraryQuery, setLibraryQuery] = useState("");
  const [debouncedLibraryQuery, setDebouncedLibraryQuery] = useState("");
  const [libraryTracks, setLibraryTracks] = useState<TrackSummary[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(() => new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [addingSingleId, setAddingSingleId] = useState<number | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [mainTab, setMainTab] = useState<"library" | "playlist">("library");
  const [similarAnchorId, setSimilarAnchorId] = useState<number | null>(null);
  const [similarTracks, setSimilarTracks] = useState<TrackSummary[]>([]);
  const [similarBusy, setSimilarBusy] = useState(false);
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  const selectedPlaylist = playlists.find((p) => String(p.id) === selectedPlaylistId);

  useEffect(() => {
    if (renamingPlaylistId !== null) setTimeout(() => renameRef.current?.select(), 50);
  }, [renamingPlaylistId]);

  const refreshPlaylists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const list = await listPlaylists(channelId);
      setPlaylists(list.filter((p) => p.channel === Number(channelId)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot load playlists.";
      setStatus(message);
      showToast(message, "error");
    } finally {
      setLoadingLists(false);
    }
  }, [channelId, showToast]);

  const loadItems = useCallback(
    async (playlistId: string) => {
      if (!playlistId) {
        setItems([]);
        return;
      }
      setLoadingItems(true);
      try {
        const raw = await listPlaylistItems(Number(playlistId));
        const sorted = [...raw].sort((a, b) => a.position - b.position);
        setItems(sorted);
      } catch {
        showToast("Cannot load playlist tracks.", "error");
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void refreshPlaylists();
  }, [refreshPlaylists]);

  useEffect(() => {
    void loadItems(selectedPlaylistId);
  }, [selectedPlaylistId, loadItems]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedLibraryQuery(libraryQuery.trim()), 320);
    return () => window.clearTimeout(t);
  }, [libraryQuery]);

  useEffect(() => {
    setSelectedTrackIds(new Set());
  }, [debouncedLibraryQuery]);

  useEffect(() => {
    // When switching playlists, reset local search so drag indices and UX match.
    setPlaylistQuery("");
    setSimilarAnchorId(null);
  }, [selectedPlaylistId]);

  useEffect(() => {
    if (!similarAnchorId) {
      setSimilarTracks([]);
      return;
    }
    setSimilarBusy(true);
    void getSimilarTracks(channelId, similarAnchorId)
      .then((r) => setSimilarTracks(r.results))
      .catch(() => {
        setSimilarTracks([]);
        showToast("Could not load similar tracks.", "error");
      })
      .finally(() => setSimilarBusy(false));
  }, [channelId, similarAnchorId, showToast]);

  useEffect(() => {
    if (!debouncedLibraryQuery) {
      setLibraryTracks([]);
      return;
    }
    let cancelled = false;
    setLibraryLoading(true);
    void listTracks({ search: debouncedLibraryQuery, limit: LIBRARY_SEARCH_LIMIT })
      .then((rows) => {
        if (!cancelled) setLibraryTracks(normalizeTrackList(rows));
      })
      .catch(() => {
        if (!cancelled) showToast("Search failed.", "error");
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedLibraryQuery, showToast]);

  const selectedCount = selectedTrackIds.size;
  const visibleIds = useMemo(() => libraryTracks.map((t) => t.id), [libraryTracks]);

  function toggleTrackSelection(id: number) {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedTrackIds(new Set(visibleIds));
  }

  function clearSelection() {
    setSelectedTrackIds(new Set());
  }

  async function handleCreatePlaylist() {
    const name = newPlaylistName.trim();
    if (!name) {
      showToast("Playlist name is required.", "error");
      return;
    }
    setIsCreatingPlaylist(true);
    try {
      const created = await createPlaylist({ name, channel: Number(channelId) });
      setNewPlaylistName("");
      setSelectedPlaylistId(String(created.id));
      showToast(`Playlist "${created.name}" created.`, "success");
      await refreshPlaylists();
      setMainTab("playlist");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot create playlist.", "error");
    } finally {
      setIsCreatingPlaylist(false);
    }
  }

  async function handleBulkAddToPlaylist() {
    if (!selectedPlaylistId) {
      showToast("Select a playlist first.", "error");
      return;
    }
    const ids = Array.from(selectedTrackIds);
    if (!ids.length) return;
    setBulkAdding(true);
    setBulkProgress({ done: 0, total: ids.length });
    let addedTotal = 0;
    try {
      for (let i = 0; i < ids.length; i += BULK_ADD_CHUNK) {
        const chunk = ids.slice(i, i + BULK_ADD_CHUNK);
        const res = await bulkAddTracksToPlaylist(Number(selectedPlaylistId), chunk);
        addedTotal += res.added;
        setBulkProgress({ done: Math.min(i + chunk.length, ids.length), total: ids.length });
      }
      showToast(`Added ${addedTotal} track(s) to "${selectedPlaylist?.name ?? "playlist"}".`, "success");
      clearSelection();
      await loadItems(selectedPlaylistId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Bulk add failed.", "error");
    } finally {
      setBulkAdding(false);
      setBulkProgress(null);
    }
  }

  async function handleAddSingleToPlaylist(trackId: number) {
    if (!selectedPlaylistId) {
      showToast("Select a playlist first.", "error");
      return;
    }
    setAddingSingleId(trackId);
    try {
      const nextPosition = items.length;
      await addPlaylistItem({
        playlist: Number(selectedPlaylistId),
        track: trackId,
        position: nextPosition,
      });
      showToast("Track added to playlist.", "success");
      await loadItems(selectedPlaylistId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot add track.", "error");
    } finally {
      setAddingSingleId(null);
    }
  }

  async function handleRemoveItem(itemId: number) {
    try {
      await deletePlaylistItem(itemId);
      showToast("Removed from playlist.", "success");
      await loadItems(selectedPlaylistId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot remove.", "error");
    }
  }

  async function commitRename() {
    if (!renamingPlaylistId || !renameValue.trim()) {
      setRenamingPlaylistId(null);
      return;
    }
    const trimmed = renameValue.trim();
    try {
      await updatePlaylist(renamingPlaylistId, { name: trimmed });
      showToast(t("playlists.renamed"), "success");
      await refreshPlaylists();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("playlists.renameFailed"), "error");
    } finally {
      setRenamingPlaylistId(null);
    }
  }

  function startRename(playlist: PlaylistSummary) {
    setRenamingPlaylistId(playlist.id);
    setRenameValue(playlist.name);
  }

  async function handleDeletePlaylist() {
    if (!selectedPlaylistId) return;
    if (!window.confirm("Delete this playlist?")) return;
    try {
      await deletePlaylist(Number(selectedPlaylistId));
      setSelectedPlaylistId("");
      showToast("Playlist deleted.", "success");
      await refreshPlaylists();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot delete playlist.", "error");
    }
  }

  async function handleReorder(fromId: number, toIndex: number) {
    try {
      await reorderPlaylistItem(fromId, toIndex);
      await loadItems(selectedPlaylistId);
    } catch {
      showToast("Cannot reorder.", "error");
    }
  }

  async function startPlaylist(playlistId: number, playlistName?: string, startIndex = 0) {
    const sent = sendSocketMessage?.({ action: "play_playlist", playlist_id: playlistId, start_index: startIndex });
    if (!sent) {
      try {
        await playPlaylistInChannel(channelId, playlistId, startIndex);
        setStatus(`Queued "${playlistName ?? "playlist"}" for playback.`);
        showToast(`Playing "${playlistName ?? "playlist"}".`, "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cannot start playback.";
        showToast(message, "error");
      }
      return;
    }
    setStatus(`Queued "${playlistName ?? "playlist"}" for playback.`);
    showToast(`Playing "${playlistName ?? "playlist"}".`, "success");
  }

  async function playPlaylistFromIndex(startIndex: number, title?: string) {
    if (!selectedPlaylistId) {
      showToast("Select a playlist first.", "error");
      return;
    }
    setPlayingTrackId(items[startIndex]?.track ?? null);
    try {
      await startPlaylist(Number(selectedPlaylistId), selectedPlaylist?.name, startIndex);
      const label = title?.trim() || `track ${startIndex + 1}`;
      setStatus(`Playing from playlist: ${label}`);
      showToast(`Playlist continues after "${label}".`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot play from playlist.", "error");
    } finally {
      setPlayingTrackId(null);
    }
  }

  async function handlePlayTrackOnly(trackId: number, title?: string) {
    setPlayingTrackId(trackId);
    try {
      await playTrackInChannel(channelId, trackId);
      const label = title?.trim() ? title.trim() : `Track #${trackId}`;
      setStatus(`Now playing: ${label}`);
      showToast(`Playing only "${label}" (no playlist queue).`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot play track.", "error");
    } finally {
      setPlayingTrackId(null);
    }
  }

  function enqueueTrack(trackId: number, next = false) {
    const action = next ? "enqueue_next" : "add_to_queue";
    const ok = sendSocketMessage?.({ action, track_id: trackId });
    if (ok) {
      showToast(next ? "Queued to play next." : "Added to channel queue.", "success");
      return;
    }
    showToast("Connect to the channel to queue tracks.", "error");
  }

  async function handlePlayTrackOnChannel(track: TrackSummary) {
    const idx = items.findIndex((i) => i.track === track.id);
    if (selectedPlaylistId && idx >= 0) {
      await playPlaylistFromIndex(idx, track.title);
      return;
    }
    await handlePlayTrackOnly(track.id, track.title);
  }

  async function handlePlayTrackOnChannelById(trackId: number, title?: string, itemIndex?: number) {
    if (selectedPlaylistId && itemIndex != null && itemIndex >= 0) {
      await playPlaylistFromIndex(itemIndex, title);
      return;
    }
    await handlePlayTrackOnly(trackId, title);
  }

  async function handleShuffleApi() {
    setShuffling(true);
    try {
      await shufflePlayInChannel(channelId);
      setStatus("Shuffle queue loaded. Playback starts from the dock.");
      showToast("Shuffle: all tracks you can access are queued in random order.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shuffle failed.";
      setStatus(message);
      showToast(message, "error");
    } finally {
      setShuffling(false);
    }
  }

  function handleShuffleSocket() {
    const sent = sendSocketMessage?.({ action: "shuffle_play" });
    if (!sent) {
      void handleShuffleApi();
      return;
    }
    showToast("Shuffle queue loading…", "success");
  }

  async function handleUpload() {
    if (!uploadTitle.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!uploadFile) {
      showToast("Choose an audio file.", "error");
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    try {
      await uploadTrackResumable(
        uploadTrackChunked,
        { title: uploadTitle.trim(), visibility: uploadVisibility, file: uploadFile },
        { onProgress: (p) => setUploadProgress(p) },
      );
      showToast("Upload complete.", "success");
      setUploadTitle("");
      setUploadFile(null);
      setUploadProgress(null);
      if (debouncedLibraryQuery) {
        setLibraryQuery("");
        setDebouncedLibraryQuery("");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed.", "error");
    } finally {
      setIsUploading(false);
    }
  }

  const onDragStart = (e: React.DragEvent, itemId: number) => {
    if (!canManage) return;
    setDragItemId(itemId);
    e.dataTransfer.setData("text/plain", String(itemId));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!canManage) return;
    e.preventDefault();
  };

  const onDropRow = (e: React.DragEvent, dropIndex: number) => {
    if (!canManage) return;
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    setDragItemId(null);
    if (!Number.isFinite(id)) return;
    const fromIndex = items.findIndex((i) => i.id === id);
    if (fromIndex < 0) return;
    if (fromIndex === dropIndex) return;
    void handleReorder(id, dropIndex);
  };

  const playlistFiltering = Boolean(playlistQuery.trim());
  const filteredItems = useMemo(() => {
    if (!playlistFiltering) return items;
    const q = playlistQuery.trim().toLowerCase();
    return items.filter((it) => {
      const title = (it.track_detail?.title ?? "").toLowerCase();
      const artist = (it.track_detail?.artist ?? "").toLowerCase();
      return title.includes(q) || artist.includes(q);
    });
  }, [items, playlistFiltering, playlistQuery]);


  const segmentBtn = (active: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active ? "bg-brand/12 text-brand" : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
    );

  function actionTip(label: string, control: ReactNode) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[14rem] text-center">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-[var(--brand-subtle)] text-brand">
            <Radio className="size-5" aria-hidden />
          </div>
          <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {t("room.admin.tab.player.title")}
          </h2>
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 px-3"
              onClick={() => setImportOpen(true)}
            >
              <Download className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("room.admin.playlist.importButton")}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 gap-2 bg-brand px-3 text-brand-foreground shadow-md shadow-brand/15 hover:bg-brand-strong"
              disabled={shuffling}
              onClick={() => handleShuffleSocket()}
            >
              {shuffling ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
              {t("room.admin.playlist.shuffle")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col lg:w-[15.5rem] lg:border-e lg:border-border/40">
          <div className="shrink-0 space-y-3 px-4 py-3">
            {canManage ? (
              <div className="space-y-2">
                <Label htmlFor={`ch-${channelId}-pl-name`} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("room.admin.playlist.newPlaylist")}
                </Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="h-9 shrink-0 px-3" onClick={() => void handleCreatePlaylist()} disabled={isCreatingPlaylist}>
                    {isCreatingPlaylist ? <Loader2 className="size-4 animate-spin" /> : t("common.create")}
                  </Button>
                  <Input
                    id={`ch-${channelId}-pl-name`}
                    value={newPlaylistName}
                    valid={Boolean(newPlaylistName.trim())}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder={t("room.admin.playlist.newPlaceholder")}
                    className={cn("h-9 flex-1", listenerFieldClass)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 w-full gap-2"
                  onClick={() => setImportOpen(true)}
                >
                  <Download className="size-4 shrink-0" aria-hidden />
                  {t("room.admin.playlist.importButton")}
                </Button>
              </div>
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("room.admin.playlist.playlists")}</p>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
            {loadingLists ? (
              <div className="space-y-1.5 px-2 py-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : !playlists.length ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("room.admin.playlist.emptyPlaylists")}</p>
            ) : (
              <ul className="space-y-0.5 px-1">
                {playlists.map((p) => {
                  const active = String(p.id) === selectedPlaylistId;
                  const isRenaming = renamingPlaylistId === p.id;
                  return (
                    <li key={p.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (isRenaming) return;
                          setSelectedPlaylistId(String(p.id));
                          setMainTab("playlist");
                        }}
                        onKeyDown={(e) => {
                          if (isRenaming) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedPlaylistId(String(p.id));
                            setMainTab("playlist");
                          }
                        }}
                        className={cn(
                          "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm transition-colors",
                          active ? "bg-brand/12 font-medium text-brand" : "text-foreground/85 hover:bg-muted/35",
                        )}
                      >
                        <ListMusic className="size-4 shrink-0 opacity-70" aria-hidden />
                        {isRenaming ? (
                          <input
                            ref={renameRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commitRename();
                              if (e.key === "Escape") setRenamingPlaylistId(null);
                            }}
                            onBlur={() => void commitRename()}
                            className="min-w-0 flex-1 rounded-md border border-brand/40 bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-brand/50"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t("playlists.rename")}
                          />
                        ) : (
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        )}
                        {p.is_auto_generated ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            auto
                          </Badge>
                        ) : null}
                        {canManage && !isRenaming ? (
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                            title={t("playlists.rename")}
                            aria-label={t("playlists.rename")}
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(p);
                            }}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selectedPlaylistId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <Library className="size-10 text-muted-foreground/60" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">{t("room.admin.playlist.selectPlaylist")}</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 space-y-3 border-b border-border/40 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" className="gap-1.5" onClick={() => startPlaylist(Number(selectedPlaylistId), selectedPlaylist?.name)}>
                        <Play className="size-3.5" aria-hidden />
                        {t("room.admin.playlist.playOnChannel")}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => void handleDeletePlaylist()}>
                        <Trash2 className="size-3.5" aria-hidden />
                        {t("common.delete")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="min-w-0 sm:ms-auto sm:text-end">
                    <div className="flex items-center justify-end gap-1">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {renamingPlaylistId === Number(selectedPlaylistId) ? renameValue : selectedPlaylist?.name}
                      </h3>
                      {canManage && selectedPlaylist && renamingPlaylistId !== Number(selectedPlaylistId) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          title={t("playlists.rename")}
                          aria-label={t("playlists.rename")}
                          onClick={() => startRename(selectedPlaylist)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("room.admin.playlist.tracksCount", { count: items.length })}</p>
                  </div>
                </div>

                <div className="flex gap-1 rounded-xl bg-muted/25 p-1">
                  <button type="button" className={segmentBtn(mainTab === "library")} onClick={() => setMainTab("library")}>
                    <Search className="size-3.5" aria-hidden />
                    {t("room.admin.playlist.library")}
                  </button>
                  <button type="button" className={segmentBtn(mainTab === "playlist")} onClick={() => setMainTab("playlist")}>
                    <ListMusic className="size-3.5" aria-hidden />
                    {t("room.admin.playlist.thisPlaylist")}
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                {mainTab === "library" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="relative shrink-0">
                      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        value={libraryQuery}
                        onChange={(e) => setLibraryQuery(e.target.value)}
                        placeholder={t("room.admin.playlist.searchLibrary")}
                        className={cn("h-10 ps-10", listenerFieldClass)}
                        valid
                        aria-label={t("room.admin.playlist.searchLibrary")}
                      />
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{t("room.admin.playlist.searchHint", { limit: LIBRARY_SEARCH_LIMIT, chunk: BULK_ADD_CHUNK })}</p>

                    {canManage && selectedCount > 0 ? (
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-brand/8 px-3 py-2.5">
                        <p className="text-sm text-brand">
                          <span className="font-semibold">{selectedCount}</span> {t("room.admin.playlist.selected")}
                          {bulkProgress ? (
                            <span className="ms-2 text-brand/80">
                              ({bulkProgress.done}/{bulkProgress.total})
                            </span>
                          ) : null}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button type="button" variant="ghost" size="sm" onClick={selectAllVisible} disabled={!visibleIds.length}>
                            {t("room.admin.playlist.selectAll")}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                            {t("common.cancel")}
                          </Button>
                          <Button type="button" size="sm" disabled={bulkAdding} onClick={() => void handleBulkAddToPlaylist()}>
                            {bulkAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            {t("room.admin.playlist.addToPlaylist")}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <ScrollArea className="min-h-0 flex-1">
                      <ul className="space-y-0.5 pe-2">
                        {!debouncedLibraryQuery ? (
                          <li className="py-12 text-center text-sm text-muted-foreground">{t("room.admin.playlist.typeToSearch")}</li>
                        ) : libraryLoading ? (
                          <li className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            {t("common.loading")}
                          </li>
                        ) : !libraryTracks.length ? (
                          <li className="py-12 text-center text-sm text-muted-foreground">{t("room.admin.playlist.noResults")}</li>
                        ) : (
                          libraryTracks.map((tr) => {
                            const selected = selectedTrackIds.has(tr.id);
                            return (
                              <li
                                key={tr.id}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                                  selected ? "bg-brand/10" : "hover:bg-muted/30",
                                )}
                              >
                                {canManage ? (
                                  <input
                                    type="checkbox"
                                    className="size-4 shrink-0 accent-brand"
                                    checked={selected}
                                    onChange={() => toggleTrackSelection(tr.id)}
                                    aria-label={tr.title}
                                  />
                                ) : (
                                  <span className="w-4" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{tr.title}</p>
                                  <p className="truncate text-xs text-muted-foreground">{tr.artist || "—"}</p>
                                </div>
                                {canManage ? (
                                  <div className="flex shrink-0 items-center">
                                    {actionTip(
                                      t("room.admin.playlist.playOnChannel"),
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn(rowBtn, "text-brand")}
                                        disabled={playingTrackId === tr.id}
                                        aria-label={t("room.admin.playlist.playOnChannel")}
                                        onClick={() => void handlePlayTrackOnChannel(tr)}
                                      >
                                        {playingTrackId === tr.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                                      </Button>,
                                    )}
                                    {actionTip(
                                      t("room.admin.playlist.tip.addToPlaylist"),
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={rowBtn}
                                        disabled={addingSingleId === tr.id}
                                        aria-label={t("room.admin.playlist.tip.addToPlaylist")}
                                        onClick={() => void handleAddSingleToPlaylist(tr.id)}
                                      >
                                        {addingSingleId === tr.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                      </Button>,
                                    )}
                                  </div>
                                ) : null}
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </ScrollArea>

                    {canManage ? (
                      <details className="group shrink-0 border-t border-border/40 pt-3">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                          <Upload className="size-4 text-muted-foreground" />
                          {t("room.admin.playlist.upload")}
                          <ChevronDown className="ms-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`ch-${channelId}-up-title`}>{t("tracks.title")}</Label>
                            <Input id={`ch-${channelId}-up-title`} value={uploadTitle} valid={Boolean(uploadTitle.trim())} onChange={(e) => setUploadTitle(e.target.value)} className={listenerFieldClass} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`ch-${channelId}-up-vis`}>{t("tracks.visibility")}</Label>
                            <Select id={`ch-${channelId}-up-vis`} value={uploadVisibility} valid onChange={(e) => setUploadVisibility(e.target.value as TrackSummary["visibility"])} className={listenerFieldClass}>
                              <option value="private">{t("tracks.visPrivate")}</option>
                              <option value="shared_with_users">{t("tracks.visSharedUsers")}</option>
                              <option value="shared_with_channels">{t("tracks.visSharedChannels")}</option>
                              <option value="public_lan">{t("tracks.visPublicLan")}</option>
                            </Select>
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor={`ch-${channelId}-up-file`}>{t("tracks.audioFile")}</Label>
                            <Input id={`ch-${channelId}-up-file`} type="file" accept="audio/*" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className={listenerFieldClass} />
                          </div>
                        </div>
                        {uploadProgress != null ? (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-brand transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        ) : null}
                        <Button type="button" variant="secondary" size="sm" className="mt-3 gap-2" disabled={isUploading} onClick={() => void handleUpload()}>
                          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          {t("tracks.uploadButton")}
                        </Button>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex shrink-0 items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {t("room.admin.playlist.order")} <span className="font-normal text-muted-foreground">({items.length})</span>
                      </p>
                      {loadingItems ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                    <div className="relative shrink-0">
                      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        value={playlistQuery}
                        onChange={(e) => setPlaylistQuery(e.target.value)}
                        placeholder={t("room.admin.playlist.searchPlaylist")}
                        className={cn("h-10 ps-10", listenerFieldClass)}
                        valid
                        aria-label={t("room.admin.playlist.searchPlaylist")}
                      />
                    </div>
                    {playlistFiltering ? (
                      <p className="shrink-0 text-xs text-muted-foreground">{t("room.admin.playlist.filteringHint", { count: filteredItems.length, query: playlistQuery.trim() })}</p>
                    ) : null}

                    <ScrollArea className="min-h-0 flex-1">
                      <ul className="space-y-0.5 pe-2">
                        {!items.length && !loadingItems ? (
                          <li className="py-12 text-center text-sm text-muted-foreground">{t("room.admin.playlist.emptyPlaylist")}</li>
                        ) : playlistFiltering && !filteredItems.length ? (
                          <li className="py-12 text-center text-sm text-muted-foreground">{t("room.admin.playlist.noResults")}</li>
                        ) : (
                          filteredItems.map((item, index) => {
                            const trackId = item.track_detail?.id ?? item.track;
                            return (
                              <li
                                key={item.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30",
                                  dragItemId === item.id && "opacity-50",
                                )}
                                draggable={canManage && !playlistFiltering}
                                onDragStart={(e) => onDragStart(e, item.id)}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDropRow(e, index)}
                              >
                                {canManage ? (
                                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />
                                ) : (
                                  <span className="w-6 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.track_detail?.title ?? `Track #${item.track}`}</p>
                                  {item.track_detail?.artist ? (
                                    <p className="truncate text-xs text-muted-foreground">{item.track_detail.artist}</p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center">
                                  {actionTip(
                                    t("room.admin.playlist.tip.similar"),
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={cn(rowBtn, similarAnchorId === trackId && "text-brand")}
                                      aria-label={t("room.admin.playlist.tip.similar")}
                                      onClick={() => setSimilarAnchorId((prev) => (prev === trackId ? null : trackId))}
                                    >
                                      <Sparkles className="size-4" />
                                    </Button>,
                                  )}
                                  {canManage ? (
                                    <>
                                      {actionTip(
                                        t("room.admin.playlist.tip.playFromHere"),
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className={rowBtn}
                                          disabled={playingTrackId === trackId}
                                          aria-label={t("room.admin.playlist.tip.playFromHere")}
                                          onClick={() => void handlePlayTrackOnChannelById(trackId, item.track_detail?.title, index)}
                                        >
                                          {playingTrackId === trackId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                                        </Button>,
                                      )}
                                      {actionTip(
                                        t("room.admin.playlist.tip.playOnly"),
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className={rowBtn}
                                          disabled={playingTrackId === trackId}
                                          aria-label={t("room.admin.playlist.tip.playOnly")}
                                          onClick={() => void handlePlayTrackOnly(trackId, item.track_detail?.title)}
                                        >
                                          <PlayCircle className="size-4" />
                                        </Button>,
                                      )}
                                      {actionTip(
                                        t("room.admin.playlist.tip.addToQueue"),
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className={rowBtn}
                                          aria-label={t("room.admin.playlist.tip.addToQueue")}
                                          onClick={() => enqueueTrack(trackId, false)}
                                        >
                                          <ListPlus className="size-4" />
                                        </Button>,
                                      )}
                                      {actionTip(
                                        t("room.admin.playlist.tip.removeFromPlaylist"),
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className={cn(rowBtn, "hover:text-destructive")}
                                          aria-label={t("room.admin.playlist.tip.removeFromPlaylist")}
                                          onClick={() => void handleRemoveItem(item.id)}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>,
                                      )}
                                    </>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </ScrollArea>

                    {similarAnchorId ? (
                      <div className="shrink-0 border-t border-border/40 pt-3">
                        <p className="text-xs font-medium text-brand">{t("room.admin.playlist.similar")}</p>
                        {similarBusy ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : similarTracks.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">{t("room.admin.playlist.similarEmpty")}</p>
                        ) : (
                          <ul className="mt-2 max-h-36 space-y-0.5 overflow-y-auto">
                            {similarTracks.map((tr) => (
                              <li key={tr.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30">
                                <span className="min-w-0 flex-1 truncate text-sm">{tr.title}</span>
                                {canManage && sendSocketMessage ? (
                                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                                    const ok = sendSocketMessage({ action: "add_to_queue", track_id: tr.id });
                                    if (!ok) showToast("Live socket not connected.", "error");
                                    else showToast(`Queued "${tr.title}".`, "success");
                                  }}>
                                    {t("room.admin.playlist.queue")}
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {status ? (
        <div className="shrink-0 border-t border-border/40 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      ) : null}

      {canManage ? (
        <ImportPlaylistToChannelDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          channelId={channelId}
          onComplete={refreshPlaylists}
        />
      ) : null}
    </div>
  );
}
