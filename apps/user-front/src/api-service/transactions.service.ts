import type {
  PaginatedResponseDto,
  TransactionQueryDto,
  TransactionResponseDtoSchema,
  UserBalanceResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedTransactions = PaginatedResponseDto<typeof TransactionResponseDtoSchema>;

// GET /users/:id/transactions — historique de l'utilisateur (self or admin)
export async function getUserTransactions(
  userId: string,
  filters: TransactionQueryDto = {} as TransactionQueryDto,
): Promise<PaginatedTransactions> {
  try {
    const res = await api.get<PaginatedTransactions>(`/users/${userId}/transactions`, {
      params: filters,
    });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du chargement des transactions");
  }
}

// GET /users/:id/balance — solde courant en points (self or admin)
export async function getUserBalance(userId: string): Promise<UserBalanceResponseDto> {
  try {
    const res = await api.get<UserBalanceResponseDto>(`/users/${userId}/balance`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du chargement du solde");
  }
}
