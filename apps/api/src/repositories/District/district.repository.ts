import type { District } from "../../entities/district.entity.js";

export interface IDistrictRepository {
  getDistricts(params: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
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
