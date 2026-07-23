import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";

/**
 * Cas d'usage : renvoi des invitations de signature Documenso pour le document d'un
 * contrat. Renvoie `false` quand le contrat n'existe pas ou n'a pas encore de document
 * généré (→ 404), `true` une fois les invitations renvoyées.
 */
export const resendContractUseCase = (contractRepository: IContractRepository, documenso: IDocumensoService) => {
  return async ({ id }: { id: string }): Promise<boolean> => {
    const contract = await contractRepository.getContractById(id);
    if (!contract || contract.documensoDocumentId === null) return false;
    await documenso.resendDocument(contract.documensoDocumentId);
    return true;
  };
};
