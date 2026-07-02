import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import { DEFAULT_TAGS } from "./default-tags.js";

/**
 * Ensures the base set of tags exists for a given district. Idempotent: only
 * creates tags whose name is not already present within that district, so it
 * can safely run on every district creation. Returns the tags that were newly
 * created.
 */
export const seedDefaultTagsUseCase = (tagRepository: ITagRepository) => {
  return async (districtId: string): Promise<Tag[]> => {
    const existing = await tagRepository.getTagsByNames(
      districtId,
      DEFAULT_TAGS.map((t) => t.name),
    );
    const existingNames = new Set(existing.map((t) => t.name));
    const missing = DEFAULT_TAGS.filter((t) => !existingNames.has(t.name));

    return Promise.all(missing.map((t) => tagRepository.createTag({ ...t, districtId })));
  };
};
