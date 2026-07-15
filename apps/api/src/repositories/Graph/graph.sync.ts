/**
 * Best-effort wrapper for graph sync calls inside use-cases.
 *
 * Mongo is the source of truth; Neo4j is a projection. If Neo4j is down or a
 * single sync call fails (transient network, missing node, …) we log and
 * continue so the API request still succeeds. A real-world deployment would
 * route these mutations through an outbox / message queue to guarantee
 * eventual consistency.
 */
import { logger } from "../../logger.js";

export const syncGraph = async (label: string, fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    logger.error({ err, label }, "graph-sync failed");
  }
};
