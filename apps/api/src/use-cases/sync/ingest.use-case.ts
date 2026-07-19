import type {
  AppliedEventDto,
  ConflictedEventDto,
  IngestEventDto,
  IngestResultDto,
  RejectedEventDto,
  SyncEntity,
} from "@repo/contracts";
import type { SyncProvenance } from "@repo/shared";
import { logger } from "../../logger.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { ISyncConflictsRepository } from "../../repositories/Sync/sync-conflicts.repository.js";
import type { ISyncWriterRepository, SyncDoc } from "../../repositories/Sync/sync-writer.repository.js";
import { isDuplicateKeyError } from "../../repositories/Sync/sync-writer.repository.js";
import { SYNC_ENTITIES, districtOf, pickWritable, redactServerDoc } from "../../sync/sync-entity-config.js";
import { projectSyncWrite } from "../../sync/graph-projection.js";
import { scopeAllowsDistrict, type SyncScope } from "../../sync/sync-scope.js";

export interface IngestDeps {
  writer: ISyncWriterRepository;
  conflicts: ISyncConflictsRepository;
  graph: IGraphRepository;
}

export interface IngestParams {
  events: IngestEventDto[];
  instanceId: string;
  scope: SyncScope;
}

/** The client's optimistic-concurrency token is stale iff it was sent and disagrees. */
const isStale = (baseUpdatedAt: string | undefined, serverDoc: SyncDoc): boolean =>
  baseUpdatedAt !== undefined && serverDoc.updatedAt !== baseUpdatedAt;

/**
 * Applies a batch of offline events pushed by one desktop instance.
 *
 * Three outcomes per event, mirroring the wire contract (§4.1): `applied` (with the
 * exact persisted `updatedAt`, so the client advances its token straight from the
 * ack), `conflicts` (quarantined, nothing overwritten — the client keeps its pending
 * row), and `rejected` (an authorization refusal that can never succeed on retry, so
 * the client drops the row instead of looping).
 */
