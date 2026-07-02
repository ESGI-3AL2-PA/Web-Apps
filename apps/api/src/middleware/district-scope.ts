// District scoping for list endpoints.
//
// The per-record authorize middleware only guards single-record routes (it no-ops when there
// is no `:id`), so collection/list endpoints are otherwise unscoped. This resolves the district
// a list request may read: a regular `admin` is confined to their own `adminDistrictId` (the
// client-supplied value is ignored); `superAdmin` / `service` may target any district they ask for.
//
// Returns either the districtId to filter by, or `{ empty: true }` — a signal that the caller
// (a misconfigured admin with no bound district) must see nothing rather than everything.

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
