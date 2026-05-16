"use client";

import {
  GripVertical,
  Library,
  ListMusic,
  ListPlus,
  Loader2,
  Play,
  PlayCircle,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  playPlaylistInChannel,
  playTrackInChannel,
  reorderPlaylistItem,
  shufflePlayInChannel,
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

export function ChannelPlaylistPanel({ channelId, canManage, sendSocketMessage }: Props) {
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

  const selectedPlaylist = playlists.find((p) => String(p.id) === selectedPlaylistId);

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
        if (!cancelled) setLibraryTracks(rows);
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

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-950 via-zinc-950 to-emerald-950/15 shadow-2xl shadow-black/40 ring-1 ring-white/5">
      <div className="border-b border-zinc-800/80 bg-zinc-950/40 px-5 py-5 backdrop-blur-md sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-inner shadow-emerald-900/30">
              <Sparkles className="size-5" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">Channel playlists</h2>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
                {canManage
                  ? "Search your library by title or artist, queue playback on the channel, and curate playlists in bulk without freezing the UI."
                  : "Browse playlists and tracks. Playback is controlled by channel moderators."}
              </p>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 border-zinc-700/80 bg-zinc-900/80"
                disabled={shuffling}
                onClick={() => handleShuffleSocket()}
              >
                {shuffling ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
                Shuffle library
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-[440px] lg:grid-cols-[minmax(0,280px)_1fr]">
        <aside className="border-b border-zinc-800/80 bg-zinc-950/30 p-4 lg:border-b-0 lg:border-r lg:border-zinc-800/80">
          {loadingLists ? (
            <div className="space-y-2 py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-xl bg-zinc-800/55"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
          ) : null}

          {canManage ? (
            <div className="mb-4 space-y-2 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3">
              <Label htmlFor={`ch-${channelId}-pl-name`} className="text-xs uppercase tracking-wide text-zinc-500">
                New playlist
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`ch-${channelId}-pl-name`}
                  value={newPlaylistName}
                  valid={Boolean(newPlaylistName.trim())}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Warm-up set"
                  className="border-zinc-700/80 bg-zinc-950/80"
                />
                <Button type="button" size="sm" className="shrink-0" onClick={() => void handleCreatePlaylist()} disabled={isCreatingPlaylist}>
                  {isCreatingPlaylist ? <Loader2 className="size-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Playlists</p>
          <ScrollArea className="h-[min(280px,40vh)] lg:h-[min(360px,50vh)]">
            <div className="space-y-1.5 pr-2">
              {!playlists.length && !loadingLists ? (
                <p className="py-6 text-center text-sm text-zinc-500">No playlists yet.</p>
              ) : (
                playlists.map((p) => {
                  const active = String(p.id) === selectedPlaylistId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlaylistId(String(p.id));
                        setMainTab("playlist");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "border-emerald-500/40 bg-emerald-950/35 text-emerald-100 shadow-sm shadow-emerald-900/20"
                          : "border-transparent bg-zinc-900/30 text-zinc-300 hover:border-zinc-700/80 hover:bg-zinc-900/60",
                      )}
                    >
                      <ListMusic className="size-4 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      {p.is_auto_generated ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          auto
                        </Badge>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {canManage && playlists.length > 1 ? (
            <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-900/25 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Quick play</p>
              <div className="flex flex-wrap gap-1.5">
                {playlists.slice(0, 8).map((p) => (
                  <Button key={p.id} type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={() => startPlaylist(p.id, p.name)}>
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-col">
          {!selectedPlaylistId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <Library className="size-12 text-zinc-600" />
              <p className="text-sm text-zinc-400">Choose a playlist from the list to edit tracks or use the library search.</p>
            </div>
          ) : (
            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "library" | "playlist")} className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-100">{selectedPlaylist?.name ?? "Playlist"}</p>
                  <p className="text-xs text-zinc-500">{items.length} tracks in this list</p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="gap-1.5" onClick={() => startPlaylist(Number(selectedPlaylistId), selectedPlaylist?.name)}>
                      <Play className="size-3.5" />
                      Play on channel
                    </Button>
                    <Button type="button" variant="destructive" size="sm" className="gap-1" onClick={() => void handleDeletePlaylist()}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>

              <TabsList className="mt-4 w-full sm:w-auto">
                <TabsTrigger value="library" className="gap-2">
                  <Search className="size-3.5" />
                  Library
                </TabsTrigger>
                <TabsTrigger value="playlist" className="gap-2">
                  <ListMusic className="size-3.5" />
                  This playlist
                </TabsTrigger>
              </TabsList>

              <TabsContent value="library" className="mt-0 flex flex-1 flex-col">
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder="Search by track or artist…"
                    className="border-zinc-700/90 bg-zinc-900/50 pl-10"
                    valid
                    aria-label="Search tracks"
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Results are capped at {LIBRARY_SEARCH_LIMIT} matches per search. Bulk adds run in batches of {BULK_ADD_CHUNK} so large selections stay
                  responsive.
                </p>

                {canManage && selectedCount > 0 ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-emerald-100">
                      <span className="font-semibold">{selectedCount}</span> selected
                      {bulkProgress ? (
                        <span className="ml-2 text-emerald-200/80">
                          ({bulkProgress.done}/{bulkProgress.total})
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={selectAllVisible} disabled={!visibleIds.length}>
                        Select all results
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                      <Button type="button" size="sm" disabled={bulkAdding} onClick={() => void handleBulkAddToPlaylist()}>
                        {bulkAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        Add to playlist
                      </Button>
                    </div>
                  </div>
                ) : null}

                <ScrollArea className="mt-4 h-[min(280px,38vh)] flex-1 rounded-xl border border-zinc-800/80 sm:h-[min(320px,42vh)]">
                  <div className="p-2">
                    {!debouncedLibraryQuery ? (
                      <p className="py-10 text-center text-sm text-zinc-500">Type at least one character to search your accessible library.</p>
                    ) : libraryLoading ? (
                      <p className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                        <Loader2 className="size-4 animate-spin" />
                        Searching…
                      </p>
                    ) : !libraryTracks.length ? (
                      <p className="py-10 text-center text-sm text-zinc-500">No tracks match that search.</p>
                    ) : (
                      <ul className="space-y-1">
                        {libraryTracks.map((t) => {
                          const selected = selectedTrackIds.has(t.id);
                          return (
                            <li
                              key={t.id}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition-colors sm:gap-3",
                                selected ? "border-emerald-500/35 bg-emerald-950/20" : "border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-700/80",
                              )}
                            >
                              {canManage ? (
                                <input
                                  type="checkbox"
                                  className="size-4 shrink-0 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                                  checked={selected}
                                  onChange={() => toggleTrackSelection(t.id)}
                                  aria-label={`Select ${t.title}`}
                                />
                              ) : (
                                <span className="w-4 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-zinc-100">{t.title}</p>
                                <p className="truncate text-xs text-zinc-500">{t.artist || "Unknown artist"}</p>
                              </div>
                              {canManage ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-emerald-400 hover:text-emerald-300"
                                    title="Play on channel"
                                    disabled={playingTrackId === t.id}
                                    onClick={() => void handlePlayTrackOnChannel(t)}
                                  >
                                    {playingTrackId === t.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    title="Add to playlist"
                                    disabled={addingSingleId === t.id}
                                    onClick={() => void handleAddSingleToPlaylist(t.id)}
                                  >
                                    {addingSingleId === t.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                  </Button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </ScrollArea>

                {canManage && debouncedLibraryQuery && libraryTracks.length > 0 && selectedCount === 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
                      Select all {libraryTracks.length} results
                    </Button>
                  </div>
                ) : null}

                {canManage ? (
                  <div className="mt-6 space-y-3 rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Upload className="size-4 text-zinc-400" />
                      Upload audio
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`ch-${channelId}-up-title`}>Title</Label>
                        <Input
                          id={`ch-${channelId}-up-title`}
                          value={uploadTitle}
                          valid={Boolean(uploadTitle.trim())}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          className="border-zinc-700/80 bg-zinc-950/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`ch-${channelId}-up-vis`}>Visibility</Label>
                        <Select
                          id={`ch-${channelId}-up-vis`}
                          value={uploadVisibility}
                          valid
                          onChange={(e) => setUploadVisibility(e.target.value as TrackSummary["visibility"])}
                        >
                          <option value="private">Private</option>
                          <option value="shared_with_users">Shared with users</option>
                          <option value="shared_with_channels">Shared with channels</option>
                          <option value="public_lan">Public (LAN)</option>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ch-${channelId}-up-file`}>File</Label>
                      <Input id={`ch-${channelId}-up-file`} type="file" accept="audio/*" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                    </div>
                    {uploadProgress != null ? (
                      <p className="text-xs text-zinc-400">
                        Uploading… {uploadProgress}%{" "}
                        <span className="inline-block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-800 align-middle">
                          <span className="block h-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                        </span>
                      </p>
                    ) : null}
                    <Button type="button" variant="secondary" disabled={isUploading} onClick={() => void handleUpload()}>
                      {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      Upload
                    </Button>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="playlist" className="mt-0 flex flex-1 flex-col">
                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-300">
                    Order <span className="text-zinc-500">({items.length})</span>
                  </p>
                  {loadingItems ? <Loader2 className="size-4 shrink-0 animate-spin text-zinc-500" /> : null}
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={playlistQuery}
                    onChange={(e) => setPlaylistQuery(e.target.value)}
                    placeholder="Search inside this playlist…"
                    className="border-zinc-700/90 bg-zinc-900/50 pl-10"
                    aria-label="Search playlist tracks"
                    valid
                  />
                </div>
                {playlistFiltering ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Showing {filteredItems.length} result(s) for “{playlistQuery.trim()}”. Drag reorder is disabled while searching.
                  </p>
                ) : null}
                <ScrollArea className="mt-2 h-[min(280px,38vh)] flex-1 rounded-xl border border-zinc-800/80 sm:h-[min(360px,48vh)]">
                  <div className="space-y-1 p-3 pr-2">
                    {!items.length && !loadingItems ? (
                      <p className="py-8 text-center text-sm text-zinc-500">Empty playlist. Add tracks from the Library tab.</p>
                    ) : playlistFiltering && !filteredItems.length ? (
                      <p className="py-8 text-center text-sm text-zinc-500">No matches in this playlist.</p>
                    ) : (
                      filteredItems.map((item, index) => {
                        const trackId = item.track_detail?.id ?? item.track;
                        return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-2 py-2.5 text-sm",
                            dragItemId === item.id && "opacity-60",
                          )}
                          draggable={canManage && !playlistFiltering}
                          onDragStart={(e) => onDragStart(e, item.id)}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropRow(e, index)}
                        >
                          {canManage ? (
                            <span className="cursor-grab text-zinc-500 active:cursor-grabbing" title="Drag to reorder">
                              <GripVertical className="size-4" />
                            </span>
                          ) : (
                            <span className="w-6 text-center font-mono text-xs text-zinc-500">{index + 1}</span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-zinc-200">{item.track_detail?.title ?? `Track #${item.track}`}</span>
                          {item.track_detail?.artist ? (
                            <span className="hidden max-w-[28%] truncate text-xs text-zinc-500 sm:inline">{item.track_detail.artist}</span>
                          ) : null}
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              title="Same-artist picks from this channel"
                              onClick={() => setSimilarAnchorId((prev) => (prev === trackId ? null : trackId))}
                            >
                              <Sparkles className={cn("size-4", similarAnchorId === trackId && "text-emerald-400")} />
                            </Button>
                            {canManage ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Play from here — playlist continues"
                                  disabled={playingTrackId === trackId}
                                  onClick={() =>
                                    void handlePlayTrackOnChannelById(
                                      trackId,
                                      item.track_detail?.title,
                                      index,
                                    )
                                  }
                                >
                                  {playingTrackId === trackId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Play only this track"
                                  disabled={playingTrackId === trackId}
                                  onClick={() => void handlePlayTrackOnly(trackId, item.track_detail?.title)}
                                >
                                  <PlayCircle className="size-4 opacity-80" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Add to queue"
                                  onClick={() => enqueueTrack(trackId, false)}
                                >
                                  <ListPlus className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => void handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                {similarAnchorId ? (
                  <div className="mt-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">Same artist in this channel</p>
                    {similarBusy ? (
                      <div className="mt-3 flex justify-center py-2">
                        <Loader2 className="size-5 animate-spin text-emerald-400/80" />
                      </div>
                    ) : similarTracks.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-500">No other tracks from this artist appear in your channel playlists.</p>
                    ) : (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {similarTracks.map((t) => (
                          <li key={t.id} className="flex items-center gap-2 rounded-md border border-emerald-900/30 bg-zinc-950/40 px-2 py-1.5 text-sm">
                            <span className="min-w-0 flex-1 truncate text-zinc-100">{t.title}</span>
                            {canManage && sendSocketMessage ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 shrink-0 text-xs"
                                onClick={() => {
                                  const ok = sendSocketMessage({ action: "add_to_queue", track_id: t.id });
                                  if (!ok) showToast("Live socket not connected.", "error");
                                  else showToast(`Queued “${t.title}”.`, "success");
                                }}
                              >
                                Queue
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          )}
        </section>
      </div>

      {status ? (
        <div className="border-t border-zinc-800/80 px-5 py-3">
          <Alert>{status}</Alert>
        </div>
      ) : null}
    </div>
  );
}
