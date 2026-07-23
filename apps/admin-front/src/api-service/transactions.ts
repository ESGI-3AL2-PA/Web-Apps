// Couche api-service : wrappers axios autour des transactions de points (attribution, solde, historique).
import type { CreateTransactionDto, TransactionResponseDto, UserBalanceResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** GET /transactions — liste paginée des transactions de points. */
export async function listTransactions(params: ListParams): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.get<Paginated<TransactionResponseDto>>("/transactions", { params });
  return res.data;
}

/**
 * POST /transactions — crée une (ou plusieurs) transaction(s) de points.
 * Renvoie une liste paginée car un crédit de masse (ex. tout un quartier) produit plusieurs transactions.
 */
export async function createTransaction(body: CreateTransactionDto): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.post<Paginated<TransactionResponseDto>>("/transactions", body);
  return res.data;
}

/** GET /users/:id/balance — solde de points courant d'un utilisateur. */
export async function getUserBalance(id: string): Promise<UserBalanceResponseDto> {
  const res = await api.get<UserBalanceResponseDto>(`/users/${id}/balance`);
  return res.data;
}

/** GET /users/:id/transactions — historique paginé des transactions d'un utilisateur. */
export async function getUserTransactions(id: string, params: ListParams): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.get<Paginated<TransactionResponseDto>>(`/users/${id}/transactions`, { params });
  return res.data;
}
