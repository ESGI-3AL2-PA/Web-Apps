import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { mapDocumensoStatus } from "../../services/documenso.service.js";

// Shape of the Documenso webhook body we consume. Documenso sends the full
// document in `payload`; we only need its id and status.
export interface DocumensoWebhookEvent {
  event: string;
  payload?: { id?: number; status?: string };
}

// Credits `amount` to a user and records the ledger entry. Used to release the
// escrow to the provider on completion or refund it to the beneficiary on rejection.
const credit = async (
  transactionRepository: ITransactionRepository,
  contract: Contract,
  userId: string,
): Promise<void> => {
  if (contract.price <= 0) return;
  await transactionRepository.adjustBalance(userId, contract.price);
  await transactionRepository.createTransactions([
    {
      userId,
      districtId: contract.districtId,
      type: "transfer_in",
      amount: contract.price,
      refId: contract.id,
      refType: "contract",
    },
  ]);
};

// Maps an inbound Documenso event to a contract status transition. Idempotent: the
// atomic complete/reject gates ensure the escrow is released or refunded at most
// once even if the same event is delivered twice. Returns null when the event can't
// be matched to a contract so the handler can still 200 the webhook.
export const handleDocumensoWebhookUseCase = (
  contractRepository: IContractRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (event: DocumensoWebhookEvent): Promise<Contract | null> => {
    const documentId = event.payload?.id;
    if (typeof documentId !== "number") return null;

    const contract = await contractRepository.getContractByDocumensoDocumentId(documentId);
    if (!contract) return null;

    const signatureStatus = mapDocumensoStatus(event.payload?.status);

    if (signatureStatus === "completed") {
      // Both parties signed — release the escrow to the provider (once).
      const completed = await contractRepository.completeContract(contract.id);
      if (completed) await credit(transactionRepository, completed, completed.providerId);
      return completed ?? contract;
    }

    if (signatureStatus === "rejected") {
      // A party declined — refund the escrow to the beneficiary (once) and flag it.
      const rejected = await contractRepository.rejectContract(contract.id);
      if (rejected) await credit(transactionRepository, rejected, rejected.beneficiaryId);
      return rejected ?? contract;
    }

    return contractRepository.updateContract(contract.id, { signatureStatus });
  };
};
