import type { CreateTagDto } from "@repo/contracts";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const createTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateTagDto): Promise<Tag> => {
    const tag = await tagRepository.createTag(data);
    await syncGraph(`upsertTag(${tag.name})`, () =>
      graphRepository.upsertTag({ name: tag.name, category: tag.description }),
    );
    return tag;
  };
};
