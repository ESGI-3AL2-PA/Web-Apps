// Cas d'usage : récupération d'un tag par son id. Pass-through vers le repository.

import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";

/** Factory du cas d'usage : renvoie le tag correspondant à l'id, ou `null` s'il n'existe pas. */
export const getTagByIdUseCase = (tagRepository: ITagRepository) => {
  return async (params: { id: string }) => {
    return await tagRepository.getTagById(params.id);
  };
};
