import { initServer } from "@ts-rest/express";
import { usersContract } from "@repo/contracts";
import type { UserResponseDto } from "@repo/contracts";
import type { User } from "../../entities/user.entity.js";
import { resolve } from "../../repositories/container.js";
import { getUsersUseCase } from "../../use-cases/users/get-users.use-case.js";
import { getUserByIdUseCase } from "../../use-cases/users/get-user-by-id.use-case.js";
import { createUserUseCase } from "../../use-cases/users/create-user.use-case.js";
import { updateUserUseCase } from "../../use-cases/users/update-user.use-case.js";
import { deleteUserUseCase } from "../../use-cases/users/delete-user.use-case.js";

const toDto = ({ passwordHash: _, ...rest }: User): UserResponseDto => rest;

const s = initServer();
const userRepository = resolve("user");

export const usersRouter = s.router(usersContract, {
  getUsers: async ({ query: { page, limit, search } }) => {
    const result = await getUsersUseCase(userRepository)({ search, page, limit });
    return { status: 200, body: { ...result, data: result.data.map(toDto) } };
  },

  getUserById: async ({ params: { id } }) => {
    const user = await getUserByIdUseCase(userRepository)({ id });
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: toDto(user) };
  },

  createUser: async ({ body }) => {
    const newUser = await createUserUseCase(userRepository)({ ...body });
    return { status: 201, body: toDto(newUser) };
  },

  updateUser: async ({ params: { id }, body }) => {
    const user = await updateUserUseCase(userRepository)(id, body);
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: toDto(user) };
  },

  deleteUser: async ({ params: { id } }) => {
    const deleted = await deleteUserUseCase(userRepository)({ id });
    if (!deleted) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 204, body: undefined };
  },
});
