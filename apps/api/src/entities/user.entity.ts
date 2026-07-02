import { z } from "zod";

export const UserRoleSchema = z.enum(["user", "admin", "superAdmin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
