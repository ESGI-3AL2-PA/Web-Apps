import { z } from "../zod";

/**
 * Schéma zod du mot de passe fort, réutilisé à l'inscription et au changement de mot de passe.
 *
 * Exige au moins 12 caractères dont une minuscule, une majuscule, un chiffre et un symbole.
 * La connexion applique volontairement un `min(8)` plus permissif afin que les comptes
 * existants (créés avant cette règle) puissent toujours s'authentifier.
 */
export const StrongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine((v) => /[a-z]/.test(v), "Password must contain a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Password must contain an uppercase letter")
  .refine((v) => /\d/.test(v), "Password must contain a digit")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Password must contain a symbol");
