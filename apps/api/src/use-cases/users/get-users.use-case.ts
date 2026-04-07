import type { IUserRepository } from "../../repositories/user.repository.js";

export const getUsersUseCase = (userRepository: IUserRepository) => {
  return async (params: { search?: string; page?: number; limit?: number }) => {
    return await userRepository.getUsers(params);
  };
};
