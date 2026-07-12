import neo4j, { type Driver } from "neo4j-driver";

const url = process.env.NEO4J_URL ?? "bolt://localhost:7687";
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

let driver: Driver | null = null;

export const connectNeo4j = async (): Promise<Driver> => {
  if (driver) return driver;
  if (!user || !password) {
    throw new Error("NEO4J_USER and NEO4J_PASSWORD must be set");
  }
  const d = neo4j.driver(url, neo4j.auth.basic(user, password));
  // Verify connectivity once at boot; surface a clear error if the DB is down.
  await d.verifyConnectivity();
  driver = d;
  return d;
};

export const closeNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};
