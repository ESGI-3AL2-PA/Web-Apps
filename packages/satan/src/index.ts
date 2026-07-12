/**
 * Public entry point for @repo/satan.
 * Consumed by apps/api: `import { createSatanClient } from "@repo/satan";`
 */

export { SatanClient, createSatanClient } from "./SatanClient";
export type { SatanClientOptions } from "./SatanClient";
export { quote } from "./quote";
export type { Scalar } from "./quote";
export { SatanQueryError } from "./types";
export type {
  SatanOp,
  SatanResponse,
  MongoFindOp,
  MongoInsertOp,
  MongoUpdateOp,
  MongoDeleteOp,
  MongoFilter,
  MongoDocument,
} from "./types";
