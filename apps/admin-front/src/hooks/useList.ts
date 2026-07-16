import { useCallback, useEffect, useRef, useState } from "react";
import type { ListParams, Paginated } from "../api-service/types";

export interface UseListResult<T> {
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
  // Params injected on top of user-controlled search/filters (e.g. the active district scope).
  // Changing them refetches. Kept separate from `filters` so page/search UI never touches them.
  extraParams?: Record<string, string | undefined>;
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

  // `search` drives the input immediately; `debouncedSearch` drives the fetch so typing doesn't
  // fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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

  // Serialize so the object identity (recreated each render by callers) doesn't drive effects.
  const extraParamsKey = JSON.stringify(options.extraParams ?? {});
  const scopeRef = useRef(extraParamsKey);

  useEffect(() => {
    // A scope change (new extraParams) resets to the first page — the current page may not
    // exist within the newly scoped result set. Reset inline (not in a separate effect) so
    // the reset and fetch share one path: a scope change from page>1 fires a single request.
    if (scopeRef.current !== extraParamsKey) {
      scopeRef.current = extraParamsKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: ListParams = { page, limit };
    if (debouncedSearch) params.search = debouncedSearch;
    for (const [key, value] of Object.entries(filters)) {
      if (value) params[key] = value;
    }
    for (const [key, value] of Object.entries(JSON.parse(extraParamsKey) as Record<string, string | undefined>)) {
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
  }, [fetcher, page, limit, debouncedSearch, filters, reloadKey, extraParamsKey]);

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
