// Shared server infrastructure for the api + auth-service backends. Both were
// scaffolded from one template with no shared package, so cross-cutting infra got
// copy-pasted; this is the single source of truth for it.
//
// NOTE: `./load-env` is intentionally NOT re-exported here — import it for its side
// effect FIRST (`import "@repo/shared/load-env"`) before any env-reading module.

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
