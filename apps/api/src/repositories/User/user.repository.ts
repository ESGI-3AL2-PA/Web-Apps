import type { User } from "../../entities/user.entity.js";

/**
 * Contrat du repository des utilisateurs (couche repository).
 *
 * Interface commune aux implémentations Mongo, in-memory et SATAN : liste
 * paginée avec recherche, lookups par id / email, requête par quartier, CRUD et
 * bascule de bannissement.
 */
export interface IUserRepository {
  ensureIndexes(): Promise<void>;

  // Liste paginée, filtrable par recherche texte, quartier et rôle.
  getUsers(params: { search?: string; districtId?: string; role?: string; page?: number; limit?: number }): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }>;

  getUserById(id: string): Promise<User | null>;

  getUserByEmail(email: string): Promise<User | null>;

  // Tous les membres d'un quartier (sans pagination) — sert à redistribuer les points d'un membre qui part.
  findUsersByDistrict(districtId: string): Promise<User[]>;

  createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;

  updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null>;

  // Active/désactive le bannissement d'un compte ; renvoie l'utilisateur mis à jour, ou null s'il est absent.
  setBanned(id: string, banned: boolean): Promise<User | null>;

  deleteUser(id: string): Promise<boolean>;
}
