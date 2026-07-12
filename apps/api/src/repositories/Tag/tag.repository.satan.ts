import type { Tag } from "../../entities/tag.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { ITagRepository } from "./tag.repository.js";

/** SATAN QL for id lookup, the `IN`-list name lookup and the id delete. */
export class SatanTagRepository implements ITagRepository {
  constructor(
    private readonly mongo: ITagRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getTagById(id: string): Promise<Tag | null> {
    return this.satan.findOne<Tag>(`FIND tags WHERE _id = ${this.satan.q(id)}`);
  }

  getTagsByNames(districtId: string, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return Promise.resolve([]);
    const list = names.map((n) => this.satan.q(n)).join(", ");
    return this.satan.find<Tag>(`FIND tags WHERE districtId = ${this.satan.q(districtId)} AND name IN (${list})`);
  }

  async deleteTag(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM tags WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
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
