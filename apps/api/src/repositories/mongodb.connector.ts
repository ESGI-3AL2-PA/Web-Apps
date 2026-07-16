import { createMongoConnector } from "@repo/server-kit";

// One shared client for the whole app. The connector logic lives in @repo/server-kit;
// this binds it to the api's env and re-exports the functions the app imports.
const connector = createMongoConnector();

export const connectDB = connector.connectDB;
// Exposed so the transaction helper can start sessions for multi-document writes.
export const getMongoClient = connector.getMongoClient;
export const pingDB = connector.pingDB;
export const closeDB = connector.closeDB;
