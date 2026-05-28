import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

export const getTransactionsUseCase = (transactionRepository: ITransactionRepository) => {
  return async (params: {
    userId?: string;
    type?: string;
    refType?: string;
    page?: number;
    limit?: number;
  }) => {
    return await transactionRepository.getTransactions(params);
  };
};
