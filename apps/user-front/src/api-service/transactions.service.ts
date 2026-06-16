import type {
  CreateTransactionDto,
  PaginatedResponseDto,
  TransactionQueryDto,
  TransactionResponseDto,
  TransactionResponseDtoSchema,
  UserBalanceResponseDto,
} from "@repo/contracts";

type PaginatedTransactions = PaginatedResponseDto<typeof TransactionResponseDtoSchema>;

export async function getTransactions(
  _filters: TransactionQueryDto = {} as TransactionQueryDto,
): Promise<PaginatedTransactions> {
  throw new Error("Not implemented");
}

// `POST /transactions` returns the resulting entries as a paginated payload
// (1 entry for credit/debit, 2 entries for transfer in/out).
export async function createTransaction(
  _data: CreateTransactionDto,
): Promise<PaginatedTransactions> {
  throw new Error("Not implemented");
}

export async function getUserTransactions(
  _userId: string,
  _filters: TransactionQueryDto = {} as TransactionQueryDto,
): Promise<PaginatedTransactions> {
  throw new Error("Not implemented");
}

export async function getUserBalance(_userId: string): Promise<UserBalanceResponseDto> {
  throw new Error("Not implemented");
}
