// District scoping for list endpoints.
//
// The per-record authorize middleware only guards single-record routes (it no-ops when there
// is no `:id`), so collection/list endpoints are otherwise unscoped. This resolves the district
// a list request may read: a resident (`user`) and a regular `admin` are both confined to their
// own district and the client-supplied value is ignored; `superAdmin` / `service` may target any
// district they ask for.
//
// Returns either the districtId to filter by, or `{ empty: true }` — a signal that the caller
// (a resident or admin bound to no district) must see nothing rather than everything.

import type { IUserRepository } from "../repositories/User/user.repository.js";

interface DistrictScopeUser {
  role: string;
  adminDistrictId?: string | null;
}

export type DistrictScopeResult = { districtId?: string } | { empty: true };

export function resolveListDistrictScope(user: DistrictScopeUser, requested?: string): DistrictScopeResult {
  if (user.role === "admin") {
    if (!user.adminDistrictId) return { empty: true }; // admin bound to no district → sees nothing
    return { districtId: user.adminDistrictId }; // ignore the client-supplied value
  }
  return { districtId: requested }; // superAdmin / service: honor the request as-is
}

// Same, but also handles role `user`. A resident's district of residence is not in the JWT (only
// `adminDistrictId` is), so it has to be loaded — hence the async variant. Prefer this over
// `resolveListDistrictScope` on any route residents can reach: the sync version falls through to
// "honor the request as-is" for them, which lets a resident enumerate other districts.
export async function resolveCallerListDistrict(
  user: DistrictScopeUser & { sub: string },
  requested: string | undefined,
  userRepo: IUserRepository,
): Promise<DistrictScopeResult> {
  if (user.role === "user") {
    const resident = await userRepo.getUserById(user.sub);
    if (!resident?.districtId) return { empty: true };
    return { districtId: resident.districtId }; // ignore the client-supplied value
  }
  return resolveListDistrictScope(user, requested);
}

// Single-record counterpart, for district-public resources (listings, events, votes) where the
// declarative `scope` metadata does not fit: an ownerField there would wrongly narrow a resident
// to their OWN records. Callers should answer a denial with 404, not 403, so the existence of a
// neighbouring district's record is not disclosed.
//
// `recordDistrictIds` takes an array so votes (which span several districts) share this path.
export async function callerCanReadDistrict(
  user: DistrictScopeUser & { sub: string },
  recordDistrictIds: string[],
  userRepo: IUserRepository,
): Promise<boolean> {
  if (user.role === "superAdmin" || user.role === "service") return true;
  if (user.role === "admin") {
    return !!user.adminDistrictId && recordDistrictIds.includes(user.adminDistrictId);
  }
  const resident = await userRepo.getUserById(user.sub);
  return !!resident?.districtId && recordDistrictIds.includes(resident.districtId);
}
