import { quote, type SatanClient } from "@repo/satan";
import type { DistrictAdmin } from "../../entities/district-admin.entity.js";
import type { IDistrictAdminRepository } from "./district-admin.repository.js";

/** SATAN QL for the id lookup, the (districtId, userId) existence check and the
 *  id delete. */
export class SatanDistrictAdminRepository implements IDistrictAdminRepository {
  constructor(
    private readonly mongo: IDistrictAdminRepository,
    private readonly satan: SatanClient,
  ) {}

  async getDistrictAdminById(id: string): Promise<DistrictAdmin | null> {
    const rows = (await this.satan.query(`FIND district_admins WHERE _id = ${quote(id)}`)) as DistrictAdmin[];
    return rows[0] ?? null;
  }

  async findExisting(districtId: string, userId: string): Promise<DistrictAdmin | null> {
    const rows = (await this.satan.query(
      `FIND district_admins WHERE districtId = ${quote(districtId)} AND userId = ${quote(userId)}`,
    )) as DistrictAdmin[];
    return rows[0] ?? null;
  }

  async deleteDistrictAdmin(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM district_admins WHERE _id = ${quote(id)}`)) as {
      deletedCount: number;
    };
    return res.deletedCount > 0;
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  listDistrictAdmins(params: Parameters<IDistrictAdminRepository["listDistrictAdmins"]>[0]) {
    return this.mongo.listDistrictAdmins(params);
  }
  createDistrictAdmin(data: Omit<DistrictAdmin, "id" | "createdAt">): Promise<DistrictAdmin> {
    return this.mongo.createDistrictAdmin(data);
  }
}
