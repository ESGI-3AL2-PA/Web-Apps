// Cas d'usage : liste paginée des tags. Pass-through vers le repository.

import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

/**
 * Factory du cas d'usage de listing des tags.
 * Paramètres tous optionnels : `search` (filtre texte), `districtId` (restriction au
 * quartier), `page` / `limit` (pagination).
 */
export const getTagsUseCase = (tagRepository: ITagRepository) => {
  return async (params: { search?: string; districtId?: string; page?: number; limit?: number }) => {
    return await tagRepository.getTags(params);
  };
};
