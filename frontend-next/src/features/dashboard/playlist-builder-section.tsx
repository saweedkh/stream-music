"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ChannelSummary, PlaylistItemSummary, PlaylistSummary, TrackSummary } from "@/lib/api";

type Props = {
  channels: ChannelSummary[];
  playlists: PlaylistSummary[];
  tracks: TrackSummary[];
  groupedPlaylistItems: Record<number, PlaylistItemSummary[]>;
  playlistName: string;
  playlistChannel: string;
  itemPlaylistId: string;
  itemTrackId: string;
  errors: { playlistName?: string };
  onPlaylistNameChange: (value: string) => void;
  onPlaylistChannelChange: (value: string) => void;
  onItemPlaylistIdChange: (value: string) => void;
  onItemTrackIdChange: (value: string) => void;
  onCreatePlaylist: () => void;
  onAddPlaylistItem: () => void;
  onReorderDrop: (draggingId: number, dropIndex: number) => Promise<void>;
  setDraggingPlaylistItemId: (id: number | null) => void;
  draggingPlaylistItemId: number | null;
};

export function PlaylistBuilderSection(props: Props) {
  const {
    channels,
    playlists,
    tracks,
    groupedPlaylistItems,
    playlistName,
    playlistChannel,
    itemPlaylistId,
    itemTrackId,
    errors,
    onPlaylistNameChange,
    onPlaylistChannelChange,
    onItemPlaylistIdChange,
    onItemTrackIdChange,
    onCreatePlaylist,
    onAddPlaylistItem,
    onReorderDrop,
    setDraggingPlaylistItemId,
    draggingPlaylistItemId,
  } = props;

  return (
    <Card className="border-zinc-800/90">
      <CardHeader>
        <CardTitle className="text-lg">Playlist builder</CardTitle>
        <CardDescription>Create playlists, attach them to a channel, and reorder items by drag and drop.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Playlist name</Label>
          <Input value={playlistName} aria-invalid={Boolean(errors.playlistName)} valid={Boolean(playlistName.trim())} onChange={(e) => onPlaylistNameChange(e.target.value)} />
          {errors.playlistName ? <p className="text-xs text-rose-400">{errors.playlistName}</p> : null}
        </div>
        <div className="space-y-1">
          <Label>Attach to channel</Label>
          <Select value={playlistChannel} valid={Boolean(playlistChannel)} onChange={(e) => onPlaylistChannelChange(e.target.value)}>
            <option value="none">No channel (private playlist)</option>
            {channels.map((channel) => (
              <option key={channel.id} value={String(channel.id)}>
                {channel.name} (#{channel.id})
              </option>
            ))}
          </Select>
        </div>
        <Button className="w-full" onClick={onCreatePlaylist}>
          Create Playlist
        </Button>

        <div className="space-y-1 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
          {playlists.map((playlist) => (
            <p key={playlist.id}>
              {playlist.name} {playlist.channel ? `(channel ${playlist.channel})` : "(private)"}
            </p>
          ))}
        </div>

        <div className="mt-2 space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <Label>Add track to playlist</Label>
          <Select value={itemPlaylistId} valid={Boolean(itemPlaylistId)} onChange={(e) => onItemPlaylistIdChange(e.target.value)}>
            <option value="">Select playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={String(playlist.id)}>
                {playlist.name} (#{playlist.id})
              </option>
            ))}
          </Select>
          <Select value={itemTrackId} valid={Boolean(itemTrackId)} onChange={(e) => onItemTrackIdChange(e.target.value)}>
            <option value="">Select track</option>
            {tracks.map((track) => (
              <option key={track.id} value={String(track.id)}>
                {track.title} (#{track.id})
              </option>
            ))}
          </Select>
          <Button variant="secondary" className="w-full" onClick={onAddPlaylistItem}>
            Add Item
          </Button>
          <div className="space-y-1 text-xs text-zinc-500">
            {Object.entries(groupedPlaylistItems).map(([playlistId, items]) => (
              <div key={playlistId} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5">
                <p className="mb-2 text-zinc-300">Playlist {playlistId}</p>
                {items.map((item, dropIndex) => (
                  <div
                    key={item.id}
                    className="mb-1 rounded-lg border border-zinc-700/70 bg-zinc-900/60 p-2 transition-colors hover:border-zinc-600/80"
                    draggable
                    onDragStart={() => setDraggingPlaylistItemId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async () => {
                      if (!draggingPlaylistItemId || draggingPlaylistItemId === item.id) return;
                      await onReorderDrop(draggingPlaylistItemId, dropIndex);
                      setDraggingPlaylistItemId(null);
                    }}
                  >
                    #{item.position} track {item.track}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
