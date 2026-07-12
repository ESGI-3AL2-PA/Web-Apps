import { createSatanClient, type SatanClient } from "@repo/satan";

let client: SatanClient | null = null;

/**
 * Spawns the persistent SATAN QL worker and verifies it before the app serves
 * traffic — mirrors `neo4j.connector.ts`. The verify is a translation-only
 * query (no Mongo touch) that proves the Python worker + `ply` are alive; a
 * timeout turns a missing interpreter/`ply` into a clear boot error instead of
 * a hang on the first real request.
 */
export const connectSatan = async (): Promise<SatanClient> => {
  if (client) return client;

  const pythonBin = process.env.SATAN_PYTHON ?? "python3";
  const c = createSatanClient({ pythonBin });

  const stderr: string[] = [];
  c.on("stderr", (line: string) => {
    stderr.push(line);
    if (process.env.SATAN_DEBUG) console.error(`[satan] ${line}`);
  });

  const verify = c.query("FIND _healthcheck");
  verify.catch(() => {}); // swallow a late rejection if the timeout wins the race

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `SATAN worker did not respond within 5s. Is 'ply' installed for '${pythonBin}'? ` +
              `Set SATAN_PYTHON to a python with ply.` +
              (stderr.length ? ` Worker stderr: ${stderr.join("").slice(0, 500)}` : ""),
          ),
        ),
      5000,
    );
  });

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
