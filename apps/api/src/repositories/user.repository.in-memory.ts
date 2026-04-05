import { randomUUID } from "crypto";
import type { User } from "../entities/user.entity.js";
import type { IUserRepository } from "./user.repository.js";

export class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];

  async getUsers(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, page = 1, limit = 10 } = params;
    let filtered = this.users;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    const user: User = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
    this.users.push(user);
    return user;
  }

  async updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...data, updatedAt: new Date().toISOString() } as User;
    return this.users[index];
  }

  async deleteUser(id: string): Promise<boolean> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    this.users.splice(index, 1);
    return true;
  }
}
