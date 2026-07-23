// Helpers d'inspection de l'expiration d'un access token JWT, côté client.
// Décodage purement local du payload (aucune vérification de signature) : sert uniquement
// à décider quand déclencher un refresh préventif, pas à établir une confiance.

/**
 * Extrait le claim `exp` (secondes depuis l'epoch) d'un JWT.
 * Retourne null si le token est malformé ou n'a pas de claim `exp`.
 *
 * Décode la 2e section (payload) encodée en base64url : on reconvertit l'alphabet
 * base64url vers base64 standard (- → +, _ → /) avant `atob`. Toute anomalie
 * (nombre de sections ≠ 3, base64 invalide, JSON invalide) tombe dans le catch → null.
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
 * Indique si le token expire dans moins de `thresholdSeconds` à partir de maintenant.
 *
 * Fail-safe : un token illisible ou sans `exp` est traité comme « expirant bientôt »
 * (retourne true), ce qui pousse l'appelant à rafraîchir plutôt qu'à faire confiance à un
 * token douteux. `Date.now()` est en millisecondes, d'où la division par 1000 pour
 * comparer des secondes.
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds = 60): boolean {
  const exp = getJwtExpiry(token);
  if (exp === null) return true;
  return exp - Date.now() / 1000 < thresholdSeconds;
}
