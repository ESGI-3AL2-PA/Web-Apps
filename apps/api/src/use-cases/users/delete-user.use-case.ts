import type { UserRepository } from "../../repositories/user.repository.js";

export const deleteUserUseCase = (userRepository: UserRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await userRepository.deleteUser(params.id);
  };
};
