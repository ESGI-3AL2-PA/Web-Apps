import type { UserRepository } from "../../repositories/user.repository.js";
import type { User } from "../../entities/user.entity.js";

export const updateUserUseCase = (userRepository: UserRepository) => {
  return async (
    id: string,
    data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>,
  ): Promise<User | null> => {
    return await userRepository.updateUser(id, data);
  };
};
