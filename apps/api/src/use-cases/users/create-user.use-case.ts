import type { UserRepository } from "../../repositories/user.repository";
import type { User } from "../../entities/user.entity";
import { randomUUID } from "crypto";

export const createUserUseCase = (userRepository: UserRepository) => {
  return async (
    data: Omit<User, "id" | "createdAt" | "updatedAt"> & {
      password: string;
    },
  ): Promise<User> => {
    const userData = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await userRepository.createUser(userData);
  };
};
