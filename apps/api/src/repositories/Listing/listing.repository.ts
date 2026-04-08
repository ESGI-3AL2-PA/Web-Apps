import type { Listing } from "../../entities/listing.entity.js";

export interface IListingRepository {
  getListings(params: {
    search?: string;
    type?: string;
    status?: string;
    districtId?: string;
    authorId?: string;
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
}
