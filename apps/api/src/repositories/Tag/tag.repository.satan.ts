/**
 * Repository (implémentation SATAN) des tags.
 *
 * Sert les lectures via le langage de requête SATAN (recherche id, liste `IN` de noms,
 * suppression par id, listage paginé avec COUNT + recherche CONTAINS) et délègue à la
 * version Mongo les écritures qui produisent des champs générés côté serveur.
 */
import { quote, type SatanClient } from "@repo/satan";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "./tag.repository.js";
import { containsAny, eq, paginate, where } from "../satan.helpers.js";

// Les documents de tags hérités précèdent les champs par langue (label absent,
// description en simple chaîne). SATAN renvoie des lignes brutes : on les normalise
// comme le `toTag` du repo Mongo, sinon les réponses violent TagResponseDtoSchema.
type RawTag = Omit<Tag, "label" | "description"> & {
  label?: Tag["label"];
  description?: Tag["description"] | string;
};

// Normalise une ligne brute SATAN en entité Tag valide (champs par langue garantis).
function normalizeTag(row: RawTag): Tag {
  const { label, description, ...rest } = row;
  return {
    ...rest,
    label: label ?? { fr: row.name, en: row.name },
    description: typeof description === "string" ? { fr: description, en: description } : description,
  };
}

export class SatanTagRepository implements ITagRepository {
  constructor(
    private readonly mongo: ITagRepository,
    private readonly satan: SatanClient,
  ) {}

  async getTagById(id: string): Promise<Tag | null> {
    const rows = (await this.satan.query(`FIND tags WHERE _id = ${quote(id)}`)) as RawTag[];
    return rows[0] ? normalizeTag(rows[0]) : null;
  }

  async getTagsByNames(districtId: string, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    // quote() échappe chaque nom avant de composer la liste `IN (...)` de la requête SATAN.
    const list = names.map((n) => quote(n)).join(", ");
    const rows = (await this.satan.query(
      `FIND tags WHERE districtId = ${quote(districtId)} AND name IN (${list})`,
    )) as RawTag[];
    return rows.map(normalizeTag);
  }

  async deleteTag(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM tags WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
  }

  async getTags(params: Parameters<ITagRepository["getTags"]>[0]) {
    const { search, districtId, page = 1, limit = 20 } = params;
    const clause = where([
      search && containsAny(["name", "label.fr", "label.en", "description.fr", "description.en"], search),
      districtId && eq("districtId", districtId),
    ]);
    const res = await paginate<RawTag>(this.satan, "tags", clause, { page, limit });
    return { ...res, data: res.data.map(normalizeTag) };
  }

  // --- délégué à Mongo (champs générés côté serveur) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  createTag(data: Omit<Tag, "id">): Promise<Tag> {
    return this.mongo.createTag(data);
  }
  updateTag(id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> {
    return this.mongo.updateTag(id, data);
  }
}
