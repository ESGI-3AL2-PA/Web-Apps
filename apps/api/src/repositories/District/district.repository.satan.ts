import { quote, type SatanClient } from "@repo/satan";
import type { District, GeoJson } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "./district.repository.js";
import { containsAny, paginate, where } from "../satan.helpers.js";

/** SATAN QL for id lookup, delete and the paginated list (COUNT + CONTAINS
 *  search); Mongo for the geo query and the geoJson-shaped create/update. */
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

  // --- delegated to Mongo (geo / geoJson-shaped writes) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  findDistrictContaining(point: GeoJson): Promise<District | null> {
    return this.mongo.findDistrictContaining(point);
  }
  createDistrict(data: Omit<District, "id">): Promise<District> {
    return this.mongo.createDistrict(data);
  }
  updateDistrict(id: string, data: UpdateDistrictData): Promise<District | null> {
    return this.mongo.updateDistrict(id, data);
  }
}
