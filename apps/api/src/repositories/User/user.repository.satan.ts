import { quote, type SatanClient } from "@repo/satan";
import type { User } from "../../entities/user.entity.js";
import type { IUserRepository } from "./user.repository.js";
import { containsAny, eq, paginate, where } from "../satan.helpers.js";

/**
 * SATAN-QL-backed user repository. Key lookups, the paginated `getUsers` list
 * (COUNT + CONTAINS search), the scalar `setBanned` transition and the id delete
 * all go through SATAN QL (`satan.query`); only the server-generated
 * create/update delegate to the wrapped Mongo repository.
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

  async findUsersByDistrict(districtId: string): Promise<User[]> {
    return (await this.satan.query(`FIND users WHERE districtId = ${quote(districtId)}`)) as User[];
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

  getUsers(params: { search?: string; districtId?: string; role?: string; page?: number; limit?: number }) {
    const { search, districtId, role, page = 1, limit = 10 } = params;
    const clause = where([
      search && containsAny(["firstName", "lastName", "email"], search),
      districtId && eq("districtId", districtId),
      role && eq("role", role),
    ]);
    return paginate<User>(this.satan, "users", clause, { page, limit });
  }

  // --- delegated to Mongo (server-generated fields) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    return this.mongo.createUser(data);
  }
  updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User | null> {
    return this.mongo.updateUser(id, data);
  }
}
