import type { IUserRepository } from "../../repositories/user.repository.js";

export const deleteUserUseCase = (userRepository: IUserRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await userRepository.deleteUser(params.id);
  };
};
