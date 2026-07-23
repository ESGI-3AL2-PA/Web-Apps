import type { IUserRepository } from "../../repositories/User/user.repository.js";

/**
 * Cas d'usage (domaine users) : récupère un utilisateur par son id.
 * Simple pass-through vers le repository ; renvoie `null` si aucun utilisateur ne correspond.
 */
export const getUserByIdUseCase = (userRepository: IUserRepository) => {
  return async (params: { id: string }) => {
    return await userRepository.getUserById(params.id);
  };
};
