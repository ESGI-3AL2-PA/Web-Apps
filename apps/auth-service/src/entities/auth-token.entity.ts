/**
 * Entité : token d'action à usage unique envoyé par email.
 *
 * Sert aux flux hors session — vérification d'adresse et réinitialisation de mot de
 * passe. Le token en clair part dans le lien email ; en base on ne stocke que son
 * hash (`tokenHash`), consommé une seule fois (`usedAt`).
 */

/** Nature du token : confirmation d'email ou réinitialisation de mot de passe. */
export type AuthTokenType = "verify_email" | "reset_password";

export interface AuthToken {
  id: string;
  userId: string;
  /** Hash du token ; le secret en clair ne vit que dans le lien email, jamais en base. */
  tokenHash: string;
  type: AuthTokenType;
  expiresAt: string;
  /** Horodatage de consommation ; `null` tant que le token n'a pas été utilisé (usage unique). */
  usedAt: string | null;
  createdAt: string;
}
