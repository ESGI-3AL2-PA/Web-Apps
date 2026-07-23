import { initServer } from "@ts-rest/express";
import { syncContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { resolveSyncScope } from "../../sync/sync-scope.js";
import { ingestUseCase } from "../../use-cases/sync/ingest.use-case.js";
import { getChangesUseCase } from "../../use-cases/sync/get-changes.use-case.js";

const s = initServer();

/**
 * Router ts-rest de la synchronisation offline.
 *
 * Couche router. Deux opérations symétriques entre une instance distante (identifiée
 * par l'en-tête `x-sync-instance`) et le serveur central :
 *  - `ingest` : l'instance pousse ses changements locaux ; le serveur les applique
 *    et renvoie les acks / conflits éventuels.
 *  - `getChanges` : l'instance récupère les changements survenus depuis un curseur.
 *
 * Le scope (quel sous-ensemble de données l'instance a le droit de synchroniser)
 * est résolu par `resolveSyncScope` à partir de l'appelant.
 */
export const syncRouter = s.router(syncContract, {
  ingest: async ({ body, headers, req }) => {
    const scope = await resolveSyncScope(req.user!, resolve("user"));
    const result = await ingestUseCase({
      writer: resolve("syncWriter"),
      conflicts: resolve("syncConflicts"),
      graph: resolve("graph"),
    })({ events: body, instanceId: headers["x-sync-instance"], scope });
    return { status: 200, body: result };
  },

  getChanges: async ({ query, headers, req }) => {
    const scope = await resolveSyncScope(req.user!, resolve("user"));
    const changes = await getChangesUseCase(resolve("syncChanges"))({
      since: query.since,
      limit: query.limit,
      // Echo-skip : une instance n'a jamais besoin de recevoir en retour ses propres
      // écritures — elle a déjà appris le nouvel updatedAt via l'ack de l'ingest (§7).
      excludeInstance: headers["x-sync-instance"],
      scope,
    });
    return { status: 200, body: changes };
  },
});
