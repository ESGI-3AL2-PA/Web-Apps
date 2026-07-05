import neo4j, { type Driver } from "neo4j-driver";

const url = process.env.NEO4J_URL ?? "bolt://localhost:7687";
const user = process.env.NEO4J_USER ?? "undefined";
const password = process.env.NEO4J_PASSWORD ?? "undefined";

let driver: Driver | null = null;

export const connectNeo4j = async (): Promise<Driver> => {
  if (driver) return driver;
  const d = neo4j.driver(url, neo4j.auth.basic(user, password));
  // Verify connectivity once at boot; surface a clear error if the DB is down.
  await d.verifyConnectivity();
  driver = d;
  return d;
};

export const getDriver = (): Driver => {
  if (!driver) throw new Error("Neo4j driver not initialized — call connectNeo4j() first");
  return driver;
};

export const closeNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};
