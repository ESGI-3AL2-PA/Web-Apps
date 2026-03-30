import { initServer } from "@ts-rest/express";
import { usersContract } from "@repo/contracts";

import { InMemoryUserRepository } from "../../repositories/user.repository.in-memory";

import { getUsersUseCase } from "../../use-cases/users/get-users.use-case";
import { getUserByIdUseCase } from "../../use-cases/users/get-user-by-id.use-case";
import { createUserUseCase } from "../../use-cases/users/create-user.use-case";
import { updateUserUseCase } from "../../use-cases/users/update-user.use-case";
import { deleteUserUseCase } from "../../use-cases/users/delete-user.use-case";

const s = initServer();

const userRepository = new InMemoryUserRepository();

export const usersRouter = s.router(usersContract, {
  getUsers: async ({ query: { page, limit, search } }) => {
    const result = await getUsersUseCase(userRepository)({
      search,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getUserById: async ({ params: { id } }) => {
    const user = await getUserByIdUseCase(userRepository)({ id });
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: user };
  },

  createUser: async ({ body }) => {
    const newUser = await createUserUseCase(userRepository)({ ...body });
    return { status: 201, body: newUser };
  },

  updateUser: async ({ params: { id }, body }) => {
    const user = await updateUserUseCase(userRepository)(id, body);
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: user };
  },

  deleteUser: async ({ params: { id } }) => {
    const deleted = await deleteUserUseCase(userRepository)({ id });
    if (!deleted) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 204, body: undefined };
  },
});
