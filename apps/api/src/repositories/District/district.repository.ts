import type { District, GeoJson } from "../../entities/district.entity.js";

export interface IDistrictRepository {
  // Creates the 2dsphere index backing findDistrictContaining (idempotent).
  ensureIndexes(): Promise<void>;

  // Returns the district whose geometry contains the given point, or null.
  findDistrictContaining(point: GeoJson): Promise<District | null>;

  getDistricts(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: District[];
    total: number;
    page: number;
    limit: number;
  }>;

  getDistrictById(id: string): Promise<District | null>;

  createDistrict(data: Omit<District, "id">): Promise<District>;

  updateDistrict(id: string, data: Partial<Omit<District, "id">>): Promise<District | null>;

  deleteDistrict(id: string): Promise<boolean>;
}
