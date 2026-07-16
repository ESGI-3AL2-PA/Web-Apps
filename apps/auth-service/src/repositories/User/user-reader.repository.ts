import type { UserDocument } from "@repo/shared";

// The `users` collection is shared with the api; its shape is the single source of
// truth in @repo/shared. auth-service reads the same document (incl. totpSecret /
// lastTotpStep the api doesn't touch), so UserRecord IS the shared document type.
export type UserRecord = UserDocument;

export interface IUserReaderRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  setEmailVerified(userId: string): Promise<void>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  setTotpSecret(userId: string, secret: string | null, enabled: boolean): Promise<void>;
  /**
   * Atomically claim a TOTP time-step. Returns true only if the user had not already consumed a
   * step >= the given one, making a TOTP code single-use even under concurrent requests.
   */
  consumeTotpStep(userId: string, step: number): Promise<boolean>;
}
