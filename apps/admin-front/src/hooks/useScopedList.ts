import { useDistrictScope } from "../app/DistrictScopeProvider";
import { useList } from "./useList";
import type { ListParams, Paginated } from "../api-service/types";

interface UseScopedListOptions {
  limit?: number;
  initialFilters?: Record<string, string>;
}

// Like useList, but injects the active district scope as a `districtId` param so the page only
// shows the selected district's rows. Use on district-scoped resources (users, incidents,
// listings, events, votes). The api enforces the same scope server-side regardless.
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
