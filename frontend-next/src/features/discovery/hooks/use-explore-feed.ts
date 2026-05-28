"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getExploreFeed, type ExploreFeed } from "@/lib/api";

export type ExploreFilters = {
  q: string;
  lang: string;
  genre: string;
  liveOnly: boolean;
};

export function useExploreFeed(filters: ExploreFilters, onError: (message: string) => void) {
  const [feed, setFeed] = useState<ExploreFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFeedRef = useRef(false);

  const load = useCallback(async () => {
    if (hasFeedRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getExploreFeed({
        q: filters.q.trim() || undefined,
        lang: filters.lang.trim() || undefined,
        genre: filters.genre.trim() || undefined,
        live_only: filters.liveOnly,
      });
      setFeed(data);
      hasFeedRef.current = true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "explore.loadFailed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.genre, filters.lang, filters.liveOnly, filters.q, onError]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  return { feed, loading, refreshing };
}
