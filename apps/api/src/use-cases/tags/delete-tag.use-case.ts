import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

export const deleteTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const tag = await tagRepository.getTagById(params.id);
    const deleted = await tagRepository.deleteTag(params.id);
    if (deleted && tag) {
      await syncGraph(`deleteTag(${tag.name})`, () => graphRepository.deleteTag(tag.name));
    }
    return deleted;
  };
};
