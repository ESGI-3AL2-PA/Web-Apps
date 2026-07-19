/**
 * District scoping for the sync surface (§5.5 / Decision D1).
 *
 * Built on the same `resolveCallerListDistrict` the incident / listing / vote list
 * routes use, so the sync feed can never be broader than the interactive routes it
 * shadows. Collapsed to a three-way result the use-cases can branch on without
 * knowing about roles.
 */
import type { AuthUser } from "../middleware/auth.middleware.js";
import type { IUserRepository } from "../repositories/User/user.repository.js";
import { resolveCallerListDistrict } from "../middleware/district-scope.js";

export type SyncScope = { all: true } | { districtId: string } | { empty: true };

export const resolveSyncScope = async (user: AuthUser, userRepo: IUserRepository): Promise<SyncScope> => {
  // `requested: undefined` — the caller never picks its own scope on a sync route.
  const scope = await resolveCallerListDistrict(user, undefined, userRepo);
  if ("empty" in scope) return { empty: true };
  // Only superAdmin / service fall through unbound; admins always carry a districtId.
  return scope.districtId ? { districtId: scope.districtId } : { all: true };
};

/**
 * Fail-closed write check: an unknown district (`null`) is only writable by an
 * unscoped caller, never by a district admin.
 */
export const scopeAllowsDistrict = (scope: SyncScope, districtId: string | null): boolean => {
  if ("all" in scope) return true;
  if ("empty" in scope) return false;
  return districtId === scope.districtId;
};
