import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";
import type { IContractRepository } from "./contract.repository.js";

type ContractDoc = Omit<Contract, "id"> & { _id: string };

export class MongoContractRepository implements IContractRepository {
  private collection: Collection<ContractDoc>;

  constructor(db: Db) {
    this.collection = db.collection("contracts");
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped list filtering.
    await this.collection.createIndex({ districtId: 1 });
    // Backs the webhook lookup by Documenso document id (sparse: null before a
    // document is generated). Unique — one contract per Documenso document.
    await this.collection.createIndex({ documensoDocumentId: 1 }, { unique: true, sparse: true });
  }

  async getContracts(params: {
    listingId?: string;
    districtId?: string;
    providerId?: string;
    beneficiaryId?: string;
    partyId?: string;
    signatureStatus?: string;
    disputed?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Contract[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      listingId,
      districtId,
      providerId,
      beneficiaryId,
      partyId,
      signatureStatus,
      disputed,
      page = 1,
      limit = 20,
    } = params;

    const filter: Filter<ContractDoc> = {};

    if (listingId) filter.listingId = listingId;
    if (districtId) filter.districtId = districtId;
    if (providerId) filter.providerId = providerId;
    if (beneficiaryId) filter.beneficiaryId = beneficiaryId;
    if (partyId) filter.$or = [{ providerId: partyId }, { beneficiaryId: partyId }];
    if (signatureStatus) filter.signatureStatus = signatureStatus as ContractSignatureStatus;
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

  async getContractByDocumensoDocumentId(documentId: number): Promise<Contract | null> {
    const doc = await this.collection.findOne({ documensoDocumentId: documentId });
    return doc ? this.toContract(doc) : null;
  }

  async createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract> {
    const now = new Date().toISOString();
    const doc: ContractDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.collection.insertOne(doc);
    return this.toContract(doc);
  }

  async updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null> {
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
