import type { CreateContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import { generateContractPdf } from "../../services/pdf-generator.service.js";

export class InvalidContractCreationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidContractCreationError";
  }
}

export const createContractUseCase = (
  contractRepository: IContractRepository,
  userRepository: IUserRepository,
  listingRepository: IListingRepository,
) => {
  return async (data: CreateContractDto & { beneficiaryId: string }): Promise<Contract> => {
    const listing = await listingRepository.getListingById(data.listingId);
    if (!listing) {
      throw new InvalidContractCreationError("Annonce introuvable");
    }
    const providerId = listing.authorId;
    if (providerId === data.beneficiaryId) {
      throw new InvalidContractCreationError("Vous ne pouvez pas prendre votre propre annonce");
    }

    const existing = await contractRepository.findByListingsAndBeneficiary([data.listingId], data.beneficiaryId);
    if (existing.length > 0) {
      throw new InvalidContractCreationError("Vous avez déjà pris ce service");
    }

    const [provider, beneficiary] = await Promise.all([
      userRepository.getUserById(providerId),
      userRepository.getUserById(data.beneficiaryId),
    ]);
    if (!provider || !beneficiary) {
      throw new InvalidContractCreationError("Provider ou bénéficiaire introuvable");
    }

    const created = await contractRepository.createContract({
      listingId: data.listingId,
      providerId,
      beneficiaryId: data.beneficiaryId,
      price: data.price,
      openSignDocumentId: "",
      openSignStatus: "draft",
      disputed: false,
    });

    const { pdfPath } = await generateContractPdf({
      contract: created,
      provider,
      beneficiary,
      listing,
    });

    const updated = await contractRepository.updateContract(created.id, {
      pdfPath,
      openSignStatus: "sent",
    });

    return updated ?? created;
  };
};
