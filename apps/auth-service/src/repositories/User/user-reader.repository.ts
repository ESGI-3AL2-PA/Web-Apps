import type { UserDocument } from "@repo/shared";

// La collection `users` est partagée avec l'api ; sa forme est la source de vérité unique
// dans @repo/shared. L'auth-service lit le même document (y compris totpSecret / lastTotpStep
// auxquels l'api ne touche pas), donc UserRecord EST le type de document partagé.
export type UserRecord = UserDocument;

/**
 * Repository de lecture/écriture des utilisateurs côté auth-service. Sert le login (lookup
 * par email), la vérification d'email, la mise à jour du hash de mot de passe et la gestion
 * du secret TOTP (2FA). Les écritures se limitent aux champs liés à l'authentification.
 */
export interface IUserReaderRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  // Marque l'email comme vérifié (après consommation du token de vérification).
  setEmailVerified(userId: string): Promise<void>;
  // Remplace le hash argon2 du mot de passe (reset / changement).
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  // Pose ou efface le secret TOTP et l'état activé (secret null = 2FA désactivée).
  setTotpSecret(userId: string, secret: string | null, enabled: boolean): Promise<void>;
  /**
   * Réclame atomiquement un pas de temps TOTP. Retourne true seulement si l'utilisateur
   * n'avait pas déjà consommé un pas >= à celui fourni, rendant un code TOTP à usage unique
   * même sous requêtes concurrentes (protection contre le rejeu).
   */
  consumeTotpStep(userId: string, step: number): Promise<boolean>;
}
