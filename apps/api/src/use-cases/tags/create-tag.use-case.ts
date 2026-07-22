import type { CreateTagDto } from "@repo/contracts";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

// Thrown when a tag with the same `name` (the stable key stored on listings and used
// as the URL/graph key) already exists in the district. Without this guard the create
// silently succeeds and two tags share a key, corrupting tag-by-key lookups.
export class TagConflictError extends Error {
  constructor(name: string) {
    super(`A tag with key "${name}" already exists in this district`);
    this.name = "TagConflictError";
  }
}

export const createTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (data: Omit<CreateTagDto, "districtId"> & { districtId: string }): Promise<Tag> => {
    const existing = await tagRepository.getTagsByNames(data.districtId, [data.name]);
    if (existing.length > 0) throw new TagConflictError(data.name);

    const tag = await tagRepository.createTag(data);
    await syncGraph(`upsertTag(${tag.name})`, () =>
      graphRepository.upsertTag({ name: tag.name, category: tag.description?.en }),
    );
    return tag;
  };
};
