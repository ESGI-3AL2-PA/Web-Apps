import { MongoClient, type Db } from "mongodb";

const url = process.env.MONGODB_URL ?? "mongodb://root:root@localhost:27017";
const dbName = process.env.MONGODB_DB ?? "db";
const client = new MongoClient(url);

export const connectDB = async (): Promise<Db> => {
  await client.connect();
  return client.db(dbName);
};

// Exposed so the transaction helper can start sessions for multi-document writes.
export const getMongoClient = (): MongoClient => client;

// Readiness check: cheap round-trip to the server. Rejects if the connection is
// dead (server down, auth revoked, network partition) so /readyz can return 503.
export const pingDB = async (): Promise<void> => {
  await client.db(dbName).command({ ping: 1 });
};

export const closeDB = async (): Promise<void> => {
  await client.close();
};
