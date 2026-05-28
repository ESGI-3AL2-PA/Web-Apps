import type { Tag } from "../../entities/tag.entity.js";

export interface ITagRepository {
  getTags(params: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Tag[];
    total: number;
    page: number;
    limit: number;
  }>;

  getTagById(id: string): Promise<Tag | null>;

  createTag(data: Omit<Tag, "id">): Promise<Tag>;

  updateTag(id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null>;

  deleteTag(id: string): Promise<boolean>;
}
