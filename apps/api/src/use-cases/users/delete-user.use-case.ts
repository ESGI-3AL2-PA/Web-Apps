import type { UserRepository } from "../../repositories/user.repository";

export const deleteUserUseCase = (userRepository: UserRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await userRepository.deleteUser(params.id);
  };
};
