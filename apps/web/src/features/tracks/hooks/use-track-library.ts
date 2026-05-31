"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteTrack,
  getTrackFacets,
  listTracks,
  normalizeTrackList,
  setTrackFavorite,
  updateTrack,
  type PaginatedTracks,
  type TrackSummary,
} from "@/lib/api";
import { toBackendVisibility, type TrackAccess } from "@/features/tracks/model/track-access";

const PAGE_SIZE = 20;

function isPaginated(data: TrackSummary[] | PaginatedTracks): data is PaginatedTracks {
  return !Array.isArray(data) && "results" in data;
}

export function useTrackLibrary(onError?: (message: string) => void) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [album, setAlbum] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facetGenres, setFacetGenres] = useState<string[]>([]);
  const [facetAlbums, setFacetAlbums] = useState<string[]>([]);
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, genre, album, favoritesOnly]);

  const fetchPage = useCallback(
    async (pageOffset = offset) => {
      setLoading(true);
      try {
        const data = await listTracks({
          search: debouncedSearch || undefined,
          genre: genre || undefined,
          album: album || undefined,
          favorited: favoritesOnly || undefined,
          limit: PAGE_SIZE,
          offset: pageOffset,
        });
        if (isPaginated(data)) {
          setTracks(data.results);
          setTotal(data.total);
        } else {
          const list = normalizeTrackList(data);
          setTracks(list);
          setTotal(list.length);
        }
      } catch {
        onError?.("tracks.loadFailed");
      } finally {
        setLoading(false);
      }
    },
    [album, debouncedSearch, favoritesOnly, genre, offset, onError],
  );

  const refreshFacets = useCallback(async () => {
    try {
      const facets = await getTrackFacets();
      setFacetGenres(facets.genres);
      setFacetAlbums(facets.albums);
    } catch {
      setFacetGenres([]);
      setFacetAlbums([]);
    }
  }, []);

  useEffect(() => {
    void refreshFacets();
  }, [refreshFacets]);

  useEffect(() => {
    void fetchPage(offset);
  }, [fetchPage, offset]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const next = Math.max(0, (page - 1) * PAGE_SIZE);
    setOffset(next);
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchPage(offset), refreshFacets()]);
  }, [fetchPage, offset, refreshFacets]);

  const toggleFavorite = async (trackId: number, next: boolean) => {
    setFavoriteBusyId(trackId);
    try {
      await setTrackFavorite(trackId, next);
      if (favoritesOnly && !next) {
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        setTotal((n) => Math.max(0, n - 1));
      } else {
        setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, is_favorited: next } : t)));
      }
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const saveTrack = async (
    trackId: number,
    payload: { title: string; artist: string; album: string; access: TrackAccess },
  ) => {
    await updateTrack(trackId, {
      title: payload.title.trim() || undefined,
      artist: payload.artist.trim() || undefined,
      album: payload.album.trim() || undefined,
      visibility: toBackendVisibility(payload.access),
    });
    await fetchPage(offset);
  };

  const removeTrack = async (trackId: number) => {
    await deleteTrack(trackId);
    const nextOffset = tracks.length === 1 && offset > 0 ? offset - PAGE_SIZE : offset;
    if (nextOffset !== offset) setOffset(nextOffset);
    else await fetchPage(offset);
    await refreshFacets();
  };

  return {
    tracks,
    total,
    loading,
    search,
    setSearch,
    genre,
    setGenre,
    album,
    setAlbum,
    favoritesOnly,
    setFavoritesOnly,
    facetGenres,
    facetAlbums,
    favoriteBusyId,
    toggleFavorite,
    saveTrack,
    removeTrack,
    refresh,
    pageCount,
    currentPage,
    goToPage,
    pageSize: PAGE_SIZE,
  };
}
