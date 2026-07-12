import type { District, GeoJson } from "../../entities/district.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { IDistrictRepository, UpdateDistrictData } from "./district.repository.js";

/** SATAN QL for id lookup and delete; Mongo for the geo query, the list and the
 *  geoJson-shaped create/update. */
export class SatanDistrictRepository implements IDistrictRepository {
  constructor(
    private readonly mongo: IDistrictRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getDistrictById(id: string): Promise<District | null> {
    return this.satan.findOne<District>(`FIND districts WHERE _id = ${this.satan.q(id)}`);
  }

  async deleteDistrict(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM districts WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
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
