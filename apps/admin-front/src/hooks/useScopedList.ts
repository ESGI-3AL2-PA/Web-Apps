// Hook : variante de useList qui injecte automatiquement le quartier actif dans les params.
import { useDistrictScope } from "../app/DistrictScopeProvider";
import { useList } from "./useList";
import type { ListParams, Paginated } from "../api-service/types";

interface UseScopedListOptions {
  limit?: number;
  initialFilters?: Record<string, string>;
}

/**
 * Comme useList, mais injecte le quartier sélectionné en tant que param `districtId` pour que la
 * page n'affiche que les lignes de ce quartier. À utiliser sur les ressources rattachées à un
 * quartier (utilisateurs, signalements, annonces, événements, votes). L'api applique de toute
 * façon la même portée côté serveur.
 */
export function useScopedList<T>(
  fetcher: (params: ListParams) => Promise<Paginated<T>>,
  options: UseScopedListOptions = {},
) {
  const { districtId } = useDistrictScope();
  return useList(fetcher, {
    ...options,
    extraParams: { districtId: districtId ?? undefined },
  });
}
