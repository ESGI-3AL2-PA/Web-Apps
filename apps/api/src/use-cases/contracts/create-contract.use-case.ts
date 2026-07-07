import type { CreateContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";

export class ContractPartyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractPartyNotFoundError";
  }
}

// Generates the signable Documenso document first, then persists the contract with
// the returned document id and per-party signing URLs. If Documenso fails the
// contract is not created — we never persist a contract without a signable document.
export const createContractUseCase = (
  contractRepository: IContractRepository,
  userRepository: IUserRepository,
  documenso: IDocumensoService,
) => {
  return async (
    data: CreateContractDto & { providerId: string; districtId: string; redirectUrl?: string },
  ): Promise<Contract> => {
    const [provider, beneficiary] = await Promise.all([
      userRepository.getUserById(data.providerId),
      userRepository.getUserById(data.beneficiaryId),
    ]);
    if (!provider) throw new ContractPartyNotFoundError("Provider not found");
    if (!beneficiary) throw new ContractPartyNotFoundError("Beneficiary not found");

    const document = await documenso.generateContractDocument({
      title: `Contrat — annonce ${data.listingId}`,
      provider: { email: provider.email, name: `${provider.firstName} ${provider.lastName}` },
      beneficiary: { email: beneficiary.email, name: `${beneficiary.firstName} ${beneficiary.lastName}` },
      redirectUrl: data.redirectUrl,
    });

    return await contractRepository.createContract({
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
  };
};
