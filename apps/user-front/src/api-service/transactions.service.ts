import type {
  PaginatedResponseDto,
  TransactionQueryInput,
  TransactionResponseDtoSchema,
  UserBalanceResponseDto,
} from "@repo/contracts";
import api from "./api";

// Service API du solde et de l'historique de points d'un utilisateur.
type PaginatedTransactions = PaginatedResponseDto<typeof TransactionResponseDtoSchema>;

/** GET /users/:id/balance — solde de points courant (soi-même ou administrateur). */
export async function getUserBalance(userId: string): Promise<UserBalanceResponseDto> {
  const res = await api.get<UserBalanceResponseDto>(`/users/${userId}/balance`);
  return res.data;
}

/** GET /users/:id/transactions — historique paginé des mouvements de points (soi-même ou administrateur). */
export async function getUserTransactions(
  userId: string,
  filters: TransactionQueryInput = {},
): Promise<PaginatedTransactions> {
  const res = await api.get<PaginatedTransactions>(`/users/${userId}/transactions`, { params: filters });
  return res.data;
}
