import type {
  PaginatedResponseDto,
  TransactionQueryDto,
  TransactionResponseDtoSchema,
  UserBalanceResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedTransactions = PaginatedResponseDto<typeof TransactionResponseDtoSchema>;

// Consigne ADMIN — TRANSACTIONS:
//   - Read all (audit et statistiques)
// (Pas de createTransaction côté admin-front — c'est le backend qui crédite/débite
//  automatiquement lors d'actions métier. Si un transfert manuel d'admin est
//  voulu un jour, l'endpoint POST /transactions existe.)

// GET /transactions — full audit, filtres: userId, type, refType, page, limit
export async function getTransactions(
  filters: TransactionQueryDto = {} as TransactionQueryDto,
): Promise<PaginatedTransactions> {
  try {
    const res = await api.get<PaginatedTransactions>("/transactions", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all transactions");
  }
}

// GET /users/:id/transactions — l'historique d'un utilisateur spécifique
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
    throw new Error("Erreur lors du chargement des transactions de l'utilisateur");
  }
}

// GET /users/:id/balance — solde courant en points
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
