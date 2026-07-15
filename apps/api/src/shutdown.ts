import type { Server } from "http";
import { logger } from "./logger.js";

const FORCE_EXIT_MS = 10_000;

/**
 * Wire SIGTERM/SIGINT handling so the process drains in-flight requests and runs
 * `cleanup` (e.g. close the DB) before exiting. A watchdog forces exit if draining
 * stalls, so a hung connection can't block shutdown until the orchestrator SIGKILLs.
 */
export const setupGracefulShutdown = (
  server: Server,
  cleanup: () => Promise<void>,
  // Optional synchronous step run before draining — e.g. disconnect Socket.IO clients
  // so their WebSocket connections release the HTTP server and `server.close()` can complete.
  beforeClose?: () => void,
): void => {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return; // ignore repeat signals (e.g. double Ctrl-C) while draining
    shuttingDown = true;
    logger.info({ signal }, "Signal received — shutting down gracefully");

    beforeClose?.();

    // Run cleanup at most once, whether draining finishes cleanly or the watchdog fires.
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
      // Draining stalled — still close the DB connections before exiting, so they
      // aren't dropped uncleanly (previously this force-exited without cleanup).
      logger.error("Shutdown timed out — running cleanup then forcing exit");
      void runCleanup(1);
    }, FORCE_EXIT_MS);
    force.unref(); // don't let the watchdog itself keep the process alive

    server.close(() => void runCleanup(0));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};
