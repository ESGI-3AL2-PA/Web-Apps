import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

export const deleteTagUseCase = (tagRepository: ITagRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await tagRepository.deleteTag(params.id);
  };
};
