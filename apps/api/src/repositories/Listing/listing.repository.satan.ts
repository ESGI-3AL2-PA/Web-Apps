import { quote, type SatanClient } from "@repo/satan";
import type { Listing } from "../../entities/listing.entity.js";
import type { IListingRepository } from "./listing.repository.js";
import { containsAny, eq, paginate, where } from "../satan.helpers.js";

/**
 * Implémentation SATAN QL du repository des annonces. SATAN pour la lecture par
 * id, les suppressions, la liste paginée (recherche CONTAINS + match de tag
 * IEQ) et le décompte des annonces actives (COUNT) ; Mongo uniquement pour les
 * create/update qui génèrent des champs côté serveur.
 */
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
      // `tags` est un tableau ; IEQ est une égalité littérale insensible à la
      // casse (échappée, ancrée), donc elle matche un élément égal à `tag` —
      // équivalent de la regex Mongo `^tag$/i`. NB : on utilise IEQ, pas ILIKE,
      // pour que `*`/`?` dans `tag` restent littéraux au lieu de devenir des
      // jokers regex (pas d'injection / ReDoS).
      tag && `tags IEQ ${quote(tag)}`,
    ]);
    return paginate<Listing>(this.satan, "listings", clause, { page, limit });
  }

  async countActiveListings(districtId?: string): Promise<number> {
    const clause = where([eq("status", "active"), districtId && eq("districtId", districtId)]);
    const res = (await this.satan.query(`COUNT listings${clause}`)) as { count: number };
    return res.count;
  }

  // --- délégué à Mongo (champs générés côté serveur) ---
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
