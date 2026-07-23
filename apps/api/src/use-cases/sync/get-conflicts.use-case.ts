// Cas d'usage sync : lecture des conflits mis en quarantaine (liste + détail par id).
import type { ConflictDto, ConflictStatus, SyncEntity } from "@repo/contracts";
import type { ISyncConflictsRepository, SyncConflict } from "../../repositories/Sync/sync-conflicts.repository.js";
import { redactServerDoc } from "../../sync/sync-entity-config.js";

/**
 * Convertit un conflit stocké en DTO de sortie.
 * Le `serverData` est ré-expurgé au passage : le payload stocké l'était déjà, mais on
 * garantit ainsi le nettoyage à la frontière plutôt que de dépendre de la façon dont
 * il a été écrit.
 */
export const toConflictDto = (c: SyncConflict): ConflictDto => ({
  id: c.id,
  entity: c.entity,
  mongoId: c.mongoId,
  type: c.type,
  originInstanceId: c.originInstanceId,
  localData: c.localData,
  // Ré-expurgé en sortie : le payload stocké était déjà nettoyé, mais on garantit
  // ici le nettoyage à la frontière sans dépendre de la façon dont il a été écrit.
  serverData: redactServerDoc(c.serverData),
  baseUpdatedAt: c.baseUpdatedAt,
  status: c.status,
  detectedAt: c.detectedAt,
  resolvedAt: c.resolvedAt,
  resolvedBy: c.resolvedBy,
  resolution: c.resolution,
});

/**
 * Factory du cas d'usage de liste des conflits.
 * `originInstanceId` est renseigné pour la vue par défaut `mine=true` — les conflits
 * levés par les propres push de cet opérateur. Seul un `superAdmin` peut l'omettre
 * pour voir tous les conflits (§4.3). Filtrage optionnel par statut et par entité.
 */
export const getConflictsUseCase = (conflictsRepository: ISyncConflictsRepository) => {
  return async (params: {
    status: ConflictStatus;
    entity?: SyncEntity;
    originInstanceId?: string;
    limit: number;
  }): Promise<ConflictDto[]> => {
    const conflicts = await conflictsRepository.list(params);
    return conflicts.map(toConflictDto);
  };
};

/** Factory du cas d'usage de récupération d'un conflit par id (null si introuvable). */
export const getConflictByIdUseCase = (conflictsRepository: ISyncConflictsRepository) => {
  return async (id: string): Promise<ConflictDto | null> => {
    const conflict = await conflictsRepository.getById(id);
    return conflict ? toConflictDto(conflict) : null;
  };
};
