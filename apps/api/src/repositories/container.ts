import type { Db } from "mongodb";
import { MongoUserRepository } from "./User/user.repository.mongo.js";

let repositories: { user: MongoUserRepository } | null = null;

export const initContainer = (db: Db) => {
  repositories = {
    user: new MongoUserRepository(db),
  };
};

type Container = NonNullable<typeof repositories>;
export type ContainerKeys = keyof Container;

export const resolve = <K extends ContainerKeys>(key: K): Container[K] => {
  if (!repositories) throw new Error("Container not initialized — call initContainer(db) first");
  return (repositories as Container)[key];
};
