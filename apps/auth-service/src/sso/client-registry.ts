// Registre des clients SSO (couche sso) : constantes d'identité et d'autorisation
// pour le flux authorization-code + PKCE du client desktop JavaFX.

/**
 * L'application desktop est un client public : elle est distribuée sous forme de
 * jar, donc tout secret qui y serait incorporé est lisible par quiconque détient
 * l'artefact. Il n'y a donc ni client secret ni allowlist de redirect par client —
 * PKCE authentifie l'échange, et la règle loopback de ./loopback-redirect.ts
 * constitue la politique de redirection.
 *
 * Un unique id en dur est un choix délibéré. Un registre (collection Mongo, UI
 * d'admin, rotation) serait la bonne forme à partir de deux clients ; pour un seul,
 * ce ne serait qu'une indirection sans bénéfice.
 */
export const DESKTOP_CLIENT_ID = "admin-desktop";

/**
 * Rôles autorisés à obtenir un token desktop. Contrôle imposé côté serveur au
 * niveau de /authorize, si bien qu'un non-admin ne reçoit jamais de code — le
 * client ne peut pas oublier de vérifier, ni être patché pour contourner le test.
 */
export const ADMIN_SSO_ROLES: ReadonlySet<string> = new Set(["admin", "superAdmin"]);
