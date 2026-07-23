import { quote, type SatanClient } from "@repo/satan";
import type { DistrictAdmin } from "../../entities/district-admin.entity.js";
import type { IDistrictAdminRepository } from "./district-admin.repository.js";
import { eq, paginate, where } from "../satan.helpers.js";

/**
 * Repository des administrateurs de quartier en implémentation hybride.
 *
 * SATAN QL pour la recherche par id, le test d'existence (districtId, userId), la
 * suppression par id et la liste paginée (COUNT + FIND). La création reste
 * déléguée à Mongo (champs générés côté serveur).
 */
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

  listDistrictAdmins(params: Parameters<IDistrictAdminRepository["listDistrictAdmins"]>[0]) {
    const { districtId, userId, page = 1, limit = 20 } = params;
    const clause = where([districtId && eq("districtId", districtId), userId && eq("userId", userId)]);
    return paginate<DistrictAdmin>(this.satan, "district_admins", clause, { page, limit });
  }

  // --- délégué à Mongo (champs générés côté serveur) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  createDistrictAdmin(data: Omit<DistrictAdmin, "id" | "createdAt">): Promise<DistrictAdmin> {
    return this.mongo.createDistrictAdmin(data);
  }
}
