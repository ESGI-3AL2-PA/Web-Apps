import type { UserRepository } from "../../repositories/user.repository.js";

export const getUsersUseCase = (userRepository: UserRepository) => {
  return async (params: { search?: string; page?: number; limit?: number }) => {
    return await userRepository.getUsers(params);
  };
};
