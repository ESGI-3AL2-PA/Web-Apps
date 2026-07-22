import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { TagConflictError } from "./create-tag.use-case.js";

export const updateTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> => {
    // Renaming to a key another tag in the district already owns would create the same
    // duplicate-key corruption as an unguarded create — reject it (excluding self).
    if (data.name !== undefined) {
      const current = await tagRepository.getTagById(id);
      if (!current) return null;
      const clash = await tagRepository.getTagsByNames(current.districtId, [data.name]);
      if (clash.some((t) => t.id !== id)) throw new TagConflictError(data.name);
    }

    const tag = await tagRepository.updateTag(id, data);
    if (tag) {
      // Tag nodes in Neo4j are keyed by `name`, so refresh the projection.
      await syncGraph(`upsertTag(${tag.name})`, () =>
        graphRepository.upsertTag({ name: tag.name, category: tag.description?.en }),
      );
    }
    return tag;
  };
};
