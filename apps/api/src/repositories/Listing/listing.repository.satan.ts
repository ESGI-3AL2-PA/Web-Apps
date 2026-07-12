import type { Listing } from "../../entities/listing.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { IListingRepository } from "./listing.repository.js";

/** SATAN QL for the id lookup + deletes; Mongo for the paginated/regex list,
 *  the active-count and server-generated create/update. */
export class SatanListingRepository implements IListingRepository {
  constructor(
    private readonly mongo: IListingRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getListingById(id: string): Promise<Listing | null> {
    return this.satan.findOne<Listing>(`FIND listings WHERE _id = ${this.satan.q(id)}`);
  }

  async deleteListing(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM listings WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
  }

  async deleteByAuthor(authorId: string): Promise<void> {
    await this.satan.delete(`DELETE FROM listings WHERE authorId = ${this.satan.q(authorId)}`);
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getListings(params: Parameters<IListingRepository["getListings"]>[0]) {
    return this.mongo.getListings(params);
  }
  createListing(data: Omit<Listing, "id" | "createdAt">): Promise<Listing> {
    return this.mongo.createListing(data);
  }
  updateListing(id: string, data: Partial<Omit<Listing, "id" | "createdAt">>): Promise<Listing | null> {
    return this.mongo.updateListing(id, data);
  }
  countActiveListings(districtId?: string): Promise<number> {
    return this.mongo.countActiveListings(districtId);
  }
}
