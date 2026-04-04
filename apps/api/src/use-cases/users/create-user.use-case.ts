import type { UserRepository } from "../../repositories/user.repository.js";
import type { User } from "../../entities/user.entity.js";

export const createUserUseCase = (userRepository: UserRepository) => {
  return async (
    data: Omit<User, "id" | "createdAt" | "updatedAt"> & {
      password: string;
    },
  ): Promise<User> => {
    return await userRepository.createUser(data);
  };
};
