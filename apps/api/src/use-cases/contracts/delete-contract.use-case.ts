import fs from "fs/promises";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";

export const deleteContractUseCase = (contractRepository: IContractRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    const contract = await contractRepository.getContractById(params.id);

    if (contract) {
      const paths = [contract.pdfPath, contract.signedPdfPath].filter((p): p is string => Boolean(p));
      for (const path of paths) {
        try {
          await fs.unlink(path);
        } catch {
          console.warn(`[deleteContract] Impossible de supprimer le fichier ${path}`);
        }
      }
    }

    return await contractRepository.deleteContract(params.id);
  };
};
