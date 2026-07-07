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

// Transfers the contract price from beneficiary to provider and records both legs.
// Called exactly once per contract (the atomic completeContract gate upstream).
const settleContractPayment = async (
  transactionRepository: ITransactionRepository,
  contract: Contract,
): Promise<void> => {
  if (contract.price <= 0) return; // free contract — nothing to settle.

  // Atomic, insufficient-funds-safe debit of the beneficiary.
  const debited = await transactionRepository.tryDebit(contract.beneficiaryId, contract.price);
  if (!debited) {
    // The document is signed but the beneficiary can't cover it. Surface loudly;
    // a fuller design would escrow the funds at contract creation.
    console.error(
      `Contract ${contract.id} completed but beneficiary ${contract.beneficiaryId} has insufficient balance for ${contract.price}`,
    );
    return;
  }
  await transactionRepository.adjustBalance(contract.providerId, contract.price);
  await transactionRepository.createTransactions([
    {
      userId: contract.beneficiaryId,
      districtId: contract.districtId,
      type: "transfer_out",
      amount: contract.price,
      refId: contract.id,
      refType: "contract",
    },
    {
      userId: contract.providerId,
      districtId: contract.districtId,
      type: "transfer_in",
      amount: contract.price,
      refId: contract.id,
      refType: "contract",
    },
  ]);
};

// Maps an inbound Documenso event to a contract status update. Idempotent: safe to
// receive the same event twice. Returns null when the event can't be matched to a
// contract (unknown document id) so the handler can still 200 the webhook.
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
      // Atomically transition (once); the winner settles the payment.
      const completed = await contractRepository.completeContract(contract.id);
      if (completed) await settleContractPayment(transactionRepository, completed);
      return completed ?? contract;
    }

    if (signatureStatus === "rejected") {
      // A declined signature also raises the dispute flag for the district admins.
      return contractRepository.updateContract(contract.id, { signatureStatus, disputed: true });
    }

    return contractRepository.updateContract(contract.id, { signatureStatus });
  };
};
