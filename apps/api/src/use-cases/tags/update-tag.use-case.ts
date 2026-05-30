import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

export const updateTagUseCase = (tagRepository: ITagRepository) => {
  return async (id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> => {
    return await tagRepository.updateTag(id, data);
  };
};
