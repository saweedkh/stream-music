"use client";

import { GripVertical, ListMusic, Loader2, Plus, Shuffle, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-provider";
import {
  addPlaylistItem,
  createPlaylist,
  deletePlaylist,
  deletePlaylistItem,
  listPlaylistItems,
  listPlaylists,
  listTracks,
  reorderPlaylistItem,
  shufflePlayInChannel,
  uploadTrackChunked,
  type PlaylistItemSummary,
  type PlaylistSummary,
  type TrackSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  canManage: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
};

export function ChannelPlaylistPanel({ channelId, canManage, sendSocketMessage }: Props) {
  const { showToast } = useToast();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [items, setItems] = useState<PlaylistItemSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<TrackSummary["visibility"]>("private");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [shuffling, setShuffling] = useState(false);

  const selectedPlaylist = playlists.find((p) => String(p.id) === selectedPlaylistId);
  const trackMap = Object.fromEntries(tracks.map((t) => [t.id, t]));

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

  const refreshTracks = useCallback(async () => {
    try {
      const all = await listTracks();
      setTracks(all);
    } catch {
      showToast("Cannot load tracks.", "error");
    }
  }, [showToast]);

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
    void refreshTracks();
  }, [refreshPlaylists, refreshTracks]);

  useEffect(() => {
    void loadItems(selectedPlaylistId);
  }, [selectedPlaylistId, loadItems]);

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
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot create playlist.", "error");
    } finally {
      setIsCreatingPlaylist(false);
    }
  }

  async function handleAddTrack() {
    if (!selectedPlaylistId) {
      showToast("Select a playlist first.", "error");
      return;
    }
    if (!selectedTrackId) {
      showToast("Select a track.", "error");
      return;
    }
    setIsAddingTrack(true);
    try {
      const nextPosition = items.length;
      await addPlaylistItem({
        playlist: Number(selectedPlaylistId),
        track: Number(selectedTrackId),
        position: nextPosition,
      });
      setSelectedTrackId("");
      showToast("Track added to playlist.", "success");
      await loadItems(selectedPlaylistId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot add track.", "error");
    } finally {
      setIsAddingTrack(false);
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

  function startPlaylist(playlistId: number, playlistName?: string) {
    const sent = sendSocketMessage?.({ action: "play_playlist", playlist_id: playlistId });
    if (!sent) {
      showToast("Socket not connected.", "error");
      return;
    }
    setStatus(`Queued "${playlistName ?? "playlist"}" for playback.`);
    showToast(`Playing "${playlistName ?? "playlist"}".`, "success");
  }

  async function handleShuffleApi() {
    setShuffling(true);
    try {
      await shufflePlayInChannel(channelId, { limit: 60 });
      setStatus("Shuffle queue loaded. Playback starts from the dock.");
      showToast("Shuffle: random tracks from your library are now in the queue.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shuffle failed.";
      setStatus(message);
      showToast(message, "error");
    } finally {
      setShuffling(false);
    }
  }

  function handleShuffleSocket() {
    const sent = sendSocketMessage?.({ action: "shuffle_play", limit: 60 });
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
      await uploadTrackChunked(
        { title: uploadTitle.trim(), visibility: uploadVisibility, file: uploadFile },
        { onProgress: (p) => setUploadProgress(p) },
      );
      showToast("Upload complete.", "success");
      setUploadTitle("");
      setUploadFile(null);
      setUploadProgress(null);
      await refreshTracks();
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

  return (
    <Card className="border-zinc-800/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
      <CardHeader className="border-b border-zinc-800/80 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-950/40 text-emerald-400">
              <ListMusic className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle className="text-lg">Playlists</CardTitle>
              <CardDescription>
                {canManage
                  ? "Build channel playlists, upload audio, shuffle your library, or send a list to the live queue."
                  : "Browse tracks in each playlist. Playback is controlled from the player by DJs."}
              </CardDescription>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={shuffling}
                onClick={() => handleShuffleSocket()}
              >
                {shuffling ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
                Shuffle library
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {loadingLists ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            Loading playlists…
          </p>
        ) : null}

        {canManage ? (
          <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">Quick upload</p>
            <p className="mb-3 text-xs text-zinc-500">Uploads stream over the network with progress (multipart).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`ch-${channelId}-up-title`}>Title</Label>
                <Input
                  id={`ch-${channelId}-up-title`}
                  value={uploadTitle}
                  valid={Boolean(uploadTitle.trim())}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Track title"
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
                  <option value="shared_with_channels">Shared with channels</option>
                  <option value="shared_with_users">Shared with users</option>
                  <option value="public_lan">Public (LAN)</option>
                </Select>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor={`ch-${channelId}-up-file`}>Audio file</Label>
              <Input
                id={`ch-${channelId}-up-file`}
                type="file"
                accept="audio/*"
                className="cursor-pointer"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {uploadProgress !== null && isUploading ? (
              <div className="mt-3 space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-zinc-500">{uploadProgress}%</p>
              </div>
            ) : null}
            <Button type="button" className="mt-3 gap-1.5" disabled={isUploading} onClick={() => void handleUpload()}>
              <Upload className="size-4" />
              {isUploading ? "Uploading…" : "Upload track"}
            </Button>
          </section>
        ) : null}

        {canManage ? (
          <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">New playlist for this channel</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={`ch-${channelId}-pl-name`}>Name</Label>
                <Input
                  id={`ch-${channelId}-pl-name`}
                  value={newPlaylistName}
                  valid={Boolean(newPlaylistName.trim())}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Warm-up set"
                />
              </div>
              <Button type="button" onClick={() => void handleCreatePlaylist()} disabled={isCreatingPlaylist}>
                {isCreatingPlaylist ? "…" : "Create"}
              </Button>
            </div>
          </section>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`ch-${channelId}-pick-pl`}>Playlist</Label>
          <Select
            id={`ch-${channelId}-pick-pl`}
            value={selectedPlaylistId}
            valid={Boolean(selectedPlaylistId)}
            onChange={(e) => setSelectedPlaylistId(e.target.value)}
          >
            <option value="">{playlists.length ? "Select…" : "No playlists yet"}</option>
            {playlists.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
                {p.is_auto_generated ? " (auto)" : ""}
              </option>
            ))}
          </Select>
        </div>

        {canManage && selectedPlaylistId ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => startPlaylist(Number(selectedPlaylistId), selectedPlaylist?.name)}>
              Play on channel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeletePlaylist()}>
              <Trash2 className="size-4" />
              Delete playlist
            </Button>
          </div>
        ) : null}

        {!canManage && playlists.length > 0 ? (
          <p className="text-xs text-zinc-500">Select a playlist to see its tracks. Playback is controlled by channel moderators.</p>
        ) : null}

        {selectedPlaylistId ? (
          <div className="space-y-3">
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-200">
                Tracks <span className="text-zinc-500">({items.length})</span>
              </p>
              {loadingItems ? <Loader2 className="size-4 animate-spin text-zinc-500" /> : null}
            </div>

            {canManage ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`ch-${channelId}-add-tr`}>Add track</Label>
                  <Select
                    id={`ch-${channelId}-add-tr`}
                    value={selectedTrackId}
                    valid={Boolean(selectedTrackId)}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                  >
                    <option value="">Select track from library</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="button" variant="secondary" className="gap-1" disabled={isAddingTrack} onClick={() => void handleAddTrack()}>
                  <Plus className="size-4" />
                  {isAddingTrack ? "…" : "Add"}
                </Button>
              </div>
            ) : null}

            <ScrollArea className="h-[min(320px,45vh)] rounded-lg border border-zinc-800/80">
              <div className="space-y-1 p-3 pr-2">
                {!items.length && !loadingItems ? (
                  <p className="py-6 text-center text-sm text-zinc-500">Empty playlist.</p>
                ) : (
                  items.map((item, index) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-2 py-2 text-sm",
                        dragItemId === item.id && "opacity-60",
                      )}
                      draggable={canManage}
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
                      {canManage ? (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => void handleRemoveItem(item.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        {canManage && playlists.length > 1 ? (
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Play quickly</p>
            <div className="flex flex-wrap gap-2">
              {playlists.slice(0, 8).map((p) => (
                <Button key={p.id} type="button" variant="secondary" size="sm" onClick={() => startPlaylist(p.id, p.name)}>
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {status ? <Alert>{status}</Alert> : null}
      </CardContent>
    </Card>
  );
}
