import { randomUUID } from "crypto";
import type { ClientSession, Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { Contract, ContractSignatureStatus } from "../../entities/contract.entity.js";
import type { IContractRepository } from "./contract.repository.js";

type ContractDoc = WithMongoId<Contract>;

/**
 * Repository Mongo des contrats (e-signature Documenso + escrow). Gère le cycle de vie de la
 * signature (complete/reject), les litiges (dispute/resolve) et l'unicité des contrats actifs,
 * en s'appuyant sur des mises à jour atomiques `findOneAndUpdate` avec gardes pour rester correct
 * sous concurrence (webhooks Documenso simultanés).
 */
export class MongoContractRepository implements IContractRepository {
  private collection: Collection<ContractDoc>;

  constructor(db: Db) {
    this.collection = db.collection("contracts");
  }

  /** Crée les index : filtrage par quartier, lookup webhook par doc Documenso, et unicité du contrat actif. */
  async ensureIndexes(): Promise<void> {
    // Soutient le filtrage des listes scopées par quartier.
    await this.collection.createIndex({ districtId: 1 });
    // Soutient le lookup du webhook par id de document Documenso (sparse : null avant qu'un
    // document soit généré). Unique — un contrat par document Documenso.
    await this.collection.createIndex({ documensoDocumentId: 1 }, { unique: true, sparse: true });
    // Au plus un contrat *actif* par (annonce, prestataire, bénéficiaire). Rend la garde anti-doublon
    // atomique — le contrôle findActiveContract au niveau app est sujet aux courses sous concurrence.
    // Les contrats sont toujours créés "pending", donc l'égalité sur ce statut couvre chaque création ;
    // le trio se libère dès que le contrat devient terminal (completed/rejected) ou est supprimé.
    // ($in n'est pas autorisé dans un partial filter.)
    await this.collection.createIndex(
      { listingId: 1, providerId: 1, beneficiaryId: 1 },
      { unique: true, partialFilterExpression: { signatureStatus: "pending" } },
    );
  }

  /** Liste paginée des contrats, filtrable par annonce, quartier, partie (provider/beneficiary/partyId), statut et litige. */
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
    // partyId : contrats où l'utilisateur est prestataire OU bénéficiaire (l'une ou l'autre partie).
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

  /** Récupère un contrat par son id, ou null s'il n'existe pas. */
  async getContractById(id: string): Promise<Contract | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<Contract>(doc) : null;
  }

  /** Récupère le contrat associé à un document Documenso (utilisé par le handler de webhook). */
  async getContractByDocumensoDocumentId(documentId: number): Promise<Contract | null> {
    const doc = await this.collection.findOne({ documensoDocumentId: documentId });
    return doc ? toEntity<Contract>(doc) : null;
  }

  /** Passe le contrat en "completed" atomiquement (garde anti double-libération et anti-litige). */
  async completeContract(id: string, session?: ClientSession): Promise<Contract | null> {
    // La garde {$nin} + le $set forment une seule mise à jour atomique : des webhooks concurrents ne
    // peuvent pas transitionner tous les deux (et double-libérer l'escrow), et un contrat rejeté ne
    // peut pas se compléter. La garde {disputed: {$ne: true}} gèle le règlement tant qu'un litige est
    // ouvert — un contrat en litige ne doit pas auto-libérer l'escrow au prochain événement de
    // signature ; seul un admin résolvant le litige peut déplacer l'argent.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $nin: ["completed", "rejected"] }, disputed: { $ne: true } },
      { $set: { signatureStatus: "completed", providerSigningUrl: null, beneficiarySigningUrl: null } },
      { returnDocument: "after", session },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  /** Passe le contrat en "rejected" atomiquement (mêmes gardes terminal + gel de litige que complete). */
  async rejectContract(id: string, session?: ClientSession): Promise<Contract | null> {
    // Même garde terminal + gel de litige que completeContract : un contrat en litige ne peut pas
    // non plus auto-rembourser sur un événement de signature — il reste gelé jusqu'à résolution par un admin.
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

  /** Ouvre atomiquement un litige, uniquement si le contrat est dans un état contestable (pending ou completed). */
  async disputeContract(id: string, reason: string, session?: ClientSession): Promise<Contract | null> {
    // Ouvre atomiquement un litige seulement tant que le contrat est dans un état contestable
    // (pending ou completed — pas draft/rejected). La garde d'état + le $set forment une seule
    // mise à jour, donc un webhook de règlement concurrent ne peut pas apposer un litige sur un
    // contrat tout juste terminal, et l'ouverture ne peut pas s'appuyer sur des données lues-puis-écrites périmées.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $in: ["pending", "completed"] } },
      { $set: { disputed: true, disputeReason: reason } },
      { returnDocument: "after", session },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  /** Résout un litige : le clôt et fixe le statut terminal, en renvoyant l'état pré-résolution pour le règlement de l'escrow. */
  async resolveDispute(
    id: string,
    terminalStatus: ContractSignatureStatus,
    session?: ClientSession,
  ): Promise<Contract | null> {
    // Lève atomiquement le litige (seulement tant que disputed:true, pour que des résolutions
    // concurrentes ne règlent l'escrow qu'une seule fois) et passe au statut terminal donné en
    // effaçant les URLs de signature. Renvoie l'état *pré-résolution* du contrat pour que l'appelant
    // règle l'escrow selon qu'il était encore retenu ; null s'il n'était pas en litige ou n'existe pas.
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

  /** Applique un statut non terminal (ex. draft→pending), ignoré si le contrat est déjà terminal (garde d'idempotence). */
  async applyNonTerminalStatus(id: string, status: ContractSignatureStatus): Promise<Contract | null> {
    // Même garde terminal {$nin} que complete/reject — un événement pending/draft qui arrive après
    // le règlement ne trouve aucune correspondance et est ignoré, donc il ne peut pas faire régresser l'état.
    const result = await this.collection.findOneAndUpdate(
      { _id: id, signatureStatus: { $nin: ["completed", "rejected"] } },
      { $set: { signatureStatus: status } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  /** Trouve un contrat encore actif (draft ou pending) pour le trio (annonce, prestataire, bénéficiaire) — garde anti-doublon. */
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

  /** Insère un nouveau contrat (id UUID + createdAt générés côté serveur). */
  async createContract(data: Omit<Contract, "id" | "createdAt">): Promise<Contract> {
    const now = new Date().toISOString();
    const doc: ContractDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.collection.insertOne(doc);
    return toEntity<Contract>(doc);
  }

  /** Met à jour partiellement un contrat et renvoie le document mis à jour (id et createdAt exclus). */
  async updateContract(id: string, data: Partial<Omit<Contract, "id" | "createdAt">>): Promise<Contract | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Contract>(result) : null;
  }

  /** Supprime un contrat et renvoie le document supprimé (son état à la suppression) pour un éventuel remboursement d'escrow. */
  async deleteContract(id: string, session?: ClientSession): Promise<Contract | null> {
    // findOneAndDelete renvoie le document supprimé avec son état au moment de la suppression, pour
    // que l'appelant puisse décider atomiquement de rembourser un escrow encore retenu.
    const result = await this.collection.findOneAndDelete({ _id: id }, { session });
    return result ? toEntity<Contract>(result) : null;
  }
}
