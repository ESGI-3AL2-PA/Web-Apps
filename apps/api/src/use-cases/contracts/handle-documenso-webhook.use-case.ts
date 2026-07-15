import type { ClientSession } from "mongodb";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { logger } from "../../logger.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { runInTransaction } from "../../repositories/tx.js";
import { mapDocumensoStatus, type DocumensoWebhookEvent } from "../../services/documenso.service.js";

// Credits `amount` to a user and records the ledger entry. Used to release the
// escrow to the provider on completion or refund it to the beneficiary on rejection.
const credit = async (
  transactionRepository: ITransactionRepository,
  contract: Contract,
  userId: string,
  session?: ClientSession,
): Promise<void> => {
  if (contract.price <= 0) return;
  await transactionRepository.adjustBalance(userId, contract.price, session);
  const ledgerWrite = transactionRepository.createTransactions(
    [
      {
        userId,
        districtId: contract.districtId,
        type: "transfer_in",
        amount: contract.price,
        refId: contract.id,
        refType: "contract",
      },
    ],
    session,
  );
  if (session) {
    // Inside a transaction: the status gate + balance move + ledger row commit or roll
    // back together, so a ledger failure can't leave the escrow settled without a record.
    await ledgerWrite;
  } else {
    // Sequential fallback (standalone Mongo, no transactions): the balance move already
    // settled the escrow and the atomic gate fired, so keep the ledger write best-effort
    // — a failure here must not 500 the webhook and cause a re-credit on retry.
    await ledgerWrite.catch((err) =>
      logger.error({ err, contractId: contract.id }, "escrow-settle ledger write failed"),
    );
  }
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
    // Unknown/unhandled event — ignore it (don't touch the contract).
    if (signatureStatus === null) return contract;

    if (signatureStatus === "completed") {
      // Both parties signed — atomically transition and release the escrow to the
      // provider (once). Gate + balance + ledger commit together.
      const completed = await runInTransaction(async (session) => {
        const c = await contractRepository.completeContract(contract.id, session);
        if (c) await credit(transactionRepository, c, c.providerId, session);
        return c;
      });
      return completed ?? contract;
    }

    if (signatureStatus === "rejected") {
      // A party declined — atomically transition and refund the escrow to the
      // beneficiary (once).
      const rejected = await runInTransaction(async (session) => {
        const c = await contractRepository.rejectContract(contract.id, session);
        if (c) await credit(transactionRepository, c, c.beneficiaryId, session);
        return c;
      });
      return rejected ?? contract;
    }

    // Non-terminal transition (pending/draft): apply it atomically only while the
    // contract is still non-terminal, so a late or out-of-order event can't drag a
    // completed/rejected contract back to pending. Already-terminal → no-op.
    const updated = await contractRepository.applyNonTerminalStatus(contract.id, signatureStatus);
    return updated ?? contract;
  };
};
