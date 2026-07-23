import type { CreateContractDto } from "@repo/contracts";
import { logger } from "@repo/shared";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";

/**
 * Cas d'usage : création d'un contrat entre un prestataire et un bénéficiaire à
 * partir d'une annonce, avec mise sous séquestre (escrow) du prix côté bénéficiaire
 * et génération du document de signature Documenso.
 *
 * Ce fichier expose la factory du cas d'usage ainsi que les erreurs métier typées
 * levées lorsqu'une invariante de réservation ou d'argent n'est pas respectée.
 */

/** Levée quand l'annonce référencée n'existe pas (→ 404). */
export class ListingNotFoundError extends Error {
  constructor() {
    super("Listing not found");
    this.name = "ListingNotFoundError";
  }
}

/** Levée quand l'annonce n'est plus active — on ne réserve pas une annonce close (→ 409). */
export class ListingNotActiveError extends Error {
  constructor() {
    super("This listing is no longer active");
    this.name = "ListingNotActiveError";
  }
}

/** Levée quand prestataire et bénéficiaire sont le même utilisateur — un contrat lie deux personnes distinctes. */
export class SamePartyError extends Error {
  constructor() {
    super("Provider and beneficiary must be different users");
    this.name = "SamePartyError";
  }
}

/** Levée quand le providerId fourni ne correspond pas à l'auteur de l'annonce. */
export class NotListingProviderError extends Error {
  constructor() {
    super("You are not a party to this listing's contract");
    this.name = "NotListingProviderError";
  }
}

/** Levée quand l'un des deux comptes (prestataire ou bénéficiaire) est introuvable. */
export class ContractPartyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractPartyNotFoundError";
  }
}

/** Levée quand le solde du bénéficiaire ne couvre pas le prix à mettre sous séquestre (→ 402/409). */
export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient balance to escrow the contract price");
    this.name = "InsufficientFundsError";
  }
}

/** Levée quand un contrat actif existe déjà pour la même annonce et les mêmes parties (→ 409). */
export class DuplicateContractError extends Error {
  constructor() {
    super("An active contract already exists for this listing and parties");
    this.name = "DuplicateContractError";
  }
}

// Une MongoServerError avec le code 11000 est une violation d'index unique — ici,
// l'index unique partiel sur (listingId, providerId, beneficiaryId) pour les contrats
// en attente.
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;

/**
 * Fabrique le cas d'usage de création de contrat.
 *
 * L'appelant est le bénéficiaire (le payeur). Ses points sont mis sous séquestre en
 * amont — bloqués jusqu'à ce que le contrat se termine (versés au prestataire) ou soit
 * rejeté/supprimé (remboursés). La génération du document Documenso et la persistance
 * du contrat se font APRÈS le blocage ; si l'une ou l'autre échoue, le blocage est annulé.
 *
 * @returns Un handler prenant le DTO de création enrichi du beneficiaryId et d'une
 *   redirectUrl optionnelle, et renvoyant le contrat persisté.
 */
