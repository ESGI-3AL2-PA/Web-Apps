import { z } from "../zod";
import { StrongPasswordSchema } from "./password.schema";
import { DistrictResponseDtoSchema } from "./district.dto";

export const UserRoleSchema = z.enum(["user", "admin", "superAdmin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LangSchema = z.enum(["fr", "en"]);
export type Lang = z.infer<typeof LangSchema>;

export const UserResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique user identifier" }),
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    firstName: z.string().openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().openapi({ description: "User's last name", example: "Doe" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    role: UserRoleSchema.openapi({ description: "Role in the system" }),
    address: z.string().optional().openapi({ description: "User's address" }),
    districtId: z.string().optional().openapi({ description: "ID of the district the user belongs to" }),
    adminDistrictId: z
      .string()
      .nullable()
      .optional()
      .openapi({ description: "District this user administers (admin role only). Populated on login/userinfo." }),
    balance: z.number().int().openapi({ description: "User balance in tokens" }),
    banned: z.boolean().optional().openapi({ description: "Whether the account is banned (blocked from logging in)" }),
    emailVerified: z.boolean().openapi({ description: "Whether the email has been verified" }),
    totpEnabled: z.boolean().openapi({ description: "Whether the user has TOTP MFA enabled" }),
    lang: LangSchema.optional().openapi({
      description: "Preferred language for transactional emails (defaults to fr)",
    }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    updatedAt: z.string().datetime().openapi({ description: "Last update timestamp" }),
  })
  .openapi({ title: "UserResponse" });
export type UserResponseDto = z.infer<typeof UserResponseDtoSchema>;

export const CreateUserDtoSchema = z
  .object({
    firstName: z.string().min(1).max(100).openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().min(1).max(100).openapi({ description: "User's last name", example: "Doe" }),
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    password: StrongPasswordSchema.openapi({
      description: "Min 12 chars with upper, lower, digit, and symbol",
    }),
    address: z.string().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
    lang: LangSchema.optional().openapi({
      description: "Preferred language for transactional emails (defaults to fr)",
    }),
  })
  .openapi({ title: "CreateUser" });
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;

export const UpdateUserDtoSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional().openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().min(1).max(100).optional().openapi({ description: "User's last name", example: "Doe" }),
    email: z
      .string()
      .email()
      .optional()
      .openapi({ description: "User's email address", example: "john.doe@example.com" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    currentPassword: z
      .string()
      .optional()
      .openapi({ description: "Current password — required only when changing newPassword" }),
    newPassword: StrongPasswordSchema.optional().openapi({
      description: "New password — min 12 chars with upper, lower, digit, and symbol",
    }),
    address: z.string().optional().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
    lang: LangSchema.optional().openapi({ description: "Preferred language for transactional emails" }),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: "currentPassword is required when setting newPassword",
    path: ["currentPassword"],
  })
  .openapi({ title: "UpdateUser" });
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

export const BanUserDtoSchema = z
  .object({
    banned: z.boolean().openapi({ description: "true to ban (block login), false to lift the ban" }),
  })
  .openapi({ title: "BanUser" });
export type BanUserDto = z.infer<typeof BanUserDtoSchema>;

// Optional chosen district — sent when the caller's address falls inside several
// overlapping districts and they pick which one to join.
export const ResolveDistrictRequestDtoSchema = z
  .object({
    districtId: z.string().optional().openapi({ description: "District to join when several contain the address" }),
  })
  .openapi({ title: "ResolveDistrictRequest" });
export type ResolveDistrictRequestDto = z.infer<typeof ResolveDistrictRequestDtoSchema>;

// Re-geocoding the caller's stored address and joining the containing district.
// - resolved:true  => joined (user populated)
// - resolved:false with candidates.length > 1 => address is in several districts; the
//   caller must re-call with a chosen districtId
// - resolved:false with candidates empty => no district covers the address yet
export const ResolveDistrictResponseDtoSchema = z
  .object({
    resolved: z.boolean().openapi({ description: "Whether a district was found and joined" }),
    user: UserResponseDtoSchema.optional().openapi({ description: "The updated user when resolved" }),
    candidates: z
      .array(DistrictResponseDtoSchema)
      .openapi({ description: "Districts containing the address when a choice is required" }),
  })
  .openapi({ title: "ResolveDistrictResponse" });
export type ResolveDistrictResponseDto = z.infer<typeof ResolveDistrictResponseDtoSchema>;

export const UserParamsDtoSchema = z
  .object({
    id: z.string(),
  })
  .openapi({ title: "UserParams" });
export type UserParamsDto = z.infer<typeof UserParamsDtoSchema>;

export const UserQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    districtId: z.string().optional().openapi({ description: "Filter users by their residence district" }),
    role: z.enum(["user", "admin", "superAdmin"]).optional().openapi({ description: "Filter users by role" }),
  })
  .openapi({ title: "UserQuery" });
export type UserQueryDto = z.infer<typeof UserQueryDtoSchema>;
