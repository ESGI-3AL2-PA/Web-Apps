import { initServer } from "@ts-rest/express";
import { conflictsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getConflictByIdUseCase, getConflictsUseCase } from "../../use-cases/sync/get-conflicts.use-case.js";
import { resolveConflictUseCase } from "../../use-cases/sync/resolve-conflict.use-case.js";

const s = initServer();

// Dépendances communes à la résolution de conflit : writer (applique la version
// gagnante), registre des conflits, et projection graphe à re-synchroniser.
const resolveDeps = () => ({
  writer: resolve("syncWriter"),
  conflicts: resolve("syncConflicts"),
  graph: resolve("graph"),
});

/**
 * Router ts-rest des conflits de synchronisation offline.
 *
 * Couche router. Permet de lister/consulter les conflits détectés à l'ingestion
 * (deux instances ont modifié la même entité) et de les résoudre manuellement.
 */
export const conflictsRouter = s.router(conflictsContract, {
  getConflicts: async ({ query, headers, req }) => {
    // La vue globale est la porte de sortie superAdmin pour les conflits levés par
    // une instance jamais revenue en ligne (§6.5) ; tous les autres ne voient que
    // les leurs (`mine` scopé sur leur x-sync-instance).
    if (!query.mine && req.user!.role !== "superAdmin") {
      return { status: 403, body: { message: "Only a superAdmin may list other instances' conflicts" } };
    }
    const conflicts = await getConflictsUseCase(resolve("syncConflicts"))({
      status: query.status,
      entity: query.entity,
      originInstanceId: query.mine ? headers["x-sync-instance"] : undefined,
      limit: query.limit,
    });
    return { status: 200, body: conflicts };
  },

  getConflictById: async ({ params: { id } }) => {
    const conflict = await getConflictByIdUseCase(resolve("syncConflicts"))(id);
    if (!conflict) return { status: 404, body: { message: "Conflict not found" } };
    return { status: 200, body: conflict };
  },

  resolveConflict: async ({ params: { id }, body, req }) => {
    // req.user.sub est enregistré comme auteur de la résolution.
    const result = await resolveConflictUseCase(resolveDeps())(id, body, req.user!.sub);
    if (result.kind === "not-found") return { status: 404, body: { message: "Conflict not found" } };
    // Un conflit déjà tranché ne peut pas être re-résolu → 400.
    if (result.kind === "already-resolved") {
      return { status: 400, body: { message: "Conflict is already resolved" } };
    }
    return { status: 200, body: { id, status: "resolved", resolution: result.resolution } };
  },
});
