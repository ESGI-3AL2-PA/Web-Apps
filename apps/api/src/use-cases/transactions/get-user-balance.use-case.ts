// Cas d'usage : lecture du solde de points d'un utilisateur. Pass-through vers le repository.

import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";

/** Factory du cas d'usage : renvoie le solde de l'utilisateur, ou `null` s'il est introuvable. */
export const getUserBalanceUseCase = (transactionRepository: ITransactionRepository) => {
  return async (userId: string): Promise<number | null> => {
    return await transactionRepository.getBalance(userId);
  };
};
