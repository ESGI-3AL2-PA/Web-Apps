import { quote, type SatanClient } from "@repo/satan";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "./tag.repository.js";

/** SATAN QL for id lookup, the `IN`-list name lookup and the id delete. */
export class SatanTagRepository implements ITagRepository {
  constructor(
    private readonly mongo: ITagRepository,
    private readonly satan: SatanClient,
  ) {}

  async getTagById(id: string): Promise<Tag | null> {
    const rows = (await this.satan.query(`FIND tags WHERE _id = ${quote(id)}`)) as Tag[];
    return rows[0] ?? null;
  }

  async getTagsByNames(districtId: string, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    const list = names.map((n) => quote(n)).join(", ");
    return (await this.satan.query(`FIND tags WHERE districtId = ${quote(districtId)} AND name IN (${list})`)) as Tag[];
  }

  async deleteTag(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM tags WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getTags(params: Parameters<ITagRepository["getTags"]>[0]) {
    return this.mongo.getTags(params);
  }
  createTag(data: Omit<Tag, "id">): Promise<Tag> {
    return this.mongo.createTag(data);
  }
  updateTag(id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> {
    return this.mongo.updateTag(id, data);
  }
}
