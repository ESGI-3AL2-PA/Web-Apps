import type { User } from "../../entities/user.entity.js";

export interface IUserRepository {
  getUsers(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }>;

  getUserById(id: string): Promise<User | null>;

  getUserByEmail(email: string): Promise<User | null>;

  createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;

  updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null>;

  deleteUser(id: string): Promise<boolean>;
}
