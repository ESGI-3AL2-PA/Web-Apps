import type { UserRepository } from "../../repositories/user.repository.js";

export const getUserByIdUseCase = (userRepository: UserRepository) => {
  return async (params: { id: string }) => {
    return await userRepository.getUserById(params.id);
  };
};
