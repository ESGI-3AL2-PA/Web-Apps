import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["active", "inactive", "banned"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserResponseDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  districtId: z.string().optional(),
  balance: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponseDto = z.infer<typeof UserResponseDtoSchema>;

export const CreateUserDtoSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: UserRoleSchema.optional().default("user"),
  status: UserStatusSchema.optional().default("active"),
  districtId: z.string().optional(),
});
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;

export const UpdateUserDtoSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  districtId: z.string().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

export const UserParamsDtoSchema = z.object({
  id: z.string(),
});
export type UserParamsDto = z.infer<typeof UserParamsDtoSchema>;

export const UserQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
});
export type UserQueryDto = z.infer<typeof UserQueryDtoSchema>;
