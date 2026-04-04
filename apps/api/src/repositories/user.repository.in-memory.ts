import { randomUUID } from "crypto";
import type { User } from "../entities/user.entity.js";
import type { IUserRepository } from "./user.repository.js";

// This is a stub repository, IT DOES NOTHING !

export class InMemoryUserRepository implements IUserRepository {
  async getUsers(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10 } = params;
    const total = 0;
    const data: User[] = [];
    return { data, total, page, limit };
  }

  async getUserById(id: string): Promise<User | null> {
    return null;
  }

  async createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      ...data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    return user;
  }

  async updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null> {
    return null;
  }

  async deleteUser(id: string): Promise<boolean> {
    return true;
  }
}
