import type { ListingSort } from "@repo/contracts";
import type { Listing } from "../../entities/listing.entity.js";

/**
 * Contrat du repository des annonces (listings). Implémenté par les versions
 * Mongo et SATAN QL ; les cas d'usage ne dépendent que de cette interface.
 */
export interface IListingRepository {
  ensureIndexes(): Promise<void>;

  getListings(params: {
    search?: string;
    status?: string;
    districtId?: string;
    authorId?: string;
    tag?: string;
    sort?: ListingSort;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Listing[];
    total: number;
    page: number;
    limit: number;
  }>;

  getListingById(id: string): Promise<Listing | null>;

  createListing(data: Omit<Listing, "id" | "createdAt">): Promise<Listing>;

  updateListing(id: string, data: Partial<Omit<Listing, "id" | "createdAt">>): Promise<Listing | null>;

  deleteListing(id: string): Promise<boolean>;

  countActiveListings(districtId?: string): Promise<number>;

  /** Supprime toutes les annonces créées par un user (suppression de compte). */
  deleteByAuthor(authorId: string): Promise<void>;
}
