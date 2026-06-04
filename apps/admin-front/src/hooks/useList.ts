import { useCallback, useEffect, useState } from "react";
import type { ListParams, Paginated } from "../api-service/types";

interface UseListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  search: string;
  filters: Record<string, string>;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: string) => void;
  refetch: () => void;
}

interface UseListOptions {
  limit?: number;
  initialFilters?: Record<string, string>;
}

// Encapsulates list state (page/search/filters) + fetch lifecycle. Every list screen drives a
// fetcher of shape (params) => Paginated<T>; changing page/search/filters refetches automatically.
export function useList<T>(
  fetcher: (params: ListParams) => Promise<Paginated<T>>,
  options: UseListOptions = {},
): UseListResult<T> {
  const limit = options.limit ?? 20;
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearchState] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(options.initialFilters ?? {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const setSearch = useCallback((value: string) => {
    setPage(1);
    setSearchState(value);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: ListParams = { page, limit };
    if (search) params.search = search;
    for (const [key, value] of Object.entries(filters)) {
      if (value) params[key] = value;
    }

    fetcher(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message ?? err?.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, page, limit, search, filters, reloadKey]);

  return {
    items,
    total,
    page,
    limit,
    search,
    filters,
    loading,
    error,
    setPage,
    setSearch,
    setFilter,
    refetch,
  };
}
