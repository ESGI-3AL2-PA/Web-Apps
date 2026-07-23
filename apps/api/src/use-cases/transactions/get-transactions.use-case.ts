// Cas d'usage : liste paginée et filtrée des transactions du ledger. Pass-through.

import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

/**
 * Factory du cas d'usage de listing des transactions.
 * Filtres optionnels : `userId`, `districtId`, `type` (credit/debit/transfer_*),
 * `refType` (nature de la référence liée) et pagination `page` / `limit`.
 */
export const getTransactionsUseCase = (transactionRepository: ITransactionRepository) => {
  return async (params: {
    userId?: string;
    districtId?: string;
    type?: string;
    refType?: string;
    page?: number;
    limit?: number;
  }) => {
    return await transactionRepository.getTransactions(params);
  };
};
