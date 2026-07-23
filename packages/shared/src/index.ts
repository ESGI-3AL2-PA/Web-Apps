// Infrastructure serveur partagée par les backends api + auth-service. Les deux
// ont été générés depuis un même template sans package commun ; l'infra
// transverse s'est donc retrouvée copiée-collée. Ce module en est la source unique.
//
// NOTE : `./load-env` n'est volontairement PAS ré-exporté ici — il faut l'importer
// pour son effet de bord EN PREMIER (`import "@repo/shared/load-env"`), avant tout
// module qui lit l'environnement.

export { logger, createLogger } from "./logger.js";
export { createMongoConnector, type MongoConnector } from "./mongo-connector.js";
export { setupGracefulShutdown } from "./shutdown.js";
export { withRetry, type RetryOptions } from "./retry.js";
export { AppError, NotFoundError, errorHandler } from "./error-handler.js";
export { requestValidationErrorHandler, validationMessage } from "./request-validation-error-handler.js";
export { createContainer, type Container } from "./container.js";
export { toEntity, toDoc, type WithMongoId } from "./mongo-id.js";
export { USERS_COLLECTION, DISTRICT_ADMINS_COLLECTION } from "./collections.js";
export { userDocumentSchema, UserRoleSchema, type UserDocument, type UserRole } from "./user-document.js";
export { syncProvenanceSchema, type SyncProvenance } from "./sync-provenance.js";
export { districtAdminDocumentSchema, type DistrictAdminDocument } from "./district-admin-document.js";
export {
  TOKEN_ISSUER,
  TOKEN_ALG,
  TOKEN_AUDIENCE,
  TOKEN_AUDIENCE_INTERNAL,
  TOKEN_AUDIENCE_STEP_UP,
  TOKEN_AUDIENCE_ENROLL,
  type AccessTokenClaims,
  type StepUpClaims,
} from "./tokens.js";
