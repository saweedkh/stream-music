"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addPlaylistItem,
  bulkAddTracksToPlaylist,
  deletePlaylistItem,
  listPlaylistItems,
  reorderPlaylistItem,
  type PlaylistItemSummary,
} from "@/lib/api";

const BULK_CHUNK = 50;

export function usePlaylistItems(playlistId: number | null, onError?: (message: string) => void) {
  const [items, setItems] = useState<PlaylistItemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const refresh = useCallback(async () => {
    if (playlistId == null) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listPlaylistItems(playlistId);
      setItems(rows);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "items_failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [onError, playlistId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items],
  );

  const trackIdsInPlaylist = useMemo(() => new Set(items.map((i) => i.track)), [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((item) => {
      const td = item.track_detail;
      if (!td) return String(item.track).includes(q);
      return (
        td.title.toLowerCase().includes(q) ||
        (td.artist ?? "").toLowerCase().includes(q) ||
        (td.album ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, sortedItems]);

  const removeItem = useCallback(
    async (itemId: number) => {
      await deletePlaylistItem(itemId);
      await refresh();
    },
    [refresh],
  );

  const reorder = useCallback(
    async (itemId: number, dropIndex: number) => {
      await reorderPlaylistItem(itemId, dropIndex);
      await refresh();
    },
    [refresh],
  );

  const addSingle = useCallback(
    async (trackId: number) => {
      if (playlistId == null) return;
      await addPlaylistItem({ playlist: playlistId, track: trackId, position: sortedItems.length });
      await refresh();
    },
    [playlistId, refresh, sortedItems.length],
  );

  const addBulk = useCallback(
    async (trackIds: number[]) => {
      if (playlistId == null || trackIds.length === 0) return { added: 0 };
      setBulkBusy(true);
      setBulkProgress(0);
      try {
        let done = 0;
        for (let i = 0; i < trackIds.length; i += BULK_CHUNK) {
          await bulkAddTracksToPlaylist(playlistId, trackIds.slice(i, i + BULK_CHUNK));
          done = Math.min(i + BULK_CHUNK, trackIds.length);
          setBulkProgress(Math.round((done / trackIds.length) * 100));
        }
        await refresh();
        return { added: trackIds.length };
      } finally {
        setBulkBusy(false);
        setBulkProgress(0);
      }
    },
    [playlistId, refresh],
  );

  return {
    items: filteredItems,
    allItems: sortedItems,
    trackIdsInPlaylist,
    loading,
    search,
    setSearch,
    draggingId,
    setDraggingId,
    bulkBusy,
    bulkProgress,
    refresh,
    removeItem,
    reorder,
    addSingle,
    addBulk,
    isFiltering: search.trim().length > 0,
  };
}
