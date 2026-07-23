import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";
import type { IContractRepository } from "./contract.repository.js";
import { eq, paginate, where } from "../satan.helpers.js";

/**
 * Repository des contrats en implémentation hybride.
 *
 * Utilise le langage SATAN QL pour la recherche par id et la liste paginée
 * (COUNT + FIND, match d'une partie via OR) ; délègue à Mongo les transitions
 * atomiques gardées, les suppressions qui renvoient le document retiré et les
 * écritures scopées à une session, qu'un langage scalaire ne peut exprimer.
 */
export class SatanContractRepository implements IContractRepository {
  constructor(
    private readonly mongo: IContractRepository,
    private readonly satan: SatanClient,
  ) {}

  async getContractById(id: string): Promise<Contract | null> {
    const rows = (await this.satan.query(`FIND contracts WHERE _id = ${quote(id)}`)) as Contract[];
    return rows[0] ?? null;
  }

  getContracts(params: Parameters<IContractRepository["getContracts"]>[0]) {
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
    const clause = where([
      listingId && eq("listingId", listingId),
      districtId && eq("districtId", districtId),
      providerId && eq("providerId", providerId),
      beneficiaryId && eq("beneficiaryId", beneficiaryId),
      // Le filtre "partie" matche prestataire OU bénéficiaire (une seule clause OR).
      partyId && `(providerId = ${quote(partyId)} OR beneficiaryId = ${quote(partyId)})`,
      signatureStatus && eq("signatureStatus", signatureStatus),
      disputed !== undefined && eq("disputed", disputed),
    ]);
    return paginate<Contract>(this.satan, "contracts", clause, { page, limit });
  }

  // --- délégué à Mongo (transitions atomiques / écritures scopées à une session) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
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
  disputeContract(id: string, reason: string, session?: ClientSession): Promise<Contract | null> {
    return this.mongo.disputeContract(id, reason, session);
  }
  resolveDispute(
    id: string,
    terminalStatus: ContractSignatureStatus,
    session?: ClientSession,
  ): Promise<Contract | null> {
    return this.mongo.resolveDispute(id, terminalStatus, session);
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
