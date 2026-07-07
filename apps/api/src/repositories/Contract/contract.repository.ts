import type { Contract } from "../../entities/contract.entity.js";

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

  createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract>;

  updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null>;

  deleteContract(id: string): Promise<boolean>;
}
