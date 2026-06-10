import { MongoClient, type Db } from "mongodb";

const url = process.env.MONGODB_URL ?? "mongodb://root:root@localhost:27017";
const dbName = process.env.MONGODB_DB ?? "db";
const client = new MongoClient(url);

export const connectDB = async (): Promise<Db> => {
  await client.connect();
  return client.db(dbName);
};
