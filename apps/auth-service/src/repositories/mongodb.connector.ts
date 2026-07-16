import { createMongoConnector } from "@repo/server-kit";

// One shared client for the whole app. The connector logic lives in @repo/server-kit;
// this binds it to the auth-service's env and re-exports the functions the app imports.
const connector = createMongoConnector();

export const connectDB = connector.connectDB;
export const pingDB = connector.pingDB;
export const closeDB = connector.closeDB;
