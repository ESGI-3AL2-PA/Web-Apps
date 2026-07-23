import neo4j, { type Driver } from "neo4j-driver";

// Connecteur Neo4j de l'api (couche infrastructure). Gère un driver singleton
// vers la base graphe, qui est une projection (Mongo reste la source de vérité).

const url = process.env.NEO4J_URL ?? "bolt://localhost:7687";
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

let driver: Driver | null = null;

/** Ouvre (ou renvoie) le driver Neo4j partagé, en vérifiant la connectivité au démarrage. */
export const connectNeo4j = async (): Promise<Driver> => {
  if (driver) return driver;
  if (!user || !password) {
    throw new Error("NEO4J_USER and NEO4J_PASSWORD must be set");
  }
  const d = neo4j.driver(url, neo4j.auth.basic(user, password));
  // Vérifie la connectivité une fois au démarrage ; remonte une erreur claire si la base est down.
  // Ferme le driver en cas d'échec pour qu'un appelant qui réessaie ne fuite pas un pool par tentative.
  try {
    await d.verifyConnectivity();
  } catch (err) {
    await d.close().catch(() => {});
    throw err;
  }
  driver = d;
  return d;
};

// Contrôle de disponibilité (readiness) : vérifie que le driver atteint le cluster.
// Rejette si le driver n'a jamais été initialisé ou si la connectivité est perdue.
// Neo4j étant une projection (Mongo est la source de vérité), /readyz traite son
// échec comme « dégradé », pas « down ».
export const pingNeo4j = async (): Promise<void> => {
  if (!driver) throw new Error("Neo4j driver not initialized");
  await driver.verifyConnectivity();
};

export const closeNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};
