import type { SignContractDto } from "@repo/contracts";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { embedSignatureIntoPdf } from "../../services/pdf-signer.service.js";

export class InvalidSignatureError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidSignatureError";
  }
}

export const signContractUseCase = (contractRepository: IContractRepository) => {
  return async (contractId: string, userId: string, body: SignContractDto): Promise<Contract | null> => {
    const contract = await contractRepository.getContractById(contractId);
    if (!contract) return null;

    const isProvider = contract.providerId === userId;
    const isBeneficiary = contract.beneficiaryId === userId;
    if (!isProvider && !isBeneficiary) {
      throw new InvalidSignatureError("Seules les parties au contrat peuvent signer");
    }
    const party: "provider" | "beneficiary" = isProvider ? "provider" : "beneficiary";

    if (party === "provider" && contract.providerSignedAt) {
      throw new InvalidSignatureError("Le prestataire a déjà signé ce contrat");
    }
    if (party === "beneficiary" && contract.beneficiarySignedAt) {
      throw new InvalidSignatureError("Le bénéficiaire a déjà signé ce contrat");
    }

    if (!contract.pdfPath) {
      throw new InvalidSignatureError("Aucun PDF disponible pour ce contrat");
    }

    const { signedPdfPath } = await embedSignatureIntoPdf({
      contractId: contract.id,
      originalPath: contract.pdfPath,
      existingSignedPath: contract.signedPdfPath,
      signatureBase64: body.signatureImage,
      party,
    });

    const now = new Date().toISOString();
    const willBeProviderSigned = isProvider || !!contract.providerSignedAt;
    const willBeBeneficiarySigned = isBeneficiary || !!contract.beneficiarySignedAt;
    const newStatus = willBeProviderSigned && willBeBeneficiarySigned ? "signed" : "partially_signed";

    const updates: Partial<Contract> = {
      signedPdfPath,
      openSignStatus: newStatus,
    };
    if (isProvider) updates.providerSignedAt = now;
    if (isBeneficiary) updates.beneficiarySignedAt = now;

    return await contractRepository.updateContract(contract.id, updates);
  };
};
