import { randomUUID } from "crypto";
import type { ClientSession, Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/server-kit";
import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";
import type { IContractRepository } from "./contract.repository.js";

type ContractDoc = WithMongoId<Contract>;

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
    // At most one *active* contract per (listing, provider, beneficiary). Makes the
    // duplicate-create guard atomic — the app-level findActiveContract check races
    // under concurrency. Contracts are always created "pending", so equality on that
    // status covers every create; the trio frees up once the contract goes terminal
    // (completed/rejected) or is deleted. ($in isn't allowed in a partial filter.)
    await this.collection.createIndex(
      { listingId: 1, providerId: 1, beneficiaryId: 1 },
      { unique: true, partialFilterExpression: { signatureStatus: "pending" } },
    );
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

    return { data: docs.map((d) => toEntity<Contract>(d)), total, page, limit };
  }

  async getContractById(id: string): Promise<Contract | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<Contract>(doc) : null;
  }

  async getContractByDocumensoDocumentId(documentId: number): Promise<Contract | null> {
    const doc = await this.collection.findOne({ documensoDocumentId: documentId });
    return doc ? toEntity<Contract>(doc) : null;
  }

  async completeContract(id: string, session?: ClientSession): Promise<Contract | null> {
    // The {$nin} guard + $set are one atomic update, so concurrent webhooks can't
    // both transition (and double-release), and a rejected contract can't complete.
    // The {disputed: {$ne: true}} guard freezes settlement while a dispute is open —
    // a disputed contract must not auto-release the escrow on the next signature event;
    // only an admin resolving the dispute may move the money.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $nin: ["completed", "rejected"] }, disputed: { $ne: true } },
      { $set: { signatureStatus: "completed", providerSigningUrl: null, beneficiarySigningUrl: null } },
      { returnDocument: "after", session },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  async rejectContract(id: string, session?: ClientSession): Promise<Contract | null> {
    // Same terminal + dispute-freeze guard as completeContract: a disputed contract can't
    // auto-refund on a signature event either — it stays frozen until an admin resolves it.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $nin: ["completed", "rejected"] }, disputed: { $ne: true } },
      {
        $set: {
          signatureStatus: "rejected",
          providerSigningUrl: null,
          beneficiarySigningUrl: null,
        },
      },
      { returnDocument: "after", session },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  async disputeContract(id: string, reason: string, session?: ClientSession): Promise<Contract | null> {
    // Atomically raise a dispute only while the contract is in a disputable state
    // (pending or completed — not draft/rejected). The state guard + $set are one update,
    // so a concurrent settlement webhook can't stamp a dispute onto a just-terminal
    // contract, and disputing can't pass on stale read-then-write data.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $in: ["pending", "completed"] } },
      { $set: { disputed: true, disputeReason: reason } },
      { returnDocument: "after", session },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  async resolveDispute(
    id: string,
    terminalStatus: ContractSignatureStatus,
    session?: ClientSession,
  ): Promise<Contract | null> {
    // Atomically clear the dispute (only while disputed:true, so concurrent resolves
    // settle the escrow at most once) and move to the given terminal status, clearing
    // signing URLs. Returns the contract's *pre-resolution* state so the caller can
    // settle the escrow based on whether it was still held; null if it wasn't disputed
    // or doesn't exist.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, disputed: true },
      {
        $set: {
          disputed: false,
          disputeReason: null,
          signatureStatus: terminalStatus,
          providerSigningUrl: null,
          beneficiarySigningUrl: null,
        },
      },
      { returnDocument: "before", session },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  async applyNonTerminalStatus(id: string, status: ContractSignatureStatus): Promise<Contract | null> {
    // Same {$nin} terminal guard as complete/reject — a pending/draft event that
    // arrives after settlement finds no match and is ignored, so it can't regress.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $nin: ["completed", "rejected"] } },
      { $set: { signatureStatus: status } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  async findActiveContract(params: {
    listingId: string;
    providerId: string;
    beneficiaryId: string;
  }): Promise<Contract | null> {
    const doc = await this.collection.findOne({
      listingId: params.listingId,
      providerId: params.providerId,
      beneficiaryId: params.beneficiaryId,
      signatureStatus: { $in: ["draft", "pending"] },
    });
    return doc ? toEntity<Contract>(doc) : null;
  }

  async createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract> {
    const now = new Date().toISOString();
    const doc: ContractDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.collection.insertOne(doc);
    return toEntity<Contract>(doc);
  }

  async updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  async deleteContract(id: string, session?: ClientSession): Promise<Contract | null> {
    // findOneAndDelete returns the removed doc with its state at deletion, so the
    // caller can atomically decide whether to refund a still-held escrow.
    const result = await this.collection.findOneAndDelete({ _id: id }, { session });
    return result ? toEntity<Contract>(result) : null;
  }
}
