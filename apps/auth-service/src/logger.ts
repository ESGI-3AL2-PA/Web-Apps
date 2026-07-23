// La configuration du logger pino est partagée — voir @repo/shared. Ré-exportée ici pour
// que les nombreux sites d'appel `import { logger } from "./logger.js"` restent stables.
export { logger, createLogger } from "@repo/shared";
