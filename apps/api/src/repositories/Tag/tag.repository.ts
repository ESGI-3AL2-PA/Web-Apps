import type { Tag } from "../../entities/tag.entity.js";

export interface ITagRepository {
  ensureIndexes(): Promise<void>;

  getTags(params: { search?: string; districtId?: string; page?: number; limit?: number }): Promise<{
    data: Tag[];
    total: number;
    page: number;
    limit: number;
  }>;

  getTagById(id: string): Promise<Tag | null>;

  getTagsByNames(districtId: string, names: string[]): Promise<Tag[]>;

  createTag(data: Omit<Tag, "id">): Promise<Tag>;

  updateTag(id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null>;

  deleteTag(id: string): Promise<boolean>;
}
