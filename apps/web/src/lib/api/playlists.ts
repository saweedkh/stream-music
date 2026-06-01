import { getApiBase, withAuthHeaders, extractApiError } from "./client";
import type {
  PlaylistSummary,
  PlaylistItemSummary,
  CopyPlaylistToChannelResult,
  PlaylistShareLinkInfo,
} from "./types";

export type PlaylistBackupPayload = {
  format: string;
  version: number;
  exported_at: string;
  username: string;
  playlist_count: number;
  playlists: Array<{
    id: number;
    name: string;
    channel_id: number | null;
    channel_name: string | null;
    items: Array<{ position: number; track_id: number; title: string; artist: string }>;
  }>;
};

export async function exportPlaylistBackup(): Promise<PlaylistBackupPayload> {
  const res = await fetch(`${getApiBase()}/api/playlists/backup-export`, await withAuthHeaders());
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot export playlist backup"));
  return (await res.json()) as PlaylistBackupPayload;
}

export async function importPlaylistBackup(data: Record<string, unknown>) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/backup-import`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(data) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot import playlist backup"));
  return (await res.json()) as {
    ok: boolean;
    created_playlists: number;
    created_items: number;
    skipped_items: number;
    errors: string[];
  };
}

export function downloadPlaylistBackupJson(payload: PlaylistBackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = payload.exported_at.slice(0, 10) || "backup";
  const a = document.createElement("a");
  a.href = url;
  a.download = `stream-music-playlists-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function listPlaylists(channelId?: string, options?: { favorited?: boolean }) {
  const params = new URLSearchParams();
  if (channelId != null && channelId !== "") params.set("channel", channelId);
  if (options?.favorited) params.set("favorited", "true");
  const qs = params.toString();
  const url = `${getApiBase()}/api/playlists/${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlists");
  return (await res.json()) as PlaylistSummary[];
}

export async function setPlaylistFavorite(playlistId: number, favorited: boolean): Promise<{ is_favorited: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/favorite/`,
    await withAuthHeaders({ method: favorited ? "POST" : "DELETE", body: "{}" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update favorite"));
  return (await res.json()) as { is_favorited: boolean };
}

export async function createPlaylist(payload: { name: string; channel?: number | null }) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ name: payload.name, channel: payload.channel ?? null }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create playlist"));
  return (await res.json()) as PlaylistSummary;
}

export async function listPlaylistItems(playlistId?: number) {
  let url = `${getApiBase()}/api/playlist-items/`;
  if (playlistId != null && !Number.isNaN(playlistId)) {
    url += `?playlist=${playlistId}`;
  }
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlist items");
  return (await res.json()) as PlaylistItemSummary[];
}

export async function addPlaylistItem(payload: { playlist: number; track: number; position: number }) {
  const res = await fetch(`${getApiBase()}/api/playlist-items/`, await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error("Cannot add playlist item");
  return (await res.json()) as PlaylistItemSummary;
}

/** Server caps each request (see PLAYLIST_BULK_ADD_MAX); send smaller chunks for very large selections. */
export async function bulkAddTracksToPlaylist(playlistId: number, trackIds: number[]) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/add-tracks/`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot add tracks to playlist"));
  return (await res.json()) as { added: number; requested: number; skipped_not_allowed: number };
}

export async function reorderPlaylistItem(itemId: number, position: number) {
  const res = await fetch(
    `${getApiBase()}/api/playlist-items/${itemId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  if (!res.ok) throw new Error("Cannot reorder playlist item");
  return (await res.json()) as PlaylistItemSummary;
}

export async function deletePlaylistItem(itemId: number) {
  const res = await fetch(`${getApiBase()}/api/playlist-items/${itemId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove track from playlist"));
}

export async function deletePlaylist(playlistId: number) {
  const res = await fetch(`${getApiBase()}/api/playlists/${playlistId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete playlist"));
}

export async function copyPlaylistToChannel(
  playlistId: number,
  payload: { channel_id: number; name?: string },
) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/copy-to-channel/`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot copy playlist to channel"));
  return (await res.json()) as CopyPlaylistToChannelResult;
}

export async function assignPlaylistToChannel(playlistId: number, payload: { channel_id: number }) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/assign-to-channel/`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot link playlist to channel"));
  return (await res.json()) as PlaylistSummary;
}

export async function updatePlaylist(playlistId: number, payload: { name?: string; channel?: number | null }) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update playlist"));
  return (await res.json()) as PlaylistSummary;
}

export async function getPlaylistShareLink(playlistId: number): Promise<PlaylistShareLinkInfo> {
  const res = await fetch(`${getApiBase()}/api/playlists/${playlistId}/share`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load share link");
  return (await res.json()) as PlaylistShareLinkInfo;
}

export async function createPlaylistShareLink(
  playlistId: number,
  payload?: { privacy?: string; expires_in_hours?: number },
): Promise<PlaylistShareLinkInfo & { token: string; share_url: string }> {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/share`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload ?? {}) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create share link"));
  return (await res.json()) as PlaylistShareLinkInfo & { token: string; share_url: string };
}

export async function previewPlaylistShare(token: string) {
  const res = await fetch(`${getApiBase()}/api/playlists/share/${token}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Invalid share link"));
  return (await res.json()) as {
    playlist: PlaylistSummary;
    owner_username: string;
    items: PlaylistItemSummary[];
    item_count: number;
  };
}

export async function importPlaylistShareToChannel(channelId: string, shareToken: string, name?: string) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/playlists/import-share`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ share_token: shareToken, name }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Import failed"));
  return (await res.json()) as { playlist: PlaylistSummary };
}
