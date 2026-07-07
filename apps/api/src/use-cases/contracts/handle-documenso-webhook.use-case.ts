import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { mapDocumensoStatus } from "../../services/documenso.service.js";

// Shape of the Documenso webhook body we consume. Documenso sends the full
// document in `payload`; we only need its id and status.
export interface DocumensoWebhookEvent {
  event: string;
  payload?: { id?: number; status?: string };
}

// Maps an inbound Documenso event to a contract status update. Idempotent: safe to
// receive the same event twice. Returns null when the event can't be matched to a
// contract (unknown document id) so the handler can still 200 the webhook.
export const handleDocumensoWebhookUseCase = (contractRepository: IContractRepository) => {
  return async (event: DocumensoWebhookEvent): Promise<Contract | null> => {
    const documentId = event.payload?.id;
    if (typeof documentId !== "number") return null;

    const contract = await contractRepository.getContractByDocumensoDocumentId(documentId);
    if (!contract) return null;

    const signatureStatus = mapDocumensoStatus(event.payload?.status);
    const updates: Partial<Omit<Contract, "id" | "createdAt">> = { signatureStatus };
    // A declined signature also raises the dispute flag for the district admins.
    if (signatureStatus === "rejected") updates.disputed = true;
    // Once fully signed, the per-party signing URLs are no longer actionable.
    if (signatureStatus === "completed") {
      updates.providerSigningUrl = null;
      updates.beneficiarySigningUrl = null;
    }

    return await contractRepository.updateContract(contract.id, updates);
  };
};
