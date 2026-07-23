// Utilitaire partagé (couche « infrastructure/boot »). Fournit un wrapper de
// réessai avec backoff exponentiel.
import { logger } from "./logger.js";

export interface RetryOptions {
  /** Nombre max de tentatives avant d'abandonner (défaut 10). */
  retries?: number;
  /** Délai avant le premier réessai, en ms (défaut 1000). Double à chaque tentative. */
  minDelayMs?: number;
  /** Plafond du délai de backoff, en ms (défaut 5000). */
  maxDelayMs?: number;
  /** Libellé lisible utilisé dans la ligne de log de chaque tentative échouée. */
  label?: string;
}

/**
 * Exécute `fn`, en réessayant avec un backoff exponentiel à chaque rejet. Utilisé
 * au démarrage pour absorber un datastore qui n'accepte pas encore les connexions :
 * `depends_on: service_healthy` n'ordonne que le *premier* démarrage, et
 * tsx --watch ne relance pas l'entrypoint après une sortie fatale — sans cela, un
 * incident transitoire de la DB au (re)boot bloquerait le process de dev jusqu'à
 * ce qu'un fichier change. Repropage la dernière erreur une fois les tentatives
 * épuisées.
 */
export const withRetry = async <T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> => {
  const { retries = 10, minDelayMs = 1000, maxDelayMs = 5000, label = "operation" } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      // Backoff exponentiel plafonné : minDelayMs * 2^(tentative-1), borné par maxDelayMs.
      const delay = Math.min(maxDelayMs, minDelayMs * 2 ** (attempt - 1));
      logger.warn({ err, attempt, retries, delayMs: delay }, `${label} failed — retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};
