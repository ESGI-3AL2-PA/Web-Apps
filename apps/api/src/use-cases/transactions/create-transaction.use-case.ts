import type { CreateTransactionDto } from "@repo/contracts";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

export const createTransactionUseCase = (transactionRepository: ITransactionRepository) => {
  return async (data: CreateTransactionDto): Promise<Transaction[]> => {
    const { fromUserId, toUserId, amount, refId, refType } = data;

    const entries: Omit<Transaction, "id" | "createdAt">[] = [];

    if (fromUserId) {
      entries.push({
        userId: fromUserId,
        type: toUserId ? "transfer_out" : "debit",
        amount: -amount,
        refId,
        refType,
      });
      await transactionRepository.adjustBalance(fromUserId, -amount);
    }

    if (toUserId) {
      entries.push({
        userId: toUserId,
        type: fromUserId ? "transfer_in" : "credit",
        amount,
        refId,
        refType,
      });
      await transactionRepository.adjustBalance(toUserId, amount);
    }

    return await transactionRepository.createTransactions(entries);
  };
};
