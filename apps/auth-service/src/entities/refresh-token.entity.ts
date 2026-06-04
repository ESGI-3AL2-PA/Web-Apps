import { z } from "zod";

export const RefreshTokenSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tokenHash: z.string(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
