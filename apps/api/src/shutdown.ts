import type { Server } from "http";

const FORCE_EXIT_MS = 10_000;

/**
 * Wire SIGTERM/SIGINT handling so the process drains in-flight requests and runs
 * `cleanup` (e.g. close the DB) before exiting. A watchdog forces exit if draining
 * stalls, so a hung connection can't block shutdown until the orchestrator SIGKILLs.
 */
export const setupGracefulShutdown = (server: Server, cleanup: () => Promise<void>): void => {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return; // ignore repeat signals (e.g. double Ctrl-C) while draining
    shuttingDown = true;
    console.warn(`\n${signal} received — shutting down gracefully…`);

    const force = setTimeout(() => {
      console.error("Shutdown timed out — forcing exit");
      process.exit(1);
    }, FORCE_EXIT_MS);
    force.unref(); // don't let the watchdog itself keep the process alive

    server.close(async () => {
      try {
        await cleanup();
        console.warn("Closed HTTP server and DB connection — bye");
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};