export const ingestUseCase = (deps: IngestDeps) => {
  const { writer, conflicts, graph } = deps;

  return async ({ events, instanceId, scope }: IngestParams): Promise<IngestResultDto> => {
    const applied: AppliedEventDto[] = [];
    const conflicted: ConflictedEventDto[] = [];
    const rejected: RejectedEventDto[] = [];

    const raiseConflict = async (
      event: IngestEventDto,
      mongoId: string,
      type: "update" | "duplicate",
      serverDoc: SyncDoc | null,
    ): Promise<void> => {
      const conflict = await conflicts.create({
        entity: event.entity,
        mongoId,
        type,
        originInstanceId: instanceId,
        localData: pickWritable(event.entity, event.data),
        serverData: redactServerDoc(serverDoc),
        baseUpdatedAt: event.baseUpdatedAt,
      });
      conflicted.push({ id: event.id, mongoId, conflictId: conflict.id });
    };

    const ack = async (
      event: IngestEventDto,
      mongoId: string,
      updatedAt: string | null,
      entity: SyncEntity,
    ): Promise<void> => {
      applied.push({ id: event.id, mongoId, operation: event.operation, updatedAt });
      const doc = updatedAt === null ? null : await writer.findById(entity, mongoId);
      await projectSyncWrite(graph, entity, event.operation, mongoId, doc);
    };

    const processEvent = async (event: IngestEventDto): Promise<void> => {
      const config = SYNC_ENTITIES[event.entity];

      // Districts flow server → client only (§5.3).
      if (!config.ingestAllowed) {
        logger.warn({ entity: event.entity, instanceId }, "sync ingest: refused a write to a read-only entity");
        rejected.push({ id: event.id, reason: "read-only-entity" });
        return;
      }

      // An UPDATE/DELETE names no server record: structurally impossible, not an
      // authorization call. Report it so the client drops the row instead of retrying.
      if (event.operation !== "INSERT" && !event.mongoId) {
        logger.warn(
          { entity: event.entity, operation: event.operation, instanceId },
          "sync ingest: rejected an UPDATE/DELETE carrying no mongoId",
        );
        rejected.push({ id: event.id, reason: "unprocessable" });
        return;
      }

      const serverDoc = event.mongoId ? await writer.findById(event.entity, event.mongoId) : null;

      // District authorization. For an UPDATE/DELETE the SERVER doc decides, so a
      // client cannot smuggle a foreign record in by relabelling its payload.
      const targetDistrict = districtOf(event.entity, serverDoc ?? event.data);
      if (!scopeAllowsDistrict(scope, targetDistrict)) {
        logger.warn(
          { entity: event.entity, mongoId: event.mongoId, instanceId },
          "sync ingest: rejected an out-of-district event",
        );
        rejected.push({ id: event.id, reason: "out-of-district" });
        return;
      }

      // A record with an open conflict holds further ingests: refresh the captured
      // local snapshot and re-ack the same conflict rather than piling up rows.
      if (event.mongoId) {
        const held = await conflicts.findPending(event.entity, event.mongoId);
        if (held) {
          await conflicts.refreshLocalData(held.id, pickWritable(event.entity, event.data));
          conflicted.push({ id: event.id, mongoId: event.mongoId, conflictId: held.id });
          return;
        }
      }

      const sync: SyncProvenance = { origin: "sync", occurredAt: event.occurredAt, instanceId };

      if (event.operation === "DELETE") {
        if (!serverDoc) {
          await ack(event, event.mongoId!, null, event.entity); // already gone — idempotent
          return;
        }
        if (isStale(event.baseUpdatedAt, serverDoc)) {
          await raiseConflict(event, event.mongoId!, "update", serverDoc); // delete-vs-edit
          return;
        }
        await writer.remove(event.entity, event.mongoId!);
        await ack(event, event.mongoId!, null, event.entity);
        return;
      }

      if (event.operation === "UPDATE") {
        if (serverDoc && isStale(event.baseUpdatedAt, serverDoc)) {
          await raiseConflict(event, event.mongoId!, "update", serverDoc);
          return;
        }
        // A missing doc is a remote delete racing a local edit: recreate it
        // (last-write-wins — there is nothing to conflict against).
        const { updatedAt } = serverDoc
          ? (await writer.update(event.entity, event.mongoId!, event.data ?? {}, sync))!
          : await writer.insert(event.entity, event.data ?? {}, sync, event.mongoId!);
        await ack(event, event.mongoId!, updatedAt, event.entity);
        return;
      }

      // INSERT carrying a known mongoId — an idempotent upsert by _id (a push retry).
      if (event.mongoId) {
        const { mongoId, updatedAt } = await writer.insert(event.entity, event.data ?? {}, sync, event.mongoId);
        await ack(event, mongoId, updatedAt, event.entity);
        return;
      }

      // First INSERT: dedup on the business key so two sides don't create twins.
      const businessKey = config.businessKey;
      const keyValue = businessKey ? event.data?.[businessKey] : undefined;
      if (businessKey && keyValue !== undefined) {
        const existing = await writer.findByBusinessKey(event.entity, keyValue);
        if (existing) {
          await raiseConflict(event, existing._id as string, "duplicate", existing);
          return;
        }
      }

      try {
        const { mongoId, updatedAt } = await writer.insert(event.entity, event.data ?? {}, sync);
        await ack(event, mongoId, updatedAt, event.entity);
      } catch (err) {
        // Lost the race on the unique index — funnel to the same duplicate path.
        if (!isDuplicateKeyError(err) || !businessKey) throw err;
        const existing = await writer.findByBusinessKey(event.entity, keyValue);
        if (!existing) throw err;
        await raiseConflict(event, existing._id as string, "duplicate", existing);
      }
    };

    for (const event of events) {
      const before = applied.length + conflicted.length + rejected.length;
      await processEvent(event);
      const reports = applied.length + conflicted.length + rejected.length - before;

      // Total accounting: an event reported in none of the three arrays would strand
      // the client's pending row and be retried every cycle forever, so anything that
      // fell through every write path is reported as unprocessable instead.
      if (reports === 0) {
        logger.error(
          { entity: event.entity, operation: event.operation, mongoId: event.mongoId, instanceId },
          "sync ingest: event matched no write path — reporting it as unprocessable",
        );
        rejected.push({ id: event.id, reason: "unprocessable" });
      } else if (reports > 1) {
        // Not self-healing (the rows are already pushed) — but a duplicate report is a
        // server bug that would confuse the client's row lifecycle, so make it loud.
        logger.error({ eventId: event.id, reports, instanceId }, "sync ingest: event reported more than once");
      }
    }

    return { applied, conflicts: conflicted, rejected };
  };
};
