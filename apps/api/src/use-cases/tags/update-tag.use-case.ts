// Cas d'usage : mise à jour d'un tag.
// Applique la modification dans Mongo puis rafraîchit le nœud correspondant dans le graphe.

import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { TagConflictError } from "./create-tag.use-case.js";

/**
 * Factory du cas d'usage de mise à jour d'un tag.
 * `data` est un patch partiel (tous les champs sauf `id`). Retourne le tag mis à jour,
 * ou `null` s'il n'existe pas.
 * Effet de bord : en cas de succès, réémet le nœud Tag dans le graphe.
 */
export const updateTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (id: string, data: Partial<Omit<Tag, "id">>): Promise<Tag | null> => {
    // Renommer vers une clé déjà détenue par un autre tag du quartier créerait la même
    // corruption de clé dupliquée qu'une création sans garde-fou — on le rejette (soi exclu).
    if (data.name !== undefined) {
      const current = await tagRepository.getTagById(id);
      if (!current) return null;
      const clash = await tagRepository.getTagsByNames(current.districtId, [data.name]);
      if (clash.some((t) => t.id !== id)) throw new TagConflictError(data.name);
    }

    const tag = await tagRepository.updateTag(id, data);
    if (tag) {
      // Les nœuds Tag dans Neo4j sont indexés par `name` : on rafraîchit donc la projection.
      await syncGraph(`upsertTag(${tag.name})`, () =>
        graphRepository.upsertTag({ name: tag.name, category: tag.description?.en }),
      );
    }
    return tag;
  };
};
