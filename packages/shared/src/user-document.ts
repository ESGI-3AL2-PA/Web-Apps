// Schéma zod partagé (couche « entity / persistance »). Source unique de vérité
// du document utilisateur, dérivé par les deux backends.
import { z } from "zod";
import { syncProvenanceSchema } from "./sync-provenance.js";

// Rôles applicatifs : utilisateur simple, administrateur (de quartier), superAdmin.
export const UserRoleSchema = z.enum(["user", "admin", "superAdmin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Schéma canonique d'un document de la collection partagée `users` — source unique
 * de vérité dont les deux backends dérivent (api via `entities/user.entity.ts`,
 * auth-service via `UserRecord`). Auparavant chaque app déclarait à la main sa
 * propre vue de ce document et elles avaient divergé (auth avait ajouté
 * `totpSecret`/`lang`/`lastTotpStep` ; api omettait `lastTotpStep`). Tout nouveau
 * champ se déclare ici, une seule fois.
 */
export const userDocumentSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  address: z.string(),
  role: UserRoleSchema,
  districtId: z.string(),
  balance: z.number().int().default(0),
  banned: z.boolean().default(false),
  emailVerified: z.boolean().default(false),
  totpSecret: z.string().nullable().default(null),
  totpEnabled: z.boolean().default(false),
  // Langue préférée pour les emails transactionnels ; l'absence est traitée comme "fr".
  lang: z.enum(["fr", "en"]).optional(),
  // Time-step TOTP le plus élevé déjà consommé ; sert à rejeter le rejeu d'un code dans sa fenêtre.
  lastTotpStep: z.number().optional(),
  // Provenance interne de synchro offline ; retirée par `toEntity` avant que le doc ne quitte le repo.
  _sync: syncProvenanceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserDocument = z.infer<typeof userDocumentSchema>;
