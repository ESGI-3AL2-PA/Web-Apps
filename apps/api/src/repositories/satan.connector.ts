import { createSatanClient, type SatanClient } from "@repo/satan";
import { logger } from "../logger.js";

// Connecteur SATAN de l'api (couche infrastructure). Gère le worker SATAN QL
// singleton (un processus python persistant) utilisé par les repositories SATAN.

let client: SatanClient | null = null;

/**
 * Démarre le worker SATAN QL persistant et le vérifie avant que l'app serve du
 * trafic — reflète `neo4j.connector.ts`. Le worker possède la connexion Mongo (on
 * ne lui transmet que MONGODB_URL / MONGODB_DB) ; la vérification exécute un vrai
 * `FIND`, ce qui prouve toute la chaîne — python + ply + pymongo + accessibilité
 * de Mongo — en une seule fois. Un timeout transforme une dépendance manquante en
 * erreur de démarrage claire plutôt qu'en blocage à la première vraie requête.
 */
export const connectSatan = async (): Promise<SatanClient> => {
  if (client) return client;

  const pythonBin = process.env.SATAN_PYTHON ?? "python3";
  const c = createSatanClient({
    pythonBin,
    mongoUrl: process.env.MONGODB_URL,
    mongoDb: process.env.MONGODB_DB,
  });

  // Capture les lignes stderr du worker pour les joindre au message d'erreur de timeout (et log si SATAN_DEBUG).
  const stderr: string[] = [];
  c.on("stderr", (line: string) => {
    stderr.push(line);
    if (process.env.SATAN_DEBUG) logger.info({ line }, "satan stderr");
  });

  const verify = c.query("FIND _healthcheck");
  verify.catch(() => {}); // absorbe un rejet tardif si le timeout gagne la course

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `SATAN worker did not respond within 5s. Are 'ply' and 'pymongo' installed for ` +
              `'${pythonBin}', and is Mongo reachable? Set SATAN_PYTHON to a python with both.` +
              (stderr.length ? ` Worker stderr: ${stderr.join("").slice(0, 500)}` : ""),
          ),
        ),
      5000,
    );
  });

  // La vérification aboutit, ou le timeout de 5 s l'emporte : la première course terminée décide.
  try {
    await Promise.race([verify, timeout]);
  } catch (err) {
    await c.close().catch(() => {});
    throw err;
  } finally {
    clearTimeout(timer);
  }

  client = c;
  return c;
};

export const closeSatan = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
  }
};
