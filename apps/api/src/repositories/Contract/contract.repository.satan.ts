import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";
import type { IContractRepository } from "./contract.repository.js";

/** SATAN QL for the id lookup only — the rest are atomic guarded transitions,
 *  return-the-removed-doc deletes, session-scoped writes or paginated lists that
 *  a scalar find/insert/update/delete language can't express. */
export class SatanContractRepository implements IContractRepository {
  constructor(
    private readonly mongo: IContractRepository,
    private readonly satan: SatanClient,
  ) {}

  async getContractById(id: string): Promise<Contract | null> {
    const rows = (await this.satan.query(`FIND contracts WHERE _id = ${quote(id)}`)) as Contract[];
    return rows[0] ?? null;
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getContracts(params: Parameters<IContractRepository["getContracts"]>[0]) {
    return this.mongo.getContracts(params);
  }
  getContractByDocumensoDocumentId(documentId: number): Promise<Contract | null> {
    return this.mongo.getContractByDocumensoDocumentId(documentId);
  }
  completeContract(id: string, session?: ClientSession): Promise<Contract | null> {
    return this.mongo.completeContract(id, session);
  }
  rejectContract(id: string, session?: ClientSession): Promise<Contract | null> {
    return this.mongo.rejectContract(id, session);
  }
  applyNonTerminalStatus(id: string, status: ContractSignatureStatus): Promise<Contract | null> {
    return this.mongo.applyNonTerminalStatus(id, status);
  }
  findActiveContract(params: {
    listingId: string;
    providerId: string;
    beneficiaryId: string;
  }): Promise<Contract | null> {
    return this.mongo.findActiveContract(params);
  }
  createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract> {
    return this.mongo.createContract(data);
  }
  updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null> {
    return this.mongo.updateContract(id, data);
  }
  deleteContract(id: string, session?: ClientSession): Promise<Contract | null> {
    return this.mongo.deleteContract(id, session);
  }
}
