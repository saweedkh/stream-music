"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { listPlaylists, playPlaylistInChannel, type PlaylistSummary } from "@/lib/api";

export function ChannelPlaylistPanel({ channelId }: { channelId: string }) {
  const { showToast } = useToast();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    listPlaylists()
      .then((items) => setPlaylists(items))
      .catch(() => {
        setStatus("Cannot load playlists.");
        showToast("Cannot load playlists.", "error");
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playlist & Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label>Choose playlist</Label>
        <Select
          aria-invalid={!selected && Boolean(status?.toLowerCase().includes("failed"))}
          valid={Boolean(selected)}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select playlist</option>
          {playlists.map((playlist) => (
            <option key={playlist.id} value={String(playlist.id)}>
              {playlist.name} (#{playlist.id})
            </option>
          ))}
        </Select>
        <Button
          disabled={!selected}
          onClick={async () => {
            try {
              await playPlaylistInChannel(channelId, Number(selected));
              setStatus("Playlist playback started in channel.");
            } catch {
              setStatus("Failed to start playlist. Check permissions and playlist items.");
              showToast("Failed to start playlist.", "error");
            }
          }}
        >
          Play in this channel
        </Button>
        <div className="space-y-1 text-xs text-slate-300">
          {playlists.map((playlist) => (
            <p key={playlist.id}>
              {playlist.id}. {playlist.name} {playlist.channel ? `(channel ${playlist.channel})` : "(private)"}
            </p>
          ))}
        </div>
        {status ? <Alert>{status}</Alert> : null}
      </CardContent>
    </Card>
  );
}
