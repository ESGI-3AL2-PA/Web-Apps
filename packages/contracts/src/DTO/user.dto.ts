import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserResponseDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponseDto = z.infer<typeof UserResponseDtoSchema>;

export const CreateUserDtoSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: UserRoleSchema.optional().default("user"),
});
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;

export const UpdateUserDtoSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: UserRoleSchema.optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

export const UserParamsDtoSchema = z.object({
  id: z.string().uuid(),
});
export type UserParamsDto = z.infer<typeof UserParamsDtoSchema>;

export const UserQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
});
export type UserQueryDto = z.infer<typeof UserQueryDtoSchema>;
