// Utilitaire partagé (couche « cycle de vie du process »). Câble l'arrêt gracieux
// des serveurs HTTP des deux backends.
import type { Server } from "http";
import { logger } from "./logger.js";

// Délai au-delà duquel le watchdog force la sortie si le drainage n'aboutit pas.
const FORCE_EXIT_MS = 10_000;

/**
 * Câble la gestion de SIGTERM/SIGINT afin que le process draine les requêtes en
 * cours et exécute `cleanup` (ex. fermer la DB) avant de sortir. Un watchdog force
 * la sortie si le drainage se bloque, pour qu'une connexion figée ne retienne pas
 * l'arrêt jusqu'au SIGKILL de l'orchestrateur.
 */
export const setupGracefulShutdown = (
  server: Server,
  cleanup: () => Promise<void>,
  // Étape synchrone optionnelle exécutée avant le drainage — ex. déconnecter les
  // clients Socket.IO pour que leurs connexions WebSocket libèrent le serveur HTTP
  // et que `server.close()` puisse aboutir.
  beforeClose?: () => void,
): void => {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return; // ignore les signaux répétés (ex. double Ctrl-C) pendant le drainage
    shuttingDown = true;
    logger.info({ signal }, "Signal received — shutting down gracefully");

    beforeClose?.();

    // N'exécute cleanup qu'une seule fois, que le drainage se termine proprement ou que le watchdog se déclenche.
    let cleaned = false;
    const runCleanup = async (code: number) => {
      if (cleaned) return;
      cleaned = true;
      try {
        await cleanup();
        logger.info("Closed HTTP server and DB connection — bye");
        process.exit(code);
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    };

    const force = setTimeout(() => {
      // Drainage bloqué — on ferme quand même les connexions DB avant de sortir,
      // pour ne pas les couper salement (auparavant on forçait la sortie sans cleanup).
      logger.error("Shutdown timed out — running cleanup then forcing exit");
      void runCleanup(1);
    }, FORCE_EXIT_MS);
    force.unref(); // ne pas laisser le watchdog lui-même maintenir le process en vie

    server.close(() => void runCleanup(0));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};
