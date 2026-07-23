import type { IUserRepository } from "../../repositories/User/user.repository.js";

/**
 * Cas d'usage (domaine users) : liste paginée d'utilisateurs, avec filtres optionnels par
 * recherche texte, quartier et rôle. Simple pass-through vers le repository.
 */
export const getUsersUseCase = (userRepository: IUserRepository) => {
  return async (params: { search?: string; districtId?: string; role?: string; page?: number; limit?: number }) => {
    return await userRepository.getUsers(params);
  };
};
