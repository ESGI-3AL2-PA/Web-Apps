import type { IUserRepository } from "../../repositories/user.repository.js";
import type { User } from "../../entities/user.entity.js";

export const createUserUseCase = (userRepository: IUserRepository) => {
  return async (
    data: Omit<User, "id" | "createdAt" | "updatedAt" | "passwordHash" | "balance"> & {
      password: string;
    },
  ): Promise<User> => {
    const { password, ...rest } = data;
    return await userRepository.createUser({ ...rest, passwordHash: password, balance: 0 });
  };
};
