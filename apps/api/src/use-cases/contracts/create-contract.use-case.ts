import type { CreateContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";

export class ContractPartyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractPartyNotFoundError";
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient balance to escrow the contract price");
    this.name = "InsufficientFundsError";
  }
}

// The caller is the beneficiary (payer). Their tokens are escrowed up front — held
// until the contract completes (released to the provider) or is rejected/deleted
// (refunded). Generating the Documenso document and persisting the contract happen
// after the hold; if either fails the hold is rolled back.
export const createContractUseCase = (
  contractRepository: IContractRepository,
  userRepository: IUserRepository,
  documenso: IDocumensoService,
  transactionRepository: ITransactionRepository,
) => {
  return async (
    data: CreateContractDto & { beneficiaryId: string; districtId: string; redirectUrl?: string },
  ): Promise<Contract> => {
    const [provider, beneficiary] = await Promise.all([
      userRepository.getUserById(data.providerId),
      userRepository.getUserById(data.beneficiaryId),
    ]);
    if (!provider) throw new ContractPartyNotFoundError("Provider not found");
    if (!beneficiary) throw new ContractPartyNotFoundError("Beneficiary not found");

    // Escrow the price from the beneficiary before doing any external work.
    if (data.price > 0) {
      const held = await transactionRepository.tryDebit(data.beneficiaryId, data.price);
      if (!held) throw new InsufficientFundsError();
    }

    try {
      const document = await documenso.generateContractDocument({
        title: `Contrat — annonce ${data.listingId}`,
        provider: { email: provider.email, name: `${provider.firstName} ${provider.lastName}` },
        beneficiary: { email: beneficiary.email, name: `${beneficiary.firstName} ${beneficiary.lastName}` },
        redirectUrl: data.redirectUrl,
      });

      const contract = await contractRepository.createContract({
        listingId: data.listingId,
        districtId: data.districtId,
        providerId: data.providerId,
        beneficiaryId: data.beneficiaryId,
        price: data.price,
        documensoDocumentId: document.documentId,
        signatureStatus: "pending",
        providerSigningUrl: document.providerSigningUrl,
        beneficiarySigningUrl: document.beneficiarySigningUrl,
        disputed: false,
      });

      // Record the escrow hold once the contract exists to reference it.
      if (data.price > 0) {
        await transactionRepository.createTransactions([
          {
            userId: data.beneficiaryId,
            districtId: data.districtId,
            type: "transfer_out",
            amount: data.price,
            refId: contract.id,
            refType: "contract",
          },
        ]);
      }
      return contract;
    } catch (err) {
      // Roll the escrow hold back — the contract was never created.
      if (data.price > 0) await transactionRepository.adjustBalance(data.beneficiaryId, data.price);
      throw err;
    }
  };
};
