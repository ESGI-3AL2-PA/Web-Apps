import type { CreateTransactionDto, TransactionResponseDto, UserBalanceResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listTransactions(params: ListParams): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.get<Paginated<TransactionResponseDto>>("/transactions", { params });
  return res.data;
}

export async function createTransaction(body: CreateTransactionDto): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.post<Paginated<TransactionResponseDto>>("/transactions", body);
  return res.data;
}

export async function getUserBalance(id: string): Promise<UserBalanceResponseDto> {
  const res = await api.get<UserBalanceResponseDto>(`/users/${id}/balance`);
  return res.data;
}

export async function getUserTransactions(id: string, params: ListParams): Promise<Paginated<TransactionResponseDto>> {
  const res = await api.get<Paginated<TransactionResponseDto>>(`/users/${id}/transactions`, { params });
  return res.data;
}
