import { randomUUID } from "crypto";
import type { Collection, Db, Filter, Sort } from "mongodb";
import type { WithMongoId } from "@repo/shared";
import type { ListingSort } from "@repo/contracts";
import type { Listing, ListingStatus } from "../../entities/listing.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IListingRepository } from "./listing.repository.js";

type ListingDoc = WithMongoId<Listing>;

// `_id` is always the final tiebreaker so skip/limit pagination is deterministic
// even when the primary key ties (equal price, or same-millisecond createdAt).
const SORT_SPECS = {
  recent: { createdAt: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
} satisfies Record<ListingSort, Sort>;

/** Map the `sort` query param to a Mongo sort spec; defaults to `recent` for a
 *  stable order even when no sort is passed. */
export function listingSortSpec(sort?: ListingSort): Sort {
  return SORT_SPECS[sort ?? "recent"];
}

export class MongoListingRepository implements IListingRepository {
  private collection: Collection<ListingDoc>;

  constructor(db: Db) {
    this.collection = db.collection("listings");
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped list filtering.
    await this.collection.createIndex({ districtId: 1 });
  }

  async getListings(params: {
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
  }> {
    const { search, status, districtId, authorId, tag, sort, page = 1, limit = 20 } = params;

    const filter: Filter<ListingDoc> = {};

    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [{ title: { $regex: safe, $options: "i" } }, { description: { $regex: safe, $options: "i" } }];
    }
    if (status) filter.status = status as ListingStatus;
    if (districtId) filter.districtId = districtId;
    if (authorId) filter.authorId = authorId;
    // Match case-insensitive sur l'array `tags` : "Babysitting" matche
    // "babysitting" et inversement. On échappe les caractères regex pour
    // éviter toute injection (`.`, `*`, `+`, etc. dans un nom de tag).
    if (tag) {
      filter.tags = { $regex: new RegExp(`^${escapeRegex(tag)}$`, "i") };
    }

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .sort(listingSortSpec(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toListing), total, page, limit };
  }

  async getListingById(id: string): Promise<Listing | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toListing(doc) : null;
  }

  async createListing(data: Omit<Listing, "id" | "createdAt">): Promise<Listing> {
    const now = new Date().toISOString();
    const doc: ListingDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.collection.insertOne(doc);
    return this.toListing(doc);
  }

  async updateListing(id: string, data: Partial<Omit<Listing, "id" | "createdAt">>): Promise<Listing | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? this.toListing(result) : null;
  }

  async deleteListing(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async countActiveListings(districtId?: string): Promise<number> {
    const filter: Filter<ListingDoc> = { status: "active" };
    if (districtId) filter.districtId = districtId;
    return this.collection.countDocuments(filter);
  }

  async deleteByAuthor(authorId: string): Promise<void> {
    await this.collection.deleteMany({ authorId });
  }

  private toListing(doc: ListingDoc): Listing {
    const { _id, ...rest } = doc;
    // Default `images` for documents created before the field existed.
    return { id: _id, ...rest, images: rest.images ?? [] };
  }
}
