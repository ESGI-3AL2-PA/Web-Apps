/**
 * Script de réconciliation du graphe — efface la projection Neo4j et la reconstruit
 * depuis Mongo (la source de vérité), corrigeant toute dérive accumulée par les
 * écritures graphe best-effort faites à chaque requête (syncGraph).
 *
 * Usage :
 *   npm run graph:rebuild        # depuis apps/api
 *   tsx src/scripts/rebuild-graph.ts
 *
 * Rejouable sans risque : reconstruction complète (reset + replay), pas une sync incrémentale.
 */

import { connectDB, closeDB } from "../repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j } from "../repositories/neo4j.connector.js";
import { initContainer, resolve } from "../repositories/container.js";
import { rebuildGraphUseCase } from "../use-cases/graph/rebuild-graph.use-case.js";

const main = async (): Promise<void> => {
  // Ouvre les deux connexions et amorce le container de repositories : le cas d'usage
  // résout ensuite ses dépendances via `resolve(...)` comme en runtime.
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
