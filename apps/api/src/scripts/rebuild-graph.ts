/**
 * Graph reconciliation script — wipes the Neo4j projection and rebuilds it from
 * Mongo (the source of truth), healing any drift accumulated by the best-effort
 * per-request syncGraph writes.
 *
 * Usage:
 *   npm run graph:rebuild        # from apps/api
 *   tsx src/scripts/rebuild-graph.ts
 *
 * Safe to run repeatedly; it is a full rebuild (reset + replay), not an incremental sync.
 */

import { connectDB, closeDB } from "../repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j } from "../repositories/neo4j.connector.js";
import { initContainer, resolve } from "../repositories/container.js";
import { rebuildGraphUseCase } from "../use-cases/graph/rebuild-graph.use-case.js";

const main = async (): Promise<void> => {
  const db = await connectDB();
  const driver = await connectNeo4j();
  initContainer(db, driver);

  console.warn("⟳  Rebuilding Neo4j projection from Mongo…");
  const stats = await rebuildGraphUseCase({
    userRepository: resolve("user"),
    districtRepository: resolve("district"),
    eventRepository: resolve("event"),
    listingRepository: resolve("listing"),
    voteRepository: resolve("vote"),
    incidentRepository: resolve("incident"),
    tagRepository: resolve("tag"),
    graphRepository: resolve("graph"),
  })();
  console.warn("✓  Graph rebuilt:", JSON.stringify(stats));

  await closeNeo4j();
  await closeDB();
  process.exit(0);
};

void main().catch(async (err) => {
  console.error("Graph rebuild failed:", err);
  await closeNeo4j().catch(() => {});
  await closeDB().catch(() => {});
  process.exit(1);
});
