import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const updateTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> => {
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
