import type { Collection, Db } from "mongodb";
import type { IDistrictAdminReaderRepository } from "./district-admin-reader.repository.js";

interface DistrictAdminDoc {
  _id: string;
  userId: string;
  districtId: string;
  createdAt: string;
}

export class MongoDistrictAdminReaderRepository implements IDistrictAdminReaderRepository {
  private collection: Collection<DistrictAdminDoc>;

  constructor(db: Db) {
    this.collection = db.collection("district_admins");
  }

  async findDistrictIdByUserId(userId: string): Promise<string | null> {
    const doc = await this.collection.findOne({ userId });
    return doc ? doc.districtId : null;
  }
}
