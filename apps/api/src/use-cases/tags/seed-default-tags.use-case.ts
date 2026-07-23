// Cas d'usage : amorçage (seed) du jeu de tags par défaut pour un quartier.

import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import { DEFAULT_TAGS } from "./default-tags.js";

/**
 * Garantit que le jeu de tags de base existe pour un quartier donné.
 * Idempotent : ne crée que les tags dont le nom n'est pas déjà présent dans ce
 * quartier, ce qui permet de l'exécuter sans risque à chaque création de quartier.
 * Retourne uniquement les tags nouvellement créés.
 */
export const seedDefaultTagsUseCase = (tagRepository: ITagRepository) => {
  return async (districtId: string): Promise<Tag[]> => {
    // On récupère, parmi les noms par défaut, ceux qui existent déjà dans ce quartier...
    const existing = await tagRepository.getTagsByNames(
      districtId,
      DEFAULT_TAGS.map((t) => t.name),
    );
    const existingNames = new Set(existing.map((t) => t.name));
    // ...pour ne créer que les manquants.
    const missing = DEFAULT_TAGS.filter((t) => !existingNames.has(t.name));

    return Promise.all(missing.map((t) => tagRepository.createTag({ ...t, districtId })));
  };
};
