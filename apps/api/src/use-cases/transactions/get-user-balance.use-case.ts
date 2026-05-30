import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

export const getUserBalanceUseCase = (transactionRepository: ITransactionRepository) => {
  return async (userId: string): Promise<number | null> => {
    return await transactionRepository.getBalance(userId);
  };
};
