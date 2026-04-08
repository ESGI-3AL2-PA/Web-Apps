import type { IUserRepository } from "../../repositories/User/user.repository.js";

export const getUserByIdUseCase = (userRepository: IUserRepository) => {
  return async (params: { id: string }) => {
    return await userRepository.getUserById(params.id);
  };
};
