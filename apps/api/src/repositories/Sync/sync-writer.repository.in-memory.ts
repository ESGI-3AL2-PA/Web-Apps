/**
 * Repository (implémentation en mémoire) du writer de synchronisation.
 *
 * Applique le vrai allowlist `pickWritable` et reproduit la gestion `$set`/`$unset`
 * du stamp `_sync` de la version Mongo, pour que les tests exercent le véritable
 * write-model plutôt qu'une approximation écrite à la main.
 */
import { randomUUID } from "crypto";
import type { SyncEntity } from "@repo/contracts";
import { pickWritable } from "../../sync/sync-entity-config.js";
import type { ISyncWriterRepository, SyncDoc, SyncStamp } from "./sync-writer.repository.js";

export class InMemorySyncWriterRepository implements ISyncWriterRepository {
  docs = new Map<string, SyncDoc>();
  /** Injectable pour que les tests obtiennent des `updatedAt` déterministes et ordonnés. */
  now: () => string = () => new Date().toISOString();

  private key = (entity: SyncEntity, id: string) => `${entity}:${id}`;

  // Un stamp null EFFACE `_sync` — c'est ce qui rend une écriture d'origine serveur (une
  // résolution de conflit) visible pour l'instance même dont le push avait déclenché le conflit.
  private stamped(doc: SyncDoc, sync: SyncStamp): SyncDoc {
    if (sync) return { ...doc, _sync: sync };
    const { _sync: _dropped, ...rest } = doc;
    return rest;
  }

  async findById(entity: SyncEntity, id: string): Promise<SyncDoc | null> {
    return this.docs.get(this.key(entity, id)) ?? null;
  }

  // Approximation de la recherche par clé métier : ne compare que sur `email` (seule clé métier en usage).
  async findByBusinessKey(entity: SyncEntity, value: unknown): Promise<SyncDoc | null> {
    for (const [key, doc] of this.docs) {
      if (key.startsWith(`${entity}:`) && doc.email === value) return doc;
    }
    return null;
  }

  async insert(entity: SyncEntity, data: SyncDoc, sync: SyncStamp, id?: string) {
    const mongoId = id ?? randomUUID();
    const updatedAt = this.now();
    const existing = this.docs.get(this.key(entity, mongoId)) ?? {};
    this.docs.set(
      this.key(entity, mongoId),
      this.stamped({ ...existing, ...pickWritable(entity, data), _id: mongoId, updatedAt }, sync),
    );
    return { mongoId, updatedAt };
  }

  async update(entity: SyncEntity, id: string, data: SyncDoc, sync: SyncStamp) {
    const doc = this.docs.get(this.key(entity, id));
    if (!doc) return null;
    const updatedAt = this.now();
    this.docs.set(this.key(entity, id), this.stamped({ ...doc, ...pickWritable(entity, data), updatedAt }, sync));
    return { updatedAt };
  }

  async remove(entity: SyncEntity, id: string) {
    return this.docs.delete(this.key(entity, id));
  }

  async touch(entity: SyncEntity, id: string) {
    const doc = this.docs.get(this.key(entity, id));
    if (!doc) return null;
    const updatedAt = this.now();
    this.docs.set(this.key(entity, id), this.stamped({ ...doc, updatedAt }, null));
    return { updatedAt };
  }
}
