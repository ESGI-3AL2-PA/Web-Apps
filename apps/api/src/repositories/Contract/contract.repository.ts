import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";

export interface IContractRepository {
  ensureIndexes(): Promise<void>;

  getContracts(params: {
    listingId?: string;
    districtId?: string;
    providerId?: string;
    beneficiaryId?: string;
    // Restrict to contracts where this user is provider OR beneficiary.
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
  }>;

  getContractById(id: string): Promise<Contract | null>;

  // Lookup by the Documenso document id — used by the webhook handler to map an
  // inbound signing event back to our contract.
  getContractByDocumensoDocumentId(documentId: number): Promise<Contract | null>;

  // Atomically transition a non-terminal contract to completed / rejected exactly
  // once (clearing signing URLs). Return the updated contract when this call made
  // the transition, null otherwise — lets the webhook release/refund the escrow
  // exactly once.
  completeContract(id: string): Promise<Contract | null>;
  rejectContract(id: string): Promise<Contract | null>;

  // Atomically apply a non-terminal status (pending/draft) only while the contract is
  // still non-terminal, so a late/duplicate webhook can't regress a completed/rejected
  // contract. Returns null if the contract was already terminal (or gone).
  applyNonTerminalStatus(id: string, status: ContractSignatureStatus): Promise<Contract | null>;

  // Returns an existing non-terminal (draft/pending) contract binding the same
  // listing + provider + beneficiary, if any — used to reject duplicate creations
  // (an accidental double-submit would otherwise escrow the price twice).
  findActiveContract(params: {
    listingId: string;
    providerId: string;
    beneficiaryId: string;
  }): Promise<Contract | null>;

  createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract>;

  updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null>;

  // Deletes and returns the removed contract (atomically, with its state at
  // deletion) so a caller can refund a still-held escrow. Null if it didn't exist.
  deleteContract(id: string): Promise<Contract | null>;
}
