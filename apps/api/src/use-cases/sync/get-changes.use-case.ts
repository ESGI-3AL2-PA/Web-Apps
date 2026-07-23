// Cas d'usage sync : renvoie une page du flux de changements ordonné (pull côté desktop).
import type { ChangeEntryDto } from "@repo/contracts";
import type { ISyncChangesRepository } from "../../repositories/Sync/sync-changes.repository.js";
import { redactServerDoc } from "../../sync/sync-entity-config.js";
import type { SyncScope } from "../../sync/sync-scope.js";

/**
 * Une page du flux de changements ordonné. `since=0` correspond à un snapshot complet
 * grâce au seeding au premier démarrage (§5.2) : le client n'a donc qu'un seul chemin
 * de pull, sans bootstrap REST distinct.
 *
 * Chaque entrée passe par `redactServerDoc` pour retirer les champs serveur sensibles
 * (ex. hash de mot de passe) avant de quitter le serveur. Filtrage par `scope`
 * (quartier) et exclusion optionnelle de l'instance émettrice (`excludeInstance`,
 * pour éviter que le client ne se réapplique ses propres écritures).
 */
export const getChangesUseCase = (changesRepository: ISyncChangesRepository) => {
  return async (params: {
    since: number;
    limit: number;
    excludeInstance?: string;
    scope: SyncScope;
  }): Promise<ChangeEntryDto[]> => {
    const changes = await changesRepository.list(params);
    return changes.map((c) => ({
      index: c.index,
      entity: c.entity,
      operation: c.operation,
      mongoId: c.mongoId,
      data: redactServerDoc(c.data),
      occurredAt: c.occurredAt,
    }));
  };
};
