import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";

// Re-sends the Documenso signing invitations for a contract's document.
// Returns false when the contract doesn't exist or has no generated document yet.
export const resendContractUseCase = (contractRepository: IContractRepository, documenso: IDocumensoService) => {
  return async ({ id }: { id: string }): Promise<boolean> => {
    const contract = await contractRepository.getContractById(id);
    if (!contract || contract.documensoDocumentId === null) return false;
    await documenso.resendDocument(contract.documensoDocumentId);
    return true;
  };
};
