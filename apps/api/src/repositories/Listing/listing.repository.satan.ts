import { quote, type SatanClient } from "@repo/satan";
import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "./listing.repository.js";
import { containsAny, eq, paginate, where } from "../satan.helpers.js";

/** SATAN QL for the id lookup, deletes, the paginated list (CONTAINS search +
 *  IEQ tag match) and the active-count (COUNT); Mongo only for the
 *  server-generated create/update. */
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

  getListings(params: Parameters<IListingRepository["getListings"]>[0]) {
    const { search, status, districtId, authorId, tag, page = 1, limit = 20 } = params;
    const clause = where([
      search && containsAny(["title", "description"], search),
      status && eq("status", status),
      districtId && eq("districtId", districtId),
      authorId && eq("authorId", authorId),
      // `tags` is an array; IEQ is a literal case-insensitive equality (escaped,
      // anchored), so it matches an element equal to `tag` — mirrors the Mongo
      // `^tag$/i` regex. NB: uses IEQ, not ILIKE, so `*`/`?` in `tag` stay
      // literal rather than becoming regex wildcards (no injection / ReDoS).
      tag && `tags IEQ ${quote(tag)}`,
    ]);
    return paginate<Listing>(this.satan, "listings", clause, { page, limit });
  }

  async countActiveListings(districtId?: string): Promise<number> {
    const clause = where([eq("status", "active"), districtId && eq("districtId", districtId)]);
    const res = (await this.satan.query(`COUNT listings${clause}`)) as { count: number };
    return res.count;
  }

  // --- delegated to Mongo (server-generated fields) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  createListing(data: Omit<Listing, "id" | "createdAt">): Promise<Listing> {
    return this.mongo.createListing(data);
  }
  updateListing(id: string, data: Partial<Omit<Listing, "id" | "createdAt">>): Promise<Listing | null> {
    return this.mongo.updateListing(id, data);
  }
}
