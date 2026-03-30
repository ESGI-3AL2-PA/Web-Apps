import type { UserRepository } from "../../repositories/user.repository";
import type { User } from "../../entities/user.entity";

export const createUserUseCase = (userRepository: UserRepository) => {
  return async (
    data: Omit<User, "id" | "createdAt" | "updatedAt"> & {
      password: string;
    },
  ): Promise<User> => {
    return await userRepository.createUser(data);
  };
};
