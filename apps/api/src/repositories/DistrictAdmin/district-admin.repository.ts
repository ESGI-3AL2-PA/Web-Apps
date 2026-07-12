import type { DistrictAdmin } from "../../entities/district-admin.entity.js";

export interface IDistrictAdminRepository {
  listDistrictAdmins(params: { districtId?: string; userId?: string; page?: number; limit?: number }): Promise<{
    data: DistrictAdmin[];
    total: number;
    page: number;
    limit: number;
  }>;

  getDistrictAdminById(id: string): Promise<DistrictAdmin | null>;

  findExisting(districtId: string, userId: string): Promise<DistrictAdmin | null>;

  createDistrictAdmin(data: Omit<DistrictAdmin, "id" | "createdAt">): Promise<DistrictAdmin>;

  deleteDistrictAdmin(id: string): Promise<boolean>;

  /** Ensures the unique compound index `(districtId, userId)` is in place. */
  ensureIndexes(): Promise<void>;
}
