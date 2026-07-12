import { quote, type SatanClient } from "@repo/satan";
import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "./listing.repository.js";

/** SATAN QL for the id lookup + deletes; Mongo for the paginated/regex list,
 *  the active-count and server-generated create/update. */
export class SatanListingRepository implements IListingRepository {
  constructor(
    private readonly mongo: IListingRepository,
    private readonly satan: SatanClient,
  ) {}

  async getListingById(id: string): Promise<Listing | null> {
    const rows = (await this.satan.query(`FIND listings WHERE _id = ${quote(id)}`)) as Listing[];
    return rows[0] ?? null;
  }

  async deleteListing(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM listings WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
  }

  async deleteByAuthor(authorId: string): Promise<void> {
    await this.satan.query(`DELETE FROM listings WHERE authorId = ${quote(authorId)}`);
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
