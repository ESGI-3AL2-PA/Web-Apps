import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

export const getTagByIdUseCase = (tagRepository: ITagRepository) => {
  return async (params: { id: string }) => {
    return await tagRepository.getTagById(params.id);
  };
};
