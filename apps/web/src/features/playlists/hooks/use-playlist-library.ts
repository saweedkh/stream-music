"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPlaylist,
  deletePlaylist,
  getMe,
  listChannels,
  listPlaylists,
  setPlaylistFavorite,
  updatePlaylist,
  type ChannelSummary,
  type PlaylistSummary,
} from "@/lib/api";
import { filterPlaylistsByScope, filterPlaylistsBySearch, type PlaylistScope } from "@/features/playlists/model/playlist-filters";

export function usePlaylistLibrary(onError?: (message: string) => void) {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scope, setScope] = useState<PlaylistScope>("all");
  const [channelFilterId, setChannelFilterId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);

  const activeChannels = useMemo(
    () => channels.filter((ch) => ch.is_active !== false),
    [channels],
  );

  const refresh = useCallback(async () => {
    try {
      const favorited = scope === "favorites";
      const channelParam =
        scope === "channel" && channelFilterId != null ? String(channelFilterId) : undefined;
      const [c, p, me] = await Promise.all([
        listChannels(),
        listPlaylists(channelParam, { favorited: favorited || undefined }),
        getMe(),
      ]);
      setChannels(c);
      setPlaylists(p);
      setCurrentUserId(me?.user?.id ?? null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "refresh_failed");
    }
  }, [channelFilterId, onError, scope]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const visiblePlaylists = useMemo(() => {
    let rows = filterPlaylistsByScope(playlists, scope, channelFilterId);
    rows = filterPlaylistsBySearch(rows, search);
    return rows;
  }, [channelFilterId, playlists, scope, search]);

  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedId) ?? null,
    [playlists, selectedId],
  );

  const create = useCallback(
    async (name: string, channelId: number | null) => {
      const pl = await createPlaylist({ name, channel: channelId });
      await refresh();
      setSelectedId(pl.id);
      return pl;
    },
    [refresh],
  );

  const rename = useCallback(
    async (playlistId: number, name: string) => {
      await updatePlaylist(playlistId, { name });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (playlistId: number) => {
      await deletePlaylist(playlistId);
      if (selectedId === playlistId) setSelectedId(null);
      await refresh();
    },
    [refresh, selectedId],
  );

  const toggleFavorite = useCallback(
    async (playlistId: number, favorited: boolean) => {
      setFavoriteBusyId(playlistId);
      try {
        await setPlaylistFavorite(playlistId, favorited);
        if (scope === "favorites" && !favorited) {
          setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
          if (selectedId === playlistId) setSelectedId(null);
        } else {
          setPlaylists((prev) =>
            prev.map((p) => (p.id === playlistId ? { ...p, is_favorited: favorited } : p)),
          );
        }
      } finally {
        setFavoriteBusyId(null);
      }
    },
    [scope, selectedId],
  );

  const detachFromChannel = useCallback(
    async (playlistId: number) => {
      await updatePlaylist(playlistId, { channel: null });
      await refresh();
    },
    [refresh],
  );

  const attachToChannel = useCallback(
    async (playlistId: number, channelId: number) => {
      await updatePlaylist(playlistId, { channel: channelId });
      await refresh();
    },
    [refresh],
  );

  return {
    loading,
    channels,
    activeChannels,
    playlists: visiblePlaylists,
    allPlaylists: playlists,
    currentUserId,
    selectedId,
    selectedPlaylist,
    setSelectedId,
    scope,
    setScope,
    channelFilterId,
    setChannelFilterId,
    search,
    setSearch,
    favoriteBusyId,
    refresh,
    create,
    rename,
    remove,
    toggleFavorite,
    detachFromChannel,
    attachToChannel,
  };
}
