import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

export const getTagsUseCase = (tagRepository: ITagRepository) => {
  return async (params: { search?: string; districtId?: string; page?: number; limit?: number }) => {
    return await tagRepository.getTags(params);
  };
};
