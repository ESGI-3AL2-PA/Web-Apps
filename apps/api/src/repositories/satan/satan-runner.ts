import type { Db, Document } from "mongodb";
import type { SatanClient } from "@repo/satan";
import { runSatanOp } from "./satan-executor.js";

export type Scalar = string | number | boolean | null;

/** SATAN QL can only carry scalar literals — everything else must use Mongo. */
export const isScalar = (v: unknown): v is Scalar =>
  v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/** True when every own value of `data` (ignoring `undefined`) is a scalar. */
export const allScalar = (data: Record<string, unknown>): boolean =>
  Object.values(data).every((v) => v === undefined || isScalar(v));

/**
 * Thin helper the SATAN-backed repositories build their queries on: compiles a
 * SATAN QL string via the worker, runs the resulting op against Mongo, and maps
 * the Mongo `_id` back to the domain `id` (same shape the Mongo repos return).
 */
export class SatanQueryRunner {
  constructor(
    private readonly client: SatanClient,
    private readonly db: Db,
  ) {}

  /** Render a JS scalar as a SATAN QL literal, escaping strings so a value
   *  coming from a request can't break out of the query. */
  q(v: Scalar): string {
    if (v === null) return "NULL";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error("Cannot embed a non-finite number in SATAN QL");
      return String(v);
    }
    const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    return `"${escaped}"`;
  }

  /** Build the `SET field = value, ...` body of an INSERT/UPDATE from a plain
   *  object, skipping `undefined`. Caller must have checked `allScalar` first. */
  assignments(data: Record<string, Scalar | undefined>): string {
    return Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([field, v]) => `${field} = ${this.q(v as Scalar)}`)
      .join(", ");
  }

  private toDomain<T>(doc: Document): T {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest } as T;
  }

  async find<T>(ql: string): Promise<T[]> {
    const op = await this.client.query(ql);
    const res = await runSatanOp(this.db, op);
    if (res.op !== "find") throw new Error(`SATAN: expected a find op, got ${res.op}`);
    return res.docs.map((d) => this.toDomain<T>(d));
  }

  async findOne<T>(ql: string): Promise<T | null> {
    const rows = await this.find<T>(ql);
    return rows[0] ?? null;
  }

  async insert(ql: string): Promise<void> {
    const op = await this.client.query(ql);
    const res = await runSatanOp(this.db, op);
    if (res.op !== "insertOne") throw new Error(`SATAN: expected an insertOne op, got ${res.op}`);
  }

  async update(ql: string): Promise<number> {
    const op = await this.client.query(ql);
    const res = await runSatanOp(this.db, op);
    if (res.op !== "updateMany") throw new Error(`SATAN: expected an updateMany op, got ${res.op}`);
    return res.modifiedCount;
  }

  /** Run an `UPDATE ... WHERE _id = id`, then re-read the doc to return it
   *  (SATAN's updateMany can't return the mutated document itself). */
  async updateReturning<T>(collection: string, id: string, updateQl: string): Promise<T | null> {
    await this.update(updateQl);
    return this.findOne<T>(`FIND ${collection} WHERE _id = ${this.q(id)}`);
  }

  async delete(ql: string): Promise<number> {
    const op = await this.client.query(ql);
    const res = await runSatanOp(this.db, op);
    if (res.op !== "deleteMany") throw new Error(`SATAN: expected a deleteMany op, got ${res.op}`);
    return res.deletedCount;
  }
}
