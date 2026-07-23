// Cas d'usage sync : ingère un lot d'événements offline poussés par une instance desktop.
// Cœur du protocole de synchronisation côté serveur — décide, événement par événement,
// entre appliqué / conflit (quarantaine) / rejeté, avec autorisation par quartier,
// détection de concurrence optimiste (baseUpdatedAt) et dédoublonnage.
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

/** Dépendances du cas d'usage : writer Mongo, repository des conflits, projection graphe. */
export interface IngestDeps {
  writer: ISyncWriterRepository;
  conflicts: ISyncConflictsRepository;
  graph: IGraphRepository;
}

/** Paramètres d'un appel : le lot d'événements, l'instance émettrice, le scope (quartier autorisé). */
export interface IngestParams {
  events: IngestEventDto[];
  instanceId: string;
  scope: SyncScope;
}

/** Le token de concurrence optimiste du client est périmé ssi il a été envoyé et diffère du serveur. */
const isStale = (baseUpdatedAt: string | undefined, serverDoc: SyncDoc): boolean =>
  baseUpdatedAt !== undefined && serverDoc.updatedAt !== baseUpdatedAt;

/**
 * Applique un lot d'événements offline poussés par une instance desktop.
 *
 * Trois issues possibles par événement, calquées sur le contrat réseau (§4.1) :
 * `applied` (avec l'`updatedAt` exact persisté, pour que le client avance son token
 * directement depuis l'ack), `conflicts` (mis en quarantaine, rien n'est écrasé — le
 * client conserve sa ligne en attente), et `rejected` (refus d'autorisation qui ne
 * pourra jamais réussir en réessayant, le client abandonne la ligne au lieu de boucler).
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

      // Les quartiers ne circulent que serveur → client (§5.3).
      if (!config.ingestAllowed) {
        logger.warn({ entity: event.entity, instanceId }, "sync ingest: refused a write to a read-only entity");
        rejected.push({ id: event.id, reason: "read-only-entity" });
        return;
      }

      // Un UPDATE/DELETE ne désigne aucun enregistrement serveur : structurellement
      // impossible, ce n'est pas une question d'autorisation. On le signale pour que le
      // client abandonne la ligne au lieu de réessayer.
      if (event.operation !== "INSERT" && !event.mongoId) {
        logger.warn(
          { entity: event.entity, operation: event.operation, instanceId },
          "sync ingest: rejected an UPDATE/DELETE carrying no mongoId",
        );
        rejected.push({ id: event.id, reason: "unprocessable" });
        return;
      }

      const serverDoc = event.mongoId ? await writer.findById(event.entity, event.mongoId) : null;

      // Autorisation par quartier. Pour un UPDATE/DELETE, c'est le doc SERVEUR qui
      // tranche : un client ne peut donc pas faire passer en fraude un enregistrement
      // d'un autre quartier en réétiquetant son payload.
      const targetDistrict = districtOf(event.entity, serverDoc ?? event.data);
      if (!scopeAllowsDistrict(scope, targetDistrict)) {
        logger.warn(
          { entity: event.entity, mongoId: event.mongoId, instanceId },
          "sync ingest: rejected an out-of-district event",
        );
        rejected.push({ id: event.id, reason: "out-of-district" });
        return;
      }

      // Un enregistrement avec un conflit ouvert bloque les ingestions suivantes : on
      // rafraîchit le snapshot local capturé et on ré-acquitte le même conflit plutôt
      // que d'empiler de nouvelles lignes.
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
          await ack(event, event.mongoId!, null, event.entity); // déjà disparu — idempotent
          return;
        }
        if (isStale(event.baseUpdatedAt, serverDoc)) {
          await raiseConflict(event, event.mongoId!, "update", serverDoc); // suppression vs édition
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
        // Un doc absent = une suppression distante en concurrence avec une édition
        // locale : on le recrée (last-write-wins — il n'y a rien contre quoi entrer en conflit).
        const { updatedAt } = serverDoc
          ? (await writer.update(event.entity, event.mongoId!, event.data ?? {}, sync))!
          : await writer.insert(event.entity, event.data ?? {}, sync, event.mongoId!);
        await ack(event, event.mongoId!, updatedAt, event.entity);
        return;
      }

      // INSERT portant un mongoId connu — upsert idempotent par _id (un réessai de push).
      if (event.mongoId) {
        const { mongoId, updatedAt } = await writer.insert(event.entity, event.data ?? {}, sync, event.mongoId);
        await ack(event, mongoId, updatedAt, event.entity);
        return;
      }

      // Premier INSERT : dédoublonnage sur la clé métier pour que deux côtés ne créent pas de jumeaux.
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
        // Perdu la course sur l'index unique — on aiguille vers le même chemin de doublon.
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

      // Comptabilité totale : un événement présent dans aucun des trois tableaux
      // laisserait la ligne en attente du client bloquée et serait réessayé à chaque
      // cycle indéfiniment ; tout ce qui traverse tous les chemins d'écriture sans en
      // emprunter aucun est donc reporté comme « unprocessable ».
      if (reports === 0) {
        logger.error(
          { entity: event.entity, operation: event.operation, mongoId: event.mongoId, instanceId },
          "sync ingest: event matched no write path — reporting it as unprocessable",
        );
        rejected.push({ id: event.id, reason: "unprocessable" });
      } else if (reports > 1) {
        // Non auto-réparable (les lignes sont déjà poussées) — mais un double report est
        // un bug serveur qui perturberait le cycle de vie des lignes du client : on le
        // rend bruyant.
        logger.error({ eventId: event.id, reports, instanceId }, "sync ingest: event reported more than once");
      }
    }

    return { applied, conflicts: conflicted, rejected };
  };
};
