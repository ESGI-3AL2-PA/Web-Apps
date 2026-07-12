import { quote, type SatanClient } from "@repo/satan";
import type { District, GeoJson } from "../../entities/district.entity.js";
import type { IDistrictRepository, UpdateDistrictData } from "./district.repository.js";

/** SATAN QL for id lookup and delete; Mongo for the geo query, the list and the
 *  geoJson-shaped create/update. */
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

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  findDistrictContaining(point: GeoJson): Promise<District | null> {
    return this.mongo.findDistrictContaining(point);
  }
  getDistricts(params: Parameters<IDistrictRepository["getDistricts"]>[0]) {
    return this.mongo.getDistricts(params);
  }
  createDistrict(data: Omit<District, "id">): Promise<District> {
    return this.mongo.createDistrict(data);
  }
  updateDistrict(id: string, data: UpdateDistrictData): Promise<District | null> {
    return this.mongo.updateDistrict(id, data);
  }
}
