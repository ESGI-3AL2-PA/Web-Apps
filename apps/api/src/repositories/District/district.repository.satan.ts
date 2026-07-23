import { quote, type SatanClient } from "@repo/satan";
import type { District, GeoJson } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "./district.repository.js";
import { containsAny, paginate, where } from "../satan.helpers.js";

/**
 * Repository des quartiers en implémentation hybride.
 *
 * SATAN QL pour la recherche par id, la suppression et la liste paginée (COUNT +
 * recherche CONTAINS) ; Mongo pour la requête géospatiale et les créations/mises à
 * jour comportant du geoJson.
 */
export class SatanDistrictRepository implements IDistrictRepository {
  constructor(
    private readonly mongo: IDistrictRepository,
    private readonly satan: SatanClient,
  ) {}

  async getDistrictById(id: string): Promise<District | null> {
    const rows = (await this.satan.query(`FIND districts WHERE _id = ${quote(id)}`)) as District[];
    return rows[0] ?? null;
  }

  async deleteDistrict(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM districts WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
  }

  getDistricts(params: Parameters<IDistrictRepository["getDistricts"]>[0]) {
    const { search, page = 1, limit = 20 } = params;
    const clause = where([search && containsAny(["name"], search)]);
    return paginate<District>(this.satan, "districts", clause, { page, limit });
  }

  // --- délégué à Mongo (géospatial / écritures comportant du geoJson) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  findDistrictsContaining(point: GeoJson): Promise<District[]> {
    return this.mongo.findDistrictsContaining(point);
  }
  createDistrict(data: Omit<District, "id">): Promise<District> {
    return this.mongo.createDistrict(data);
  }
  updateDistrict(id: string, data: UpdateDistrictData): Promise<District | null> {
    return this.mongo.updateDistrict(id, data);
  }
}
