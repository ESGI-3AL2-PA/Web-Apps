import { z } from "zod";

export const RefreshTokenSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tokenHash: z.string(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  // Session identity, captured at login and carried across rotations so a
  // session stays recognizable in the "active sessions" view. Nullable for
  // rows created before these fields existed.
  userAgent: z.string().nullable().default(null),
  ip: z.string().nullable().default(null),
  lastUsedAt: z.string().datetime().nullable().default(null),
});

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
