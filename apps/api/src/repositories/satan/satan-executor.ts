import type { Db, Document, Filter, OptionalUnlessRequiredId, Sort } from "mongodb";
import type { SatanOp } from "@repo/satan";

/**
 * Executes a `SatanOp` descriptor (produced by @repo/satan) against Mongo.
 * @repo/satan only *translates* SATAN QL; running the descriptor lives here so
 * the package stays driver-free.
 */
export type SatanExecResult =
  | { op: "find"; docs: Document[] }
  | { op: "insertOne"; insertedId: unknown }
  | { op: "updateMany"; matchedCount: number; modifiedCount: number }
  | { op: "deleteMany"; deletedCount: number };

export async function runSatanOp(db: Db, op: SatanOp): Promise<SatanExecResult> {
  const collection = db.collection(op.collection);

  switch (op.op) {
    case "find": {
      const docs = await collection
        .find(op.filter as Filter<Document>, {
          projection: op.projection,
          sort: op.sort ? (Object.fromEntries(op.sort) as Sort) : undefined,
          limit: op.limit,
          skip: op.skip,
        })
        .toArray();
      return { op: "find", docs };
    }
    case "insertOne": {
      const result = await collection.insertOne(op.document as OptionalUnlessRequiredId<Document>);
      return { op: "insertOne", insertedId: result.insertedId };
    }
    case "updateMany": {
      const result = await collection.updateMany(op.filter as Filter<Document>, op.update);
      return { op: "updateMany", matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    }
    case "deleteMany": {
      const result = await collection.deleteMany(op.filter as Filter<Document>);
      return { op: "deleteMany", deletedCount: result.deletedCount };
    }
  }
}
