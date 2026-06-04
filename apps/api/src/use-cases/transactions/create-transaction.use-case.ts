import type { CreateTransactionDto } from "@repo/contracts";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

export type CreateTransactionResult =
  | { kind: "ok"; entries: Transaction[] }
  | { kind: "insufficient-funds" }
  | { kind: "recipient-not-found" };

export const createTransactionUseCase = (transactionRepository: ITransactionRepository) => {
  return async (data: CreateTransactionDto): Promise<CreateTransactionResult> => {
    const { fromUserId, toUserId, amount, refId, refType } = data;

    const entries: Omit<Transaction, "id" | "createdAt">[] = [];

    // Atomically debit the source first; bails out without side effects if the
    // balance doesn't cover it (closes the check-then-write race).
    if (fromUserId) {
      const debited = await transactionRepository.tryDebit(fromUserId, amount);
      if (!debited) return { kind: "insufficient-funds" };
      entries.push({
        userId: fromUserId,
        type: toUserId ? "transfer_out" : "debit",
        amount: -amount,
        refId,
        refType,
      });
    }

    if (toUserId) {
      const credited = await transactionRepository.adjustBalance(toUserId, amount);
      if (credited === null) {
        // Recipient doesn't exist — refund the debit so no tokens are lost.
        if (fromUserId) await transactionRepository.adjustBalance(fromUserId, amount);
        return { kind: "recipient-not-found" };
      }
      entries.push({
        userId: toUserId,
        type: fromUserId ? "transfer_in" : "credit",
        amount,
        refId,
        refType,
      });
    }

    return { kind: "ok", entries: await transactionRepository.createTransactions(entries) };
  };
};
