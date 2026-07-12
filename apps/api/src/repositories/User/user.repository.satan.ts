import type { User } from "../../entities/user.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { IUserRepository } from "./user.repository.js";

/**
 * SATAN-QL-backed user repository. Simple key lookups, the scalar `setBanned`
 * transition and the id delete go through SATAN QL; anything needing a count +
 * `$or` regex (getUsers) or server-generated fields (create/update) delegates to
 * the wrapped Mongo repository.
 */
export class SatanUserRepository implements IUserRepository {
  constructor(
    private readonly mongo: IUserRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getUserById(id: string): Promise<User | null> {
    return this.satan.findOne<User>(`FIND users WHERE _id = ${this.satan.q(id)}`);
  }

  getUserByEmail(email: string): Promise<User | null> {
    return this.satan.findOne<User>(`FIND users WHERE email = ${this.satan.q(email)}`);
  }

  setBanned(id: string, banned: boolean): Promise<User | null> {
    const now = new Date().toISOString();
    return this.satan.updateReturning<User>(
      "users",
      id,
      `UPDATE users SET banned = ${this.satan.q(banned)}, updatedAt = ${this.satan.q(now)} WHERE _id = ${this.satan.q(id)}`,
    );
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM users WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
  }

  // --- delegated to Mongo (count + $or regex / server-generated fields) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getUsers(params: { search?: string; districtId?: string; role?: string; page?: number; limit?: number }) {
    return this.mongo.getUsers(params);
  }
  createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    return this.mongo.createUser(data);
  }
  updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null> {
    return this.mongo.updateUser(id, data);
  }
}
