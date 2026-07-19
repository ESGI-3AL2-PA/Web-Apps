import type { ConflictDto, ConflictStatus, SyncEntity } from "@repo/contracts";
import type { ISyncConflictsRepository, SyncConflict } from "../../repositories/Sync/sync-conflicts.repository.js";
import { redactServerDoc } from "../../sync/sync-entity-config.js";

export const toConflictDto = (c: SyncConflict): ConflictDto => ({
  id: c.id,
  entity: c.entity,
  mongoId: c.mongoId,
  type: c.type,
  originInstanceId: c.originInstanceId,
  localData: c.localData,
  // Re-redacted on the way out: the stored payload was already stripped, but this
  // keeps the guarantee at the boundary rather than relying on how it was written.
  serverData: redactServerDoc(c.serverData),
  baseUpdatedAt: c.baseUpdatedAt,
  status: c.status,
  detectedAt: c.detectedAt,
  resolvedAt: c.resolvedAt,
  resolvedBy: c.resolvedBy,
  resolution: c.resolution,
});

/**
 * `originInstanceId` is set for the default `mine=true` view — the conflicts this
 * operator's own pushes raised. Only `superAdmin` may omit it (§4.3).
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

export const getConflictByIdUseCase = (conflictsRepository: ISyncConflictsRepository) => {
  return async (id: string): Promise<ConflictDto | null> => {
    const conflict = await conflictsRepository.getById(id);
    return conflict ? toConflictDto(conflict) : null;
  };
};
