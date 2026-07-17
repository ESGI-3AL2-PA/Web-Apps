import type { District, GeoJson } from "../../entities/district.entity.js";

// geoJson: null clears an existing boundary; omitted leaves it untouched.
export type UpdateDistrictData = Partial<Omit<District, "id" | "geoJson">> & { geoJson?: GeoJson | null };

export interface IDistrictRepository {
  // Creates the 2dsphere index backing findDistrictsContaining (idempotent).
  ensureIndexes(): Promise<void>;

  // Every district whose geometry contains the given point. Districts may overlap, so a
  // point can fall in several — the caller decides how to disambiguate (0 => none, 1 =>
  // auto-join, >1 => the user picks).
  findDistrictsContaining(point: GeoJson): Promise<District[]>;

  getDistricts(params: { search?: string; page?: number; limit?: number }): Promise<{
    data: District[];
    total: number;
    page: number;
    limit: number;
  }>;

  getDistrictById(id: string): Promise<District | null>;

  createDistrict(data: Omit<District, "id">): Promise<District>;

  updateDistrict(id: string, data: UpdateDistrictData): Promise<District | null>;

  deleteDistrict(id: string): Promise<boolean>;
}
