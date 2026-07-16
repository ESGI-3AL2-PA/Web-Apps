import type { Collection, Db } from "mongodb";
import { DISTRICT_ADMINS_COLLECTION, type DistrictAdminDocument, type WithMongoId } from "@repo/shared";
import type { IDistrictAdminReaderRepository } from "./district-admin-reader.repository.js";

type DistrictAdminDoc = WithMongoId<DistrictAdminDocument>;

export class MongoDistrictAdminReaderRepository implements IDistrictAdminReaderRepository {
  private collection: Collection<DistrictAdminDoc>;

  constructor(db: Db) {
    this.collection = db.collection(DISTRICT_ADMINS_COLLECTION);
  }

  async findDistrictIdByUserId(userId: string): Promise<string | null> {
    const doc = await this.collection.findOne({ userId });
    return doc ? doc.districtId : null;
  }
}
