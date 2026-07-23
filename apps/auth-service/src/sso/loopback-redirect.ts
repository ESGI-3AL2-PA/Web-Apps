/**
 * Politique de redirect_uri pour le flux authorization-code de l'app desktop (RFC 8252).
 *
 * C'est la frontière anti-open-redirect : tout ce qui passe ici est une URL vers laquelle
 * l'endpoint authorize enverra le navigateur, porteuse d'un code d'autorisation. C'est
 * une liste blanche de formes, pas une liste noire.
 *
 * Le port est volontairement non contraint. Une app native ne peut pas réserver un port
 * fixe (il peut être déjà pris), donc RFC 8252 §7.3 impose d'accepter n'importe quel port
 * sur l'interface loopback — CallbackServer bind sur 127.0.0.1:0 et prend ce que l'OS lui
 * donne. Une allowlist d'URIs à correspondance exacte, la réponse OAuth habituelle, est
 * ici impossible.
 *
 * Risque résiduel, inhérent au motif : n'importe quel processus local peut binder un port
 * loopback, donc une app hostile sur la même machine peut s'enregistrer comme callback et
 * courir pour intercepter le code. C'est PKCE qui rend un code intercepté inutile — d'où
 * le caractère obligatoire (et non optionnel) du challenge dans ce flux.
 */

/** L'unique chemin servi par le serveur de callback desktop (CallbackServer.java). */
export const CALLBACK_PATH = "/callback";

/**
 * `URL.hostname` renvoie les littéraux IPv6 *avec* crochets ; le loopback v6 doit donc
 * être comparé à "[::1]" — une comparaison à "::1" nu échouerait silencieusement à matcher.
 *
 * `localhost` est délibérément absent. RFC 8252 §8.3 préfère les IP littérales car
 * `localhost` passe par la résolution de nom et peut être redirigé par altération du
 * fichier hosts ou du DNS sur une machine compromise. Le client Java émet déjà 127.0.0.1,
 * donc refuser `localhost` ne lui coûte rien.
 */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "[::1]"]);

/** Borne le travail effectué sur une chaîne fournie par l'attaquant avant de la parser. */
const MAX_LENGTH = 512;

/**
 * Renvoie true ssi `raw` est un callback loopback autorisé pour le SSO desktop.
 * Applique en cascade : longueur bornée, parsing URL, http uniquement, hôte loopback,
 * chemin /callback exact, ni query/fragment/userinfo.
 */
export const isAllowedLoopbackRedirect = (raw: string): boolean => {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // http en clair uniquement : le loopback est exempt de TLS, et on n'émet jamais de
  // callback https.
  if (url.protocol !== "http:") return false;

  // Sur l'URL parsée, pas la brute — le parseur normalise les écritures octales/décimales
  // des IP (0177.0.0.1 -> 127.0.0.1), donc les formes obfusquées ne peuvent pas faire
  // passer un hôte différent ici.
  if (!LOOPBACK_HOSTS.has(url.hostname)) return false;

  // Chemin fixe, correspondance exacte — pas de préfixe, pas de traversée.
  if (url.pathname !== CALLBACK_PATH) return false;

  // Ni query/fragment pré-remplis (ils entreraient en collision avec le code/state qu'on
  // ajoute), ni userinfo (le piège de confusion « http://evil.com@127.0.0.1/ »).
  if (url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") return false;

  // N'importe quel port, y compris aucun (:80 implicite). URL rejette les ports hors
  // plage au parsing, donc arriver ici signifie port absent ou valide 1-65535.
  return true;
};
