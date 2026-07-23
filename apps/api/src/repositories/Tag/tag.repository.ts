/**
 * Contrat du repository des tags — implémenté par les versions Mongo et SATAN.
 */
import type { Tag } from "../../entities/tag.entity.js";

export interface ITagRepository {
  ensureIndexes(): Promise<void>;

  /** Listage paginé, filtré par recherche texte et/ou quartier. */
  getTags(params: { search?: string; districtId?: string; page?: number; limit?: number }): Promise<{
    data: Tag[];
    total: number;
    page: number;
    limit: number;
  }>;

  getTagById(id: string): Promise<Tag | null>;

  /** Résout un lot de tags par leurs noms au sein d'un quartier. */
  getTagsByNames(districtId: string, names: string[]): Promise<Tag[]>;

  createTag(data: Omit<Tag, "id">): Promise<Tag>;

  updateTag(id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null>;

  deleteTag(id: string): Promise<boolean>;
}
