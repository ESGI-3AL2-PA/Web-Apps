import { randomUUID } from "crypto";
import type { SyncEntity } from "@repo/contracts";
import { pickWritable } from "../../sync/sync-entity-config.js";
import type { ISyncWriterRepository, SyncDoc, SyncStamp } from "./sync-writer.repository.js";

/**
 * In-memory sync writer. Runs the real `pickWritable` allowlist and mirrors the Mongo
 * writer's `$set`/`$unset` handling of `_sync`, so tests exercise the actual
 * write-model rather than a hand-written approximation of it.
 */
export class InMemorySyncWriterRepository implements ISyncWriterRepository {
  docs = new Map<string, SyncDoc>();
  /** Injectable so tests get deterministic, ordered `updatedAt` values. */
  now: () => string = () => new Date().toISOString();

  private key = (entity: SyncEntity, id: string) => `${entity}:${id}`;

  // A null stamp CLEARS `_sync` — that is what makes a server-origin write (a conflict
  // resolution) visible to the very instance whose push raised the conflict.
  private stamped(doc: SyncDoc, sync: SyncStamp): SyncDoc {
    if (sync) return { ...doc, _sync: sync };
    const { _sync: _dropped, ...rest } = doc;
    return rest;
  }

  async findById(entity: SyncEntity, id: string): Promise<SyncDoc | null> {
    return this.docs.get(this.key(entity, id)) ?? null;
  }

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
