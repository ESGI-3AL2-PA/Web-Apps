import { z } from "../zod";

export const UserRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

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
    balance: z.number().int().openapi({ description: "User balance in tokens" }),
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
    password: z.string().min(8).openapi({ description: "User's password" }),
    address: z.string().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
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
    password: z.string().min(8).optional().openapi({ description: "User's password" }),
    newPassword: z.string().min(8).optional().openapi({ description: "User's new password" }),
    address: z.string().optional().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
  })
  .openapi({ title: "UpdateUser" });
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

export const UserParamsDtoSchema = z
  .object({
    id: z.string(),
  })
  .openapi({ title: "UserParams" });
export type UserParamsDto = z.infer<typeof UserParamsDtoSchema>;

export const UserQueryDtoSchema = z
  .object({
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional(),
  })
  .openapi({ title: "UserQuery" });
export type UserQueryDto = z.infer<typeof UserQueryDtoSchema>;
