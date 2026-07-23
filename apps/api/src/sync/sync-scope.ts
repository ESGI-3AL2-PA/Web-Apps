/**
 * Couche sync : scoping par quartier de la surface de sync (§5.5 / Décision D1).
 *
 * Construit sur le même `resolveCallerListDistrict` qu'utilisent les routes de liste
 * incident / annonce / vote, de sorte que le flux de sync ne puisse jamais être plus
 * large que les routes interactives qu'il reflète. Réduit à un résultat à trois cas sur
 * lequel les use-cases peuvent brancher sans connaître les rôles.
 */
import type { AuthUser } from "../middleware/auth.middleware.js";
import type { IUserRepository } from "../repositories/User/user.repository.js";
import { resolveCallerListDistrict } from "../middleware/district-scope.js";

/** Scope de sync : tout (`all`), un quartier précis (`districtId`), ou aucun accès (`empty`). */
export type SyncScope = { all: true } | { districtId: string } | { empty: true };

/** Résout le scope de sync d'un appelant à partir de son rôle et de son quartier. */
export const resolveSyncScope = async (user: AuthUser, userRepo: IUserRepository): Promise<SyncScope> => {
  // `requested: undefined` — l'appelant ne choisit jamais son propre scope sur une route de sync.
  const scope = await resolveCallerListDistrict(user, undefined, userRepo);
  if ("empty" in scope) return { empty: true };
  // Seuls superAdmin / service passent sans contrainte ; les admins portent toujours un districtId.
  return scope.districtId ? { districtId: scope.districtId } : { all: true };
};

/**
 * Contrôle d'écriture fail-closed : un quartier inconnu (`null`) n'est modifiable que par
 * un appelant non contraint (unscoped), jamais par un administrateur de quartier.
 */
export const scopeAllowsDistrict = (scope: SyncScope, districtId: string | null): boolean => {
  if ("all" in scope) return true;
  if ("empty" in scope) return false;
  return districtId === scope.districtId;
};
