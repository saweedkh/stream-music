"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Create Playlist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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

        <div className="space-y-1 text-xs text-slate-300">
          {playlists.map((playlist) => (
            <p key={playlist.id}>
              {playlist.name} {playlist.channel ? `(channel ${playlist.channel})` : "(private)"}
            </p>
          ))}
        </div>

        <div className="mt-2 space-y-2 rounded-md border border-slate-800 p-3">
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
          <div className="space-y-1 text-xs text-slate-400">
            {Object.entries(groupedPlaylistItems).map(([playlistId, items]) => (
              <div key={playlistId} className="rounded border border-slate-800 p-2">
                <p className="mb-2 text-slate-300">Playlist {playlistId}</p>
                {items.map((item, dropIndex) => (
                  <div
                    key={item.id}
                    className="mb-1 rounded bg-slate-900/70 p-2"
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
