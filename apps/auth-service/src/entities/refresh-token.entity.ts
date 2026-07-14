import { z } from "zod";

export const RefreshTokenSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tokenHash: z.string(),
  expiresAt: z.string().datetime(),
  // Same instant as `expiresAt`, stored as a BSON Date purely to drive the Mongo TTL
  // index (the TTL monitor ignores string dates). Optional/nullable so rows created
  // before this field existed still validate; all app logic keeps using `expiresAt`.
  expiresAtDate: z.date().nullish(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  // Stable family id for a login session. Minted at login, carried across every
  // rotation, so all rotated tokens of one device share it. Reuse detection and
  // the "active sessions" view revoke/identify by family, not by the whole user.
  // Nullable for rows created before this field existed.
  sessionId: z.string().nullable().default(null),
  // Session identity, captured at login and carried across rotations so a
  // session stays recognizable in the "active sessions" view. Nullable for
  // rows created before these fields existed.
  userAgent: z.string().nullable().default(null),
  ip: z.string().nullable().default(null),
  lastUsedAt: z.string().datetime().nullable().default(null),
});

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
