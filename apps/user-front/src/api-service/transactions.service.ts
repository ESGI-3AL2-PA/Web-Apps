import type {
  PaginatedResponseDto,
  TransactionQueryDto,
  TransactionResponseDtoSchema,
  UserBalanceResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedTransactions = PaginatedResponseDto<typeof TransactionResponseDtoSchema>;

// GET /users/:id/balance — current points balance (self or admin).
export async function getUserBalance(userId: string): Promise<UserBalanceResponseDto> {
  const res = await api.get<UserBalanceResponseDto>(`/users/${userId}/balance`);
  return res.data;
}

// GET /users/:id/transactions — points history (self or admin).
export async function getUserTransactions(
  userId: string,
  filters: TransactionQueryDto = {} as TransactionQueryDto,
): Promise<PaginatedTransactions> {
  const res = await api.get<PaginatedTransactions>(`/users/${userId}/transactions`, { params: filters });
  return res.data;
}
