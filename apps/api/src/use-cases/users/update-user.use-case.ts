import type { UserRepository } from "../../repositories/user.repository";
import type { User } from "../../entities/user.entity";

export const updateUserUseCase = (userRepository: UserRepository) => {
  return async (
    id: string,
    data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>,
  ): Promise<User | null> => {
    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    return await userRepository.updateUser(id, updatedData);
  };
};
