import type { AuthorizationCode } from "../../entities/authorization-code.entity.js";

export interface IAuthorizationCodeRepository {
  create(data: Omit<AuthorizationCode, "id">): Promise<AuthorizationCode>;
  /**
   * Atomically claims an unused code, returning its pre-image. Null if it was
   * already used or absent. A find-then-update pair would let two concurrent
   * exchanges both pass the check and mint tokens; the compare-and-swap makes
   * single-use hold under concurrency rather than only in the happy path.
   */
  claimByCodeHash(codeHash: string): Promise<AuthorizationCode | null>;
  ensureIndexes(): Promise<void>;
}
