/**
 * Extracts the `exp` claim (seconds since epoch) from a JWT.
 * Returns null if the token is malformed or has no exp.
 */
export function getJwtExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token expires within `thresholdSeconds` from now.
 */
export function isTokenExpiringSoon(
  token: string,
  thresholdSeconds = 60,
): boolean {
  const exp = getJwtExpiry(token);
  if (exp === null) return true;
  return exp - Date.now() / 1000 < thresholdSeconds;
}
