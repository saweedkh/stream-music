export type PlaylistScope = "all" | "personal" | "channel" | "favorites";

export function filterPlaylistsByScope<T extends { channel: number | null; is_favorited?: boolean }>(
  playlists: T[],
  scope: PlaylistScope,
  channelId: number | null,
): T[] {
  switch (scope) {
    case "personal":
      return playlists.filter((p) => p.channel == null);
    case "channel":
      if (channelId != null) return playlists.filter((p) => p.channel === channelId);
      return playlists.filter((p) => p.channel != null);
    case "favorites":
      return playlists.filter((p) => Boolean(p.is_favorited));
    default:
      return playlists;
  }
}

export function filterPlaylistsBySearch<T extends { name: string }>(playlists: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return playlists;
  return playlists.filter((p) => p.name.toLowerCase().includes(q));
}
