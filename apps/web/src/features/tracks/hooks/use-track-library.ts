"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [search, setSearchState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genre, setGenreState] = useState("");
  const [album, setAlbumState] = useState("");
  const [favoritesOnly, setFavoritesOnlyState] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facetGenres, setFacetGenres] = useState<string[]>([]);
  const [facetAlbums, setFacetAlbums] = useState<string[]>([]);
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);
  const facetsLoadedRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const setGenre = useCallback((value: string) => {
    setGenreState(value);
    setOffset(0);
  }, []);

  const setAlbum = useCallback((value: string) => {
    setAlbumState(value);
    setOffset(0);
  }, []);

  const setFavoritesOnly = useCallback((value: boolean) => {
    setFavoritesOnlyState(value);
    setOffset(0);
  }, []);

  const loadPage = useCallback(
    async (pageOffset: number) => {
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
        onErrorRef.current?.("tracks.loadFailed");
      } finally {
        setLoading(false);
      }
    },
    [album, debouncedSearch, favoritesOnly, genre],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await listTracks({
          search: debouncedSearch || undefined,
          genre: genre || undefined,
          album: album || undefined,
          favorited: favoritesOnly || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        if (cancelled) return;
        if (isPaginated(data)) {
          setTracks(data.results);
          setTotal(data.total);
        } else {
          const list = normalizeTrackList(data);
          setTracks(list);
          setTotal(list.length);
        }
      } catch {
        if (!cancelled) onErrorRef.current?.("tracks.loadFailed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, genre, album, favoritesOnly, offset]);

  const refreshFacets = useCallback(async () => {
    try {
      const facets = await getTrackFacets();
      setFacetGenres(facets.genres);
      setFacetAlbums(facets.albums);
      facetsLoadedRef.current = true;
    } catch {
      setFacetGenres([]);
      setFacetAlbums([]);
    }
  }, []);

  useEffect(() => {
    if (facetsLoadedRef.current) return;
    void refreshFacets();
  }, [refreshFacets]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const next = Math.max(0, (page - 1) * PAGE_SIZE);
    setOffset(next);
  };

  const refresh = useCallback(async () => {
    await loadPage(offset);
    await refreshFacets();
  }, [loadPage, offset, refreshFacets]);

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
    await loadPage(offset);
    await refreshFacets();
  };

  const removeTrack = async (trackId: number) => {
    await deleteTrack(trackId);
    const nextOffset = tracks.length === 1 && offset > 0 ? offset - PAGE_SIZE : offset;
    if (nextOffset !== offset) setOffset(nextOffset);
    else await loadPage(offset);
    await refreshFacets();
  };

  return {
    tracks,
    total,
    loading,
    search,
    setSearch: setSearchState,
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
