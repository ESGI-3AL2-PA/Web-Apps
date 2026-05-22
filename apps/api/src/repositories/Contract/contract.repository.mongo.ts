import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Contract, OpenSignStatus } from "../../entities/contract.entity.js";
import type { IContractRepository } from "./contract.repository.js";

type ContractDoc = Omit<Contract, "id"> & { _id: string };

export class MongoContractRepository implements IContractRepository {
  private collection: Collection<ContractDoc>;

  constructor(db: Db) {
    this.collection = db.collection("contracts");
  }

  async getContracts(params: {
    listingId?: string;
    providerId?: string;
    beneficiaryId?: string;
    openSignStatus?: string;
    disputed?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Contract[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { listingId, providerId, beneficiaryId, openSignStatus, disputed, page = 1, limit = 20 } = params;

    const filter: Filter<ContractDoc> = {};

    if (listingId) filter.listingId = listingId;
    if (providerId) filter.providerId = providerId;
    if (beneficiaryId) filter.beneficiaryId = beneficiaryId;
    if (openSignStatus) filter.openSignStatus = openSignStatus as OpenSignStatus;
    if (disputed !== undefined) filter.disputed = disputed;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toContract), total, page, limit };
  }

  async getContractById(id: string): Promise<Contract | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toContract(doc) : null;
  }

  async createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract> {
    const now = new Date().toISOString();
    const doc: ContractDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.collection.insertOne(doc);
    return this.toContract(doc);
  }

  async updateContract(
    id: string,
    data: Partial<Omit<Contract, "id" | "createdAt">>,
  ): Promise<Contract | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? this.toContract(result) : null;
  }

  async deleteContract(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  private toContract(doc: ContractDoc): Contract {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
