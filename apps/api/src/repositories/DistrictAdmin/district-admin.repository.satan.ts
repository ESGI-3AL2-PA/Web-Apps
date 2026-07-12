import type { DistrictAdmin } from "../../entities/district-admin.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { IDistrictAdminRepository } from "./district-admin.repository.js";

/** SATAN QL for the id lookup, the (districtId, userId) existence check and the
 *  id delete. */
export class SatanDistrictAdminRepository implements IDistrictAdminRepository {
  constructor(
    private readonly mongo: IDistrictAdminRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getDistrictAdminById(id: string): Promise<DistrictAdmin | null> {
    return this.satan.findOne<DistrictAdmin>(`FIND district_admins WHERE _id = ${this.satan.q(id)}`);
  }

  findExisting(districtId: string, userId: string): Promise<DistrictAdmin | null> {
    return this.satan.findOne<DistrictAdmin>(
      `FIND district_admins WHERE districtId = ${this.satan.q(districtId)} AND userId = ${this.satan.q(userId)}`,
    );
  }

  async deleteDistrictAdmin(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM district_admins WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
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
