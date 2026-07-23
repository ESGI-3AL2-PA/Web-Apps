/**
 * Repository (implémentation Mongo) : couche d'accès au flux de changements de synchronisation.
 *
 * Chaque entrée du flux `sync_changes` porte un `index` monotone (fourni par le
 * compteur) qui sert de curseur aux clients hors-ligne. Ce repository ajoute les
 * entrées, résout leur `districtId` (dénormalisé pour le filtrage par quartier), et
 * pagine le flux selon le scope du demandeur.
 */
import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import { districtOf } from "../../sync/sync-entity-config.js";
import type { ICounterRepository } from "./counter.repository.js";
import type { ISyncChangesRepository, NewSyncChange, SyncChange } from "./sync-changes.repository.js";

type SyncChangeDoc = WithMongoId<SyncChange>;

// Clé du compteur qui fabrique l'`index` monotone de chaque entrée du flux.
export const SYNC_CHANGES_COUNTER = "sync_changes";

export class MongoSyncChangesRepository implements ISyncChangesRepository {
  private collection: Collection<SyncChangeDoc>;

  constructor(
    db: Db,
    private counters: ICounterRepository,
  ) {
    this.collection = db.collection<SyncChangeDoc>("sync_changes");
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ index: 1 }, { unique: true }),
      // Soutient le parcours du flux filtré par quartier.
      this.collection.createIndex({ index: 1, districtId: 1 }),
      // Soutient la recherche d'héritage de quartier pour un DELETE.
      this.collection.createIndex({ mongoId: 1, index: -1 }),
    ]);
  }

  /** Ajoute une entrée au flux en lui assignant l'`index` suivant et son `districtId` résolu. */
  async append(change: NewSyncChange): Promise<SyncChange> {
    const districtId = await this.resolveDistrictId(change);
    const index = await this.counters.next(SYNC_CHANGES_COUNTER);
    const doc: SyncChangeDoc = { ...change, _id: randomUUID(), index, districtId };
    await this.collection.insertOne(doc);
    return toEntity<SyncChange>(doc);
  }

  // Détermine le quartier d'une entrée. Pour un DELETE, le document est déjà parti :
  // le quartier est hérité de l'entrée antérieure la plus récente sur le même mongoId.
  private async resolveDistrictId(change: NewSyncChange): Promise<string | null> {
    const fromData = districtOf(change.entity, change.data);
    if (fromData) return fromData;
    // Un DELETE de quartier reste rattaché à son propre id, qui est le mongoId.
    if (change.entity === "district") return change.mongoId;
    if (change.operation !== "DELETE") return null;
    const previous = await this.collection.findOne({ mongoId: change.mongoId }, { sort: { index: -1 } });
    return previous?.districtId ?? null;
  }

  /** Renvoie une page du flux (index croissant), filtrée par le scope de quartier du demandeur. */
  async list(params: {
    since: number;
    limit: number;
    excludeInstance?: string;
    scope: { all: true } | { districtId: string } | { empty: true };
  }): Promise<SyncChange[]> {
    const { since, limit, excludeInstance, scope } = params;

    const filter: Filter<SyncChangeDoc> = { index: { $gt: since } };
    // Exclut les entrées issues de l'instance appelante (évite qu'elle se ré-ingère son propre push).
    if (excludeInstance) filter.originInstanceId = { $ne: excludeInstance };

    // Les quartiers sont des données de référence : tout demandeur les reçoit quel que
    // soit son scope, pour que le client affiche des noms lisibles hors-ligne. Aucune PII.
    if ("districtId" in scope) {
      filter.$or = [{ entity: "district" }, { districtId: scope.districtId }];
    } else if ("empty" in scope) {
      // Scope vide (pas de quartier rattaché) : seules les entrées de quartier sont visibles.
      filter.entity = "district";
    }

    const docs = await this.collection.find(filter).sort({ index: 1 }).limit(limit).toArray();
    return docs.map((d) => toEntity<SyncChange>(d));
  }
}
