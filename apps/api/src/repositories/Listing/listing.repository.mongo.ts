import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Listing, ListingType, ListingStatus } from "../../entities/listing.entity.js";
import type { IListingRepository } from "./listing.repository.js";

type ListingDoc = Omit<Listing, "id"> & { _id: string };

export class MongoListingRepository implements IListingRepository {
  private collection: Collection<ListingDoc>;

  constructor(db: Db) {
    this.collection = db.collection("listings");
  }

  async getListings(params: {
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
  }> {
    const { search, type, status, districtId, authorId, page = 1, limit = 20 } = params;

    const filter: Filter<ListingDoc> = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (type) filter.type = type as ListingType;
    if (status) filter.status = status as ListingStatus;
    if (districtId) filter.districtId = districtId;
    if (authorId) filter.authorId = authorId;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
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

  private toListing(doc: ListingDoc): Listing {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
