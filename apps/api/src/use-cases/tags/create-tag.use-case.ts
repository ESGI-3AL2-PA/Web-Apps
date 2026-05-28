import type { CreateTagDto } from "@repo/contracts";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

export const createTagUseCase = (tagRepository: ITagRepository) => {
  return async (data: CreateTagDto): Promise<Tag> => {
    return await tagRepository.createTag(data);
  };
};
