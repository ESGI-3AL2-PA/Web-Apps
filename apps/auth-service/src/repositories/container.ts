import type { Db } from "mongodb";
import { createContainer } from "@repo/shared";
import { MongoRefreshTokenRepository } from "./RefreshToken/refresh-token.repository.mongo.js";
import { MongoUserReaderRepository } from "./User/user-reader.repository.mongo.js";
import { MongoAuthTokenRepository } from "./AuthToken/auth-token.repository.mongo.js";
import { MongoDistrictAdminReaderRepository } from "./DistrictAdmin/district-admin-reader.repository.mongo.js";
import { MongoAuthorizationCodeRepository } from "./AuthorizationCode/authorization-code.repository.mongo.js";

// Conteneur d'injection de dépendances des repositories de l'auth-service. initContainer()
// instancie chaque repository Mongo une fois au démarrage ; les handlers de route les
// récupèrent ensuite via resolve("nom"). ContainerKeys énumère les clés disponibles.

type Container = {
  refreshToken: MongoRefreshTokenRepository;
  userReader: MongoUserReaderRepository;
  authToken: MongoAuthTokenRepository;
  districtAdmin: MongoDistrictAdminReaderRepository;
  authorizationCode: MongoAuthorizationCodeRepository;
};

const { set, resolve } = createContainer<Container>();
export type ContainerKeys = keyof Container;
export { resolve };

/** Instancie et enregistre tous les repositories Mongo. À appeler une fois au démarrage. */
export const initContainer = (db: Db) => {
  set({
    refreshToken: new MongoRefreshTokenRepository(db),
    userReader: new MongoUserReaderRepository(db),
    authToken: new MongoAuthTokenRepository(db),
    districtAdmin: new MongoDistrictAdminReaderRepository(db),
    authorizationCode: new MongoAuthorizationCodeRepository(db),
  });
};
