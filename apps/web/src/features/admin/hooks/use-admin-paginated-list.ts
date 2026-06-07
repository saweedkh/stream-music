"use client";

import { useCallback, useEffect, useState } from "react";

export type AdminListQuery = {
  search: string;
  limit: number;
  offset: number;
  dateFrom?: string;
  dateTo?: string;
};

type PaginatedResponse<T> = { results: T[]; total: number; offset: number; limit: number };

export function useAdminPaginatedList<T>(
  fetcher: (opts: AdminListQuery) => Promise<PaginatedResponse<T>>,
  options?: { pageSize?: number; enabled?: boolean; withDateRange?: boolean },
) {
  const pageSize = options?.pageSize ?? 25;
  const enabled = options?.enabled ?? true;
  const withDateRange = options?.withDateRange ?? false;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [queryDateFrom, setQueryDateFrom] = useState("");
  const [queryDateTo, setQueryDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetcher({
        search: query,
        limit: pageSize,
        offset,
        dateFrom: withDateRange ? queryDateFrom || undefined : undefined,
        dateTo: withDateRange ? queryDateTo || undefined : undefined,
      });
      setRows(data.results);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [enabled, fetcher, offset, pageSize, query, queryDateFrom, queryDateTo, withDateRange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function submitSearch() {
    setOffset(0);
    setQuery(search.trim());
    if (withDateRange) {
      setQueryDateFrom(dateFrom);
      setQueryDateTo(dateTo);
    }
  }

  function clearDateRange() {
    setDateFrom("");
    setDateTo("");
    setQueryDateFrom("");
    setQueryDateTo("");
    setOffset(0);
  }

  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    search,
    setSearch,
    appliedSearch: query,
    submitSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    queryDateFrom,
    queryDateTo,
    clearDateRange,
    rows,
    total,
    loading,
    error,
    reload,
    offset,
    pageSize,
    page,
    pageCount,
    hasPrev: offset > 0,
    hasNext: offset + pageSize < total,
    prevPage: () => setOffset((o) => Math.max(0, o - pageSize)),
    nextPage: () => setOffset((o) => o + pageSize),
  };
}
