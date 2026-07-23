import type { AuthorizationCode } from "../../entities/authorization-code.entity.js";

/**
 * Repository des codes d'autorisation OAuth (flux authorization code + PKCE de l'app
 * desktop). Codes hachés, à usage unique et à durée de vie courte (60 s), échangés contre
 * des tokens sur /auth/desktop/token.
 */
export interface IAuthorizationCodeRepository {
  create(data: Omit<AuthorizationCode, "id">): Promise<AuthorizationCode>;
  /**
   * Réclame atomiquement un code non consommé et retourne sa pré-image. Null s'il était
   * déjà utilisé ou absent. Un couple find-puis-update laisserait deux échanges concurrents
   * passer le test et émettre des tokens ; le compare-and-swap garantit l'usage unique même
   * en cas de concurrence, pas seulement dans le cas nominal.
   */
  claimByCodeHash(codeHash: string): Promise<AuthorizationCode | null>;
  // Crée les index Mongo (TTL d'expiration + unicité du codeHash). Idempotent.
  ensureIndexes(): Promise<void>;
}
