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
  Trash2,
  X,
} from "lucide-react";
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
import { useToast } from "@/components/ui/toast-provider";
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
const VIS_LABELS: Record<TrackSummary["visibility"], string> = {
  private: "Private",
  shared_with_users: "Shared",
  shared_with_channels: "Channel",
  public_lan: "Public LAN",
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

  // ─── data loading ─────────────────────────────────────────────────────────
  const fetchLibrary = useCallback(
    async (search: string, offset: number) => {
      setLibLoading(true);
      try {
        const result = await listTracks({ search, limit: LIB_PAGE, offset } as Parameters<typeof listTracks>[0] & { offset?: number });
        if (Array.isArray(result)) {
          setLibraryTracks(result as TrackSummary[]);
          setLibraryTotal((result as TrackSummary[]).length);
        } else {
          const r = result as { results: TrackSummary[]; total: number };
          setLibraryTracks(r.results);
          setLibraryTotal(r.total);
        }
      } catch {
        showToast("Cannot load tracks", "error");
      } finally {
        setLibLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    setLibOffset(0);
    void fetchLibrary(debouncedLibQuery, 0);
  }, [debouncedLibQuery, fetchLibrary]);

  const refreshMeta = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([listChannels(), listPlaylists()]);
      setChannels(c);
      setPlaylists(p);
    } catch {
      showToast("Cannot refresh data", "error");
    }
  }, [showToast]);

  const refreshItems = useCallback(async () => {
    try {
      const items = await listPlaylistItems();
      setAllItems(items);
    } catch {
      showToast("Cannot refresh playlist items", "error");
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
      showToast("Playlist created", "success");
      setNewPlaylistName("");
      setNewPlaylistChannel("none");
      setShowCreatePlaylist(false);
      await refreshMeta();
      setSelectedPlaylistId(pl.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot create playlist", "error");
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
      showToast("Playlist renamed", "success");
      await refreshMeta();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot rename playlist", "error");
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
      showToast("Playlist deleted", "success");
      if (selectedPlaylistId === deletePlaylistId) setSelectedPlaylistId(null);
      await Promise.all([refreshMeta(), refreshItems()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot delete playlist", "error");
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
      showToast(`${ids.length} track(s) added to playlist`, "success");
      setSelectedTrackIds(new Set());
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bulk add failed", "error");
    } finally {
      setBulkAdding(false);
      setBulkProgress(0);
    }
  }

  // ─── single add ───────────────────────────────────────────────────────────
  async function handleAddSingle(trackId: number) {
    if (!selectedPlaylistId) {
      showToast("Select a playlist first", "error");
      return;
    }
    try {
      const position = playlistItems.length;
      await addPlaylistItem({ playlist: selectedPlaylistId, track: trackId, position });
      showToast("Track added", "success");
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot add track", "error");
    }
  }

  // ─── remove item from playlist ────────────────────────────────────────────
  async function handleRemoveItem(itemId: number) {
    try {
      await deletePlaylistItem(itemId);
      showToast("Track removed from playlist", "success");
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot remove track", "error");
    }
  }

  // ─── drag reorder ─────────────────────────────────────────────────────────
  async function handleDrop(dropIndex: number) {
    if (!draggingItemId) return;
    try {
      await reorderPlaylistItem(draggingItemId, dropIndex);
      await refreshItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot reorder", "error");
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
      showToast("Track updated", "success");
      setEditTrack(null);
      await fetchLibrary(debouncedLibQuery, libOffset);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot update track", "error");
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
      showToast("Track deleted", "success");
      setDeleteTrackTarget(null);
      await Promise.all([fetchLibrary(debouncedLibQuery, libOffset), refreshItems()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cannot delete track", "error");
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
      showToast("Title and file are required", "error");
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
      showToast("Track uploaded", "success");
      setUploadTitle("");
      setUploadFile(null);
      setUploadProgress(100);
      setShowUpload(false);
      await fetchLibrary(debouncedLibQuery, libOffset);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const allLibSelected = libraryTracks.length > 0 && libraryTracks.every((t) => selectedTrackIds.has(t.id));

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* ── Sidebar: playlists list ──────────────────────────────────────── */}
      <aside className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Playlists</h2>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-emerald-400 hover:text-emerald-300" onClick={() => setShowCreatePlaylist(true)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-260px)] min-h-[200px]">
          <div className="space-y-1 pr-1">
            {playlists.length === 0 && <p className="px-2 text-xs text-zinc-500">No playlists yet.</p>}
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                  selectedPlaylistId === pl.id
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                }`}
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setPlaylistQuery("");
                }}
              >
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
                    className="w-full min-w-0 rounded bg-zinc-900 px-1 text-sm text-zinc-100 outline outline-1 outline-emerald-500/60"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">{pl.name}</span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="rounded p-0.5 hover:text-zinc-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingPlaylistId(pl.id);
                      setRenameValue(pl.name);
                    }}
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 hover:text-rose-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePlaylistId(pl.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-col gap-4">
        {/* ── Track library ─────────────────────────────────────────────── */}
        <Card className="border-zinc-800/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                <Music className="mr-1.5 inline h-4 w-4 opacity-60" />
                Track Library
                {libraryTotal > 0 && <span className="ml-2 text-xs font-normal text-zinc-500">({libraryTotal} tracks)</span>}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-zinc-400 hover:text-zinc-200" onClick={() => setShowUpload((v) => !v)}>
                  <Plus className="h-4 w-4" />
                  Upload
                  <ChevronDown className={`h-3 w-3 transition-transform ${showUpload ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>
            {/* Upload form (collapsible) */}
            {showUpload && (
              <div className="mt-3 grid gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input className="h-8 text-sm" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Track title" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Visibility</Label>
                  <Select
                    className="h-8 text-sm"
                    value={uploadVisibility}
                    valid={Boolean(uploadVisibility)}
                    onChange={(e) => setUploadVisibility(e.target.value as TrackSummary["visibility"])}
                  >
                    <option value="private">Private</option>
                    <option value="shared_with_users">Shared with users</option>
                    <option value="shared_with_channels">Shared with channels</option>
                    <option value="public_lan">Public LAN</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <div
                    className="mb-2 rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/60 px-4 py-3 text-center text-xs text-zinc-500 transition hover:border-emerald-500/40"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFileSelect(e.dataTransfer.files?.[0] ?? null);
                    }}
                  >
                    {uploadFile ? uploadFile.name : "Drag & drop audio file here"}
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="mb-2 w-full rounded border border-zinc-700/80 bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                  {uploading && (
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  <Button size="sm" className="w-full" disabled={uploading} onClick={handleUpload}>
                    {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {/* Search + select all */}
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Search by title or artist…"
                  value={libQuery}
                  onChange={(e) => setLibQuery(e.target.value)}
                />
                {libQuery && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300" onClick={() => setLibQuery("")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {libraryTracks.length > 0 && (
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/60 transition hover:border-emerald-500/50"
                  title={allLibSelected ? "Deselect all" : "Select all on page"}
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
                  {allLibSelected ? <Check className="h-4 w-4 text-emerald-400" /> : <Check className="h-4 w-4 text-zinc-600" />}
                </button>
              )}
            </div>

            {/* Selection bar */}
            {selectedTrackIds.size > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
                <span>{selectedTrackIds.size} selected</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                    onClick={() => setSelectedTrackIds(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-emerald-600 px-3 hover:bg-emerald-500"
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
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : libraryTracks.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                {libQuery ? "No tracks match your search." : "No tracks yet. Upload your first track."}
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
                          ? "border-emerald-500/40 bg-emerald-950/30"
                          : "border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-700/80"
                      }`}
                    >
                      <button
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          selected
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-700 hover:border-emerald-500/60"
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

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{track.title}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {track.artist || <span className="italic">No artist</span>}
                          {track.album ? ` · ${track.album}` : ""}
                        </p>
                      </div>

                      <Badge variant={VIS_TONE[track.visibility]} className="hidden shrink-0 text-xs sm:flex">
                        {VIS_LABELS[track.visibility]}
                      </Badge>

                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="rounded p-1 text-zinc-400 hover:text-emerald-400"
                          title="Add to selected playlist"
                          onClick={() => void handleAddSingle(track.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1 text-zinc-400 hover:text-zinc-200"
                          title="Edit track"
                          onClick={() => openEditTrack(track)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1 text-zinc-400 hover:text-rose-400"
                          title="Delete track"
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
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
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
          <Card className="border-zinc-800/90">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="flex-1 text-base">
                  <ListMusic className="mr-1.5 inline h-4 w-4 opacity-60" />
                  {selectedPlaylist.name}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    ({playlistItems.length} track{playlistItems.length !== 1 ? "s" : ""})
                  </span>
                </CardTitle>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Search in playlist…"
                  value={playlistQuery}
                  onChange={(e) => setPlaylistQuery(e.target.value)}
                />
                {playlistQuery && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300" onClick={() => setPlaylistQuery("")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredPlaylistItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">
                  {isFiltering ? "No tracks match your search." : "No tracks in this playlist. Add some from the library above."}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {filteredPlaylistItems.map((item, index) => {
                    const t = item.track_detail;
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2 transition-colors hover:border-zinc-700/80"
                        draggable={!isFiltering}
                        onDragStart={() => setDraggingItemId(item.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => void handleDrop(index)}
                      >
                        <GripVertical className={`h-4 w-4 shrink-0 text-zinc-600 ${isFiltering ? "opacity-20" : "cursor-grab"}`} />
                        <span className="w-5 shrink-0 text-center text-xs text-zinc-600">{item.position + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-100">{t ? t.title : `Track #${item.track}`}</p>
                          {t && (
                            <p className="truncate text-xs text-zinc-500">
                              {t.artist || <span className="italic">No artist</span>}
                              {t.album ? ` · ${t.album}` : ""}
                            </p>
                          )}
                        </div>
                        <button
                          className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                          title="Remove from playlist"
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
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-zinc-800/60 text-sm text-zinc-600">
            Select a playlist to see its tracks
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Create playlist */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
            <DialogDescription>Give your playlist a name and optionally attach it to a channel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                placeholder="My playlist"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreatePlaylist(); }}
              />
            </div>
            <div className="space-y-1">
              <Label>Channel (optional)</Label>
              <Select
                value={newPlaylistChannel}
                valid={newPlaylistChannel !== "none"}
                onChange={(e) => setNewPlaylistChannel(e.target.value)}
              >
                <option value="none">No channel (private)</option>
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
              Cancel
            </Button>
            <Button disabled={!newPlaylistName.trim() || createBusy} onClick={handleCreatePlaylist}>
              {createBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete playlist */}
      <Dialog open={deletePlaylistId !== null} onOpenChange={(open) => { if (!open) setDeletePlaylistId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Playlist</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <strong>{playlists.find((p) => p.id === deletePlaylistId)?.name}</strong> and remove all its tracks. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletePlaylistId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletePlBusy} onClick={confirmDeletePlaylist}>
              {deletePlBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit track */}
      <Dialog open={editTrack !== null} onOpenChange={(open) => { if (!open) setEditTrack(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Artist</Label>
              <Input value={editArtist} onChange={(e) => setEditArtist(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Album</Label>
              <Input value={editAlbum} onChange={(e) => setEditAlbum(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Visibility</Label>
              <Select value={editVisibility} valid onChange={(e) => setEditVisibility(e.target.value as TrackSummary["visibility"])}>
                <option value="private">Private</option>
                <option value="shared_with_users">Shared with users</option>
                <option value="shared_with_channels">Shared with channels</option>
                <option value="public_lan">Public LAN</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTrack(null)}>
              Cancel
            </Button>
            <Button disabled={editTrackBusy} onClick={saveEditTrack}>
              {editTrackBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete track */}
      <Dialog open={deleteTrackTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTrackTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Track</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTrackTarget?.title}</strong>? This will also remove it from all playlists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTrackTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteTrackBusy} onClick={confirmDeleteTrack}>
              {deleteTrackBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
