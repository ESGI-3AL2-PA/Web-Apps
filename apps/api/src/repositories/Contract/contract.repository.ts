import type { ClientSession } from "mongodb";
import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";

/**
 * Interface du repository des contrats (couche persistance).
 *
 * Un contrat lie une annonce, un prestataire et un bénéficiaire, et gère le
 * cycle de signature Documenso ainsi que l'escrow (points bloqués). Beaucoup de
 * méthodes sont des transitions d'état ATOMIQUES et GARDÉES : elles ne
 * s'appliquent que si le contrat est encore dans un état autorisé, ce qui ferme
 * les courses read-then-write avec le webhook Documenso.
 */
export interface IContractRepository {
  ensureIndexes(): Promise<void>;

  getContracts(params: {
    listingId?: string;
    districtId?: string;
    providerId?: string;
    beneficiaryId?: string;
    // Restreint aux contrats où cet utilisateur est prestataire OU bénéficiaire.
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

  // Recherche par l'id de document Documenso — utilisé par le handler du webhook
  // pour rattacher un événement de signature entrant à notre contrat.
  getContractByDocumensoDocumentId(documentId: number): Promise<Contract | null>;

  // Transitionne atomiquement un contrat non-terminal et *non-litigieux* vers
  // completed / rejected, exactement une fois (efface les URLs de signature).
  // Renvoie le contrat mis à jour si CET appel a opéré la transition, null sinon —
  // ce qui permet au webhook de libérer/rembourser l'escrow une seule fois, et
  // gèle le règlement tant qu'un litige est ouvert.
  completeContract(id: string, session?: ClientSession): Promise<Contract | null>;
  rejectContract(id: string, session?: ClientSession): Promise<Contract | null>;

  // Ouvre atomiquement un litige uniquement tant que le contrat est contestable
  // (pending ou completed). Renvoie le contrat mis à jour, ou null s'il n'existe
  // pas ou n'est pas dans un état contestable — la garde d'état ferme la course
  // read-then-write avec le webhook.
  disputeContract(id: string, reason: string, session?: ClientSession): Promise<Contract | null>;

  // Clôt atomiquement un litige (uniquement tant qu'il est disputed) et passe à
  // `terminalStatus`, en renvoyant l'état *pré-résolution* du contrat pour que
  // l'appelant règle correctement l'escrow encore bloqué. Null s'il n'était pas
  // en litige / n'existe pas.
  resolveDispute(
    id: string,
    terminalStatus: ContractSignatureStatus,
    session?: ClientSession,
  ): Promise<Contract | null>;

  // Applique atomiquement un statut non-terminal (pending/draft) uniquement tant
  // que le contrat est encore non-terminal, afin qu'un webhook tardif/dupliqué ne
  // puisse pas faire régresser un contrat completed/rejected. Renvoie null si le
  // contrat était déjà terminal (ou disparu).
  applyNonTerminalStatus(id: string, status: ContractSignatureStatus): Promise<Contract | null>;

  // Renvoie un contrat non-terminal (draft/pending) existant liant la même
  // annonce + prestataire + bénéficiaire, s'il y en a un — utilisé pour rejeter
  // les créations en doublon (un double-submit accidentel bloquerait sinon deux
  // fois le prix en escrow).
  findActiveContract(params: {
    listingId: string;
    providerId: string;
    beneficiaryId: string;
  }): Promise<Contract | null>;

  createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract>;

  updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null>;

  // Supprime et renvoie le contrat retiré (atomiquement, avec son état au moment
  // de la suppression) pour qu'un appelant puisse rembourser un escrow encore
  // bloqué. Null s'il n'existait pas.
  deleteContract(id: string, session?: ClientSession): Promise<Contract | null>;
}
