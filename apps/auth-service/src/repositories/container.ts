import type { Db } from "mongodb";
import { createContainer } from "@repo/shared";
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

const { set, resolve } = createContainer<Container>();
export type ContainerKeys = keyof Container;
export { resolve };

export const initContainer = (db: Db) => {
  set({
    refreshToken: new MongoRefreshTokenRepository(db),
    userReader: new MongoUserReaderRepository(db),
    authToken: new MongoAuthTokenRepository(db),
    districtAdmin: new MongoDistrictAdminReaderRepository(db),
  });
};
