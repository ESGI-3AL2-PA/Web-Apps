import { z } from "zod";

export const UserRoleSchema = z.enum(["user", "admin", "superAdmin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    passwordHash: z.string(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().optional(),
    address: z.string(),
    role: UserRoleSchema,
    // superAdmin belongs to no district — it is the only role allowed (and required) to have a null
    // districtId. Every other role is district-scoped (a "" value means "not yet resolved").
    districtId: z.string().nullable(),
    balance: z.number().int().default(0),
    banned: z.boolean().default(false),
    emailVerified: z.boolean().default(false),
    totpSecret: z.string().nullable().default(null),
    totpEnabled: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine((u) => (u.role === "superAdmin") === (u.districtId === null), {
    message: "districtId must be null for superAdmin and non-null for every other role",
    path: ["districtId"],
  });

export type User = z.infer<typeof UserSchema>;
