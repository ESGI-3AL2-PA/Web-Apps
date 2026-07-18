/**
 * The desktop app is a public client: it ships as a jar, so any secret baked into
 * it is readable by anyone holding the artifact. There is therefore no client
 * secret and no per-client redirect allowlist — PKCE authenticates the exchange,
 * and the loopback rule in ./loopback-redirect.ts is the redirect policy.
 *
 * A single hardcoded id is deliberate. A registry (Mongo collection, admin UI,
 * rotation) is the right shape at two or more clients; at one it is indirection
 * with no payoff.
 */
export const DESKTOP_CLIENT_ID = "admin-desktop";

/**
 * Who may obtain a desktop token. Enforced server-side at /authorize so a
 * non-admin never receives a code — the client cannot forget to check, and
 * cannot be patched to skip it.
 */
export const ADMIN_SSO_ROLES: ReadonlySet<string> = new Set(["admin", "superAdmin"]);
