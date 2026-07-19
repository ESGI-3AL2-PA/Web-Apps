import { z } from "zod";
import { syncProvenanceSchema } from "./sync-provenance.js";

export const UserRoleSchema = z.enum(["user", "admin", "superAdmin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Canonical schema for a document in the shared `users` collection — the single
 * source of truth both backends derive from (api via `entities/user.entity.ts`,
 * auth-service via `UserRecord`). Previously each app hand-declared its own view of
 * this document and they drifted (auth added `totpSecret`/`lang`/`lastTotpStep`; api
 * omitted `lastTotpStep`). Any new field goes here once.
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
  // Preferred language for transactional emails; missing is treated as "fr".
  lang: z.enum(["fr", "en"]).optional(),
  // Highest TOTP time-step already consumed; used to reject replay of a code within its window.
  lastTotpStep: z.number().optional(),
  // Internal offline-sync provenance; stripped by `toEntity` before the doc leaves the repo.
  _sync: syncProvenanceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserDocument = z.infer<typeof userDocumentSchema>;
