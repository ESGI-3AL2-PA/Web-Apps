import type { ClientSession } from "mongodb";
import { getMongoClient } from "./mongodb.connector.js";
import { logger } from "../logger.js";

/**
 * Wrapper de transaction Mongo tolérant à la topologie du serveur.
 *
 * Sonde mise en cache de la capacité du serveur : null = inconnu, true = replica set
 * (les transactions fonctionnent), false = serveur standalone (transactions non
 * supportées, on retombe sur des écritures séquentielles).
 */
let txSupported: boolean | null = null;

// Reconnaît l'erreur remontée par le serveur quand on ouvre une transaction sur un
// serveur standalone (non-replica-set) — on la détecte par le message pour basculer.
const isNoTransactionSupportError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /only allowed on a replica set|Transactions are not supported|replica set member or mongos/i.test(msg);
};

/**
 * Exécute `fn` dans une transaction Mongo multi-documents quand le serveur le
 * supporte (replica set) ; sur un serveur standalone, détecte l'absence de support
 * une seule fois puis retombe sur l'exécution de `fn` sans session (écritures
 * séquentielles). Le même code monétaire fonctionne donc en dev mono-nœud et en
 * déploiement replica set — atomique quand c'est possible, best-effort sinon (les
 * appelants conservent leur logging de repli).
 *
 * L'erreur de capacité est levée par le serveur à la première tentative d'écriture,
 * avant tout commit, donc retomber et ré-exécuter `fn(undefined)` est sans risque.
 */
export const runInTransaction = async <T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> => {
  // Support déjà écarté lors d'un appel précédent : on court-circuite directement.
  if (txSupported === false) return fn(undefined);

  const session = getMongoClient().startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    txSupported = true;
    return result!;
  } catch (err) {
    // Première rencontre de l'incapacité : on mémorise le repli pour les prochains appels.
    if (txSupported === null && isNoTransactionSupportError(err)) {
      txSupported = false;
      logger.warn("Mongo transactions unavailable (standalone server) — using sequential writes");
      return fn(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
};
