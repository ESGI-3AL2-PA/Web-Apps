import type { ChangeEntryDto } from "@repo/contracts";
import type { ISyncChangesRepository } from "../../repositories/Sync/sync-changes.repository.js";
import { redactServerDoc } from "../../sync/sync-entity-config.js";
import type { SyncScope } from "../../sync/sync-scope.js";

/**
 * One page of the ordered change feed. `since=0` is a full snapshot thanks to the
 * first-boot seeding (§5.2), so the client has a single pull path and no separate
 * REST bootstrap.
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
