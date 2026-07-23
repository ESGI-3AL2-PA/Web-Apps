// Config — logger pino partagé (voir @repo/shared). Réexporté ici pour que les
// nombreux `import { logger } from "../logger.js"` restent stables.
export { logger, createLogger } from "@repo/shared";
