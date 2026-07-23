import { randomUUID } from "crypto";
import type { Collection, Db, Filter, Sort } from "mongodb";
import type { WithMongoId } from "@repo/shared";
import type { ListingSort } from "@repo/contracts";
import type { Listing, ListingStatus } from "../../entities/listing.entity.js";
import { escapeRegex } from "../escape-regex.js";
import type { IListingRepository } from "./listing.repository.js";

// Document Mongo = entité Listing + son `_id`.
type ListingDoc = WithMongoId<Listing>;

// `_id` est toujours le critère de départage final pour que la pagination
// skip/limit reste déterministe même en cas d'égalité de la clé de tri (même
// prix, ou createdAt à la même milliseconde).
const SORT_SPECS = {
  recent: { createdAt: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
} satisfies Record<ListingSort, Sort>;

/** Traduit le paramètre `sort` en spec de tri Mongo ; par défaut `recent` pour
 *  un ordre stable même quand aucun tri n'est passé. */
export function listingSortSpec(sort?: ListingSort): Sort {
  return SORT_SPECS[sort ?? "recent"];
}

/**
 * Implémentation Mongo du repository des annonces (collection `listings`).
 * Recherche regex, filtre par tag insensible à la casse, tri configurable et
 * pagination.
 */
export class MongoListingRepository implements IListingRepository {
  private collection: Collection<ListingDoc>;

  constructor(db: Db) {
    this.collection = db.collection("listings");
  }

  async ensureIndexes(): Promise<void> {
    // Index qui sert au filtrage des listes par quartier.
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

    // Recherche insensible à la casse sur titre + description, saisie échappée.
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

  // Supprime toutes les annonces d'un auteur (suppression de compte).
  async deleteByAuthor(authorId: string): Promise<void> {
    await this.collection.deleteMany({ authorId });
  }

  // Convertit le document Mongo en entité (`_id` → `id`).
  private toListing(doc: ListingDoc): Listing {
    const { _id, ...rest } = doc;
    // `images` par défaut pour les documents créés avant l'ajout du champ.
    return { id: _id, ...rest, images: rest.images ?? [] };
  }
}