export const createContractUseCase = (
  contractRepository: IContractRepository,
  listingRepository: IListingRepository,
  userRepository: IUserRepository,
  documenso: IDocumensoService,
  transactionRepository: ITransactionRepository,
) => {
  return async (data: CreateContractDto & { beneficiaryId: string; redirectUrl?: string }): Promise<Contract> => {
    // Charge l'annonce référencée et applique les invariants de réservation ici (pas
    // dans le router) pour qu'ils soient couverts par ces tests aux côtés des règles
    // d'argent. districtId et price sont dérivés côté serveur depuis l'annonce, jamais
    // du client — le montant mis sous séquestre correspond toujours au prix affiché.
    const listing = await listingRepository.getListingById(data.listingId);
    if (!listing) throw new ListingNotFoundError();
    if (listing.status !== "active") throw new ListingNotActiveError();
    // Un contrat lie deux personnes distinctes.
    if (data.beneficiaryId === data.providerId) throw new SamePartyError();
    // Les annonces sont des offres : l'auteur est le prestataire réservé, l'appelant est
    // le bénéficiaire. On se prémunit d'un providerId incohérent dans le corps de requête.
    if (listing.authorId !== data.providerId) throw new NotListingProviderError();

    const { districtId, price } = listing;

    const [provider, beneficiary] = await Promise.all([
      userRepository.getUserById(data.providerId),
      userRepository.getUserById(data.beneficiaryId),
    ]);
    if (!provider) throw new ContractPartyNotFoundError("Provider not found");
    if (!beneficiary) throw new ContractPartyNotFoundError("Beneficiary not found");

    // Rejette un double-envoi accidentel avant de toucher à l'argent — un second contrat
    // identique remettrait le prix sous séquestre pour la même réservation.
    const existing = await contractRepository.findActiveContract({
      listingId: data.listingId,
      providerId: data.providerId,
      beneficiaryId: data.beneficiaryId,
    });
    if (existing) throw new DuplicateContractError();

    // Met le prix sous séquestre côté bénéficiaire avant tout travail externe.
    if (price > 0) {
      const held = await transactionRepository.tryDebit(data.beneficiaryId, price);
      if (!held) throw new InsufficientFundsError();
    }

    // Tout ce qui va du blocage jusqu'à un contrat persisté doit annuler le blocage en
    // cas d'échec (rien de durable n'existe encore). Une fois la ligne de contrat créée,
    // le blocage est correctement capté : un raté ultérieur du journal (ledger) ne doit
    // donc PAS rembourser un contrat vivant.
    let contract: Contract;
    try {
      const document = await documenso.generateContractDocument({
        title: `Contrat — annonce ${data.listingId}`,
        provider: { email: provider.email, name: `${provider.firstName} ${provider.lastName}` },
        beneficiary: { email: beneficiary.email, name: `${beneficiary.firstName} ${beneficiary.lastName}` },
        redirectUrl: data.redirectUrl,
      });

      contract = await contractRepository.createContract({
        listingId: data.listingId,
        districtId,
        providerId: data.providerId,
        beneficiaryId: data.beneficiaryId,
        price,
        documensoDocumentId: document.documentId,
        signatureStatus: "pending",
        providerSigningUrl: document.providerSigningUrl,
        beneficiarySigningUrl: document.beneficiarySigningUrl,
        disputed: false,
        disputeReason: null,
      });
    } catch (err) {
      // Annule le blocage du séquestre — aucun contrat n'a été persisté. En best-effort
      // pour qu'un remboursement raté ne masque pas l'erreur d'origine (la plus utile à
      // remonter).
      if (price > 0) {
        await transactionRepository
          .adjustBalance(data.beneficiaryId, price)
          .catch((refundErr) =>
            logger.error(
              { err: refundErr, beneficiaryId: data.beneficiaryId },
              "escrow rollback failed for beneficiary",
            ),
          );
      }
      // Une création concurrente identique a gagné la course sur l'index unique (les deux
      // ont passé le contrôle findActiveContract ci-dessus) — on la remonte en 409, pas en 500.
      if (isDuplicateKeyError(err)) throw new DuplicateContractError();
      throw err;
    }

    // Enregistre l'écriture de journal (ledger) du blocage de séquestre maintenant que le
    // contrat existe pour la référencer. L'argent est déjà correctement bloqué et le
    // contrat est vivant : un échec d'écriture ici ne doit rien annuler — on le journalise
    // pour rapprochement (réconciliation) ultérieur.
    if (price > 0) {
      await transactionRepository
        .createTransactions([
          {
            userId: data.beneficiaryId,
            districtId,
            type: "transfer_out",
            // Signe = effet sur le solde propre de cette ligne : un blocage de séquestre
            // débite le payeur, le montant est donc négatif (cohérent avec le transfer_out
            // de create-transaction).
            amount: -price,
            refId: contract.id,
            refType: "contract",
          },
        ])
        .catch((err) => logger.error({ err, contractId: contract.id }, "escrow-hold ledger write failed"));
    }
    return contract;
  };
};
