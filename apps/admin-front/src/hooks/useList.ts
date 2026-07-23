// Hook générique de gestion des listes paginées : centralise l'état (page/recherche/filtres) et
// le cycle de vie du fetch pour tous les écrans de liste. Expose `useList` et ses types.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListParams, Paginated } from "../api-service/types";

/** Valeur retournée par `useList` : données paginées + état + setters pour piloter la liste. */
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
  // Params injectés par-dessus la recherche/les filtres pilotés par l'utilisateur (ex. le quartier
  // sélectionné). Les modifier déclenche un refetch. Gardés distincts de `filters` pour que l'UI de
  // pagination/recherche n'y touche jamais.
  extraParams?: Record<string, string | undefined>;
}

/**
 * Encapsule l'état d'une liste (page/recherche/filtres) et le cycle de vie du fetch. Chaque écran
 * de liste fournit un `fetcher` de forme (params) => Paginated<T> ; tout changement de
 * page/recherche/filtres relance automatiquement le chargement.
 */
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

  // `search` alimente le champ de saisie immédiatement ; `debouncedSearch` alimente le fetch, avec
  // un délai de 300 ms, pour ne pas déclencher une requête à chaque frappe.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const setSearch = useCallback((value: string) => {
    setPage(1);
    setSearchState(value);
  }, []);

  // Positionne (ou retire, si valeur vide) un filtre et revient à la page 1.
  const setFilter = useCallback((key: string, value: string) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);

  // Force un rechargement en incrémentant une clé factice observée par l'effet de fetch.
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // Sérialisé pour que l'identité de l'objet (recréé à chaque render par les appelants) ne pilote
  // pas les effets — seul le contenu compte.
  const extraParamsKey = JSON.stringify(options.extraParams ?? {});
  const scopeRef = useRef(extraParamsKey);

  useEffect(() => {
    // Un changement de portée (nouveaux extraParams) réinitialise à la première page : la page
    // courante peut ne pas exister dans le nouvel ensemble de résultats. La réinitialisation est
    // faite ici (pas dans un effet séparé) pour que reset et fetch partagent un seul chemin : un
    // changement de portée depuis page>1 ne déclenche qu'une seule requête.
    if (scopeRef.current !== extraParamsKey) {
      scopeRef.current = extraParamsKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    // Garde anti-course : si l'effet est nettoyé avant la résolution du fetch, on ignore le résultat.
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Construit les query params : pagination + recherche + filtres + extraParams (portée),
    // en n'incluant que les valeurs non vides.
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
