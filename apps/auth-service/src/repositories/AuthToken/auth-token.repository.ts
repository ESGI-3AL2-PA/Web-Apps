import type { AuthToken, AuthTokenType } from "../../entities/auth-token.entity.js";

/**
 * Repository des tokens à usage unique (vérification d'email, réinitialisation de mot de
 * passe...). Chaque token est stocké haché ; `type` distingue les usages. Un token est
 * « actif » tant qu'il n'a pas été consommé (usedAt null).
 */
export interface IAuthTokenRepository {
  create(data: Omit<AuthToken, "id">): Promise<AuthToken>;
  // Retourne le token actif (non consommé) correspondant au hash et au type, ou null.
  findActiveByHash(tokenHash: string, type: AuthTokenType): Promise<AuthToken | null>;
  // Marque le token comme consommé (usedAt = maintenant) — le rend inutilisable.
  markUsed(id: string): Promise<void>;
  // Révoque tous les tokens actifs d'un utilisateur pour un type donné (ex. après un reset).
  revokeAllForUser(userId: string, type: AuthTokenType): Promise<void>;
}
