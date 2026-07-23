// Cas d'usage : suppression d'un tag.
// Supprime le tag dans Mongo, puis répercute la suppression sur la projection Neo4j.

import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Factory du cas d'usage de suppression d'un tag.
 * Retourne `true` si la ligne Mongo a bien été supprimée.
 * Effet de bord : après une suppression réussie, retire aussi le nœud Tag
 * correspondant du graphe (les nœuds Tag y sont indexés par `name`).
 */
export const deleteTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    // On lit le tag AVANT la suppression pour connaître son `name` (clé côté graphe).
    const tag = await tagRepository.getTagById(params.id);
    const deleted = await tagRepository.deleteTag(params.id);
    if (deleted && tag) {
      await syncGraph(`deleteTag(${tag.name})`, () => graphRepository.deleteTag(tag.name));
    }
    return deleted;
  };
};
