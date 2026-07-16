import { MongoClient, type Db } from "mongodb";

export interface MongoConnector {
  /** Connect (idempotent — the driver pools) and return the app database handle. */
  connectDB: () => Promise<Db>;
  /** The underlying client, exposed so the tx helper can start sessions for multi-document writes. */
  getMongoClient: () => MongoClient;
  /**
   * Readiness check: cheap round-trip to the server. Rejects if the connection is
   * dead (server down, auth revoked, network partition) so /readyz can return 503.
   */
  pingDB: () => Promise<void>;
  closeDB: () => Promise<void>;
}

/**
 * Builds a Mongo connector bound to a single shared client. Both backends were
 * maintaining a byte-identical connector; this is the one source of truth. Defaults
 * come from the same env vars the apps used (read once, at construction).
 */
export const createMongoConnector = (
  url: string = process.env.MONGODB_URL ?? "mongodb://root:root@localhost:27017",
  dbName: string = process.env.MONGODB_DB ?? "db",
): MongoConnector => {
  const client = new MongoClient(url);

  return {
    connectDB: async () => {
      await client.connect();
      return client.db(dbName);
    },
    getMongoClient: () => client,
    pingDB: async () => {
      await client.db(dbName).command({ ping: 1 });
    },
    closeDB: async () => {
      await client.close();
    },
  };
};
