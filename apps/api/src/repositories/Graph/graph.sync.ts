/**
 * Wrapper best-effort pour les appels de synchro graphe dans les cas d'usage.
 *
 * Mongo est la source de vérité ; Neo4j n'est qu'une projection. Si Neo4j est
 * down ou qu'un appel de synchro échoue (réseau transitoire, node manquant…)
 * on log et on continue pour que la requête API réussisse malgré tout. En
 * production on ferait transiter ces mutations par un outbox / une file de
 * messages afin de garantir la cohérence à terme (eventual consistency).
 */
import { logger } from "../../logger.js";

// `label` sert uniquement à identifier l'appel dans les logs en cas d'échec.
export const syncGraph = async (label: string, fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    logger.error({ err, label }, "graph-sync failed");
  }
};
