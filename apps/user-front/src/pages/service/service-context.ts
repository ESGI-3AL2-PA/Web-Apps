import { useOutletContext } from "react-router-dom";
import type { ListingType } from "@repo/contracts";

export type ServiceFilters = {
  /** Server-side: undefined = both offers and requests. */
  type?: ListingType;
  /** Server-side full-text search. */
  search: string;
  /** Client-side refinement (listings query has no tags param). */
  categories: string[];
  /** Client-side refinement (listings query has no price param). 0 = no cap. */
  maxPrice: number;
};

export type ServiceContext = {
  filters: ServiceFilters;
  /** Bump to force the listing view to refetch (e.g. after creating one). */
  refreshKey: number;
  /** Children report the server total so the header can display it. */
  setTotal: (total: number | null) => void;
};

export const useServiceContext = () => useOutletContext<ServiceContext>();
