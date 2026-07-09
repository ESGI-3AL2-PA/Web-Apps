// Kept as a thin re-export for backward compatibility — the canonical
// implementation lives in ./jwtExpiry. Prefer importing from "@repo/hooks"
// directly, which re-exports the public surface.
export { getJwtExpiry, isTokenExpiringSoon } from "./jwtExpiry";
