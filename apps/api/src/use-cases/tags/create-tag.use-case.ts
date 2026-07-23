// Cas d'usage : crée un tag et le projette dans le graphe Neo4j.
import type { CreateTagDto } from "@repo/contracts";
import type { Tag } from "../../entities/tag.entity.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

// Levée lorsqu'un tag portant le même `name` (la clé stable stockée sur les annonces et
// utilisée comme clé d'URL/de graphe) existe déjà dans le quartier. Sans ce garde-fou, la
// création réussit silencieusement et deux tags partagent une clé, corrompant les
// recherches de tag par clé.
export class TagConflictError extends Error {
  constructor(name: string) {
    super(`A tag with key "${name}" already exists in this district`);
    this.name = "TagConflictError";
  }
}

/**
 * Factory du cas d'usage de création de tag.
 * Persiste le tag dans Mongo puis fait un upsert du nœud correspondant dans Neo4j.
 * La projection graphe passe par `syncGraph` : une panne Neo4j est loguée sans faire
 * échouer la création (le graphe est un miroir best-effort, Mongo reste la source de vérité).
 * @param tagRepository repository Mongo des tags
 * @param graphRepository repository graphe (Neo4j)
 */
export const createTagUseCase = (tagRepository: ITagRepository, graphRepository: IGraphRepository) => {
  return async (data: Omit<CreateTagDto, "districtId"> & { districtId: string }): Promise<Tag> => {
    const existing = await tagRepository.getTagsByNames(data.districtId, [data.name]);
    if (existing.length > 0) throw new TagConflictError(data.name);

    const tag = await tagRepository.createTag(data);
    await syncGraph(`upsertTag(${tag.name})`, () =>
      graphRepository.upsertTag({ name: tag.name, category: tag.description?.en }),
    );
    return tag;
  };
};
