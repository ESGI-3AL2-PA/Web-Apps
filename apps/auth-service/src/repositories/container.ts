import type { Db } from "mongodb";
import { MongoRefreshTokenRepository } from "./RefreshToken/refresh-token.repository.mongo.js";
import { MongoUserReaderRepository } from "./User/user-reader.repository.mongo.js";
import { MongoAuthTokenRepository } from "./AuthToken/auth-token.repository.mongo.js";
import { MongoDistrictAdminReaderRepository } from "./DistrictAdmin/district-admin-reader.repository.mongo.js";

type Container = {
  refreshToken: MongoRefreshTokenRepository;
  userReader: MongoUserReaderRepository;
  authToken: MongoAuthTokenRepository;
  districtAdmin: MongoDistrictAdminReaderRepository;
};

let repositories: Container | null = null;

export const initContainer = (db: Db) => {
  repositories = {
    refreshToken: new MongoRefreshTokenRepository(db),
    userReader: new MongoUserReaderRepository(db),
    authToken: new MongoAuthTokenRepository(db),
    districtAdmin: new MongoDistrictAdminReaderRepository(db),
  };
};

export type ContainerKeys = keyof Container;

export const resolve = <K extends ContainerKeys>(key: K): Container[K] => {
  if (!repositories) throw new Error("Container not initialized — call initContainer(db) first");
  return repositories[key];
};
