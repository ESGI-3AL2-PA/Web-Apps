import { quote, type SatanClient } from "@repo/satan";
import type { User } from "../../entities/user.entity.js";
import type { IUserRepository } from "./user.repository.js";

/**
 * SATAN-QL-backed user repository. Simple key lookups, the scalar `setBanned`
 * transition and the id delete go through SATAN QL (`satan.query`); anything
 * needing a count + `$or` regex (getUsers) or server-generated fields
 * (create/update) delegates to the wrapped Mongo repository.
 */
export class SatanUserRepository implements IUserRepository {
  constructor(
    private readonly mongo: IUserRepository,
    private readonly satan: SatanClient,
  ) {}

  async getUserById(id: string): Promise<User | null> {
    const rows = (await this.satan.query(`FIND users WHERE _id = ${quote(id)}`)) as User[];
    return rows[0] ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const rows = (await this.satan.query(`FIND users WHERE email = ${quote(email)}`)) as User[];
    return rows[0] ?? null;
  }

  async setBanned(id: string, banned: boolean): Promise<User | null> {
    const now = new Date().toISOString();
    await this.satan.query(
      `UPDATE users SET banned = ${quote(banned)}, updatedAt = ${quote(now)} WHERE _id = ${quote(id)}`,
    );
    const rows = (await this.satan.query(`FIND users WHERE _id = ${quote(id)}`)) as User[];
    return rows[0] ?? null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM users WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
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
