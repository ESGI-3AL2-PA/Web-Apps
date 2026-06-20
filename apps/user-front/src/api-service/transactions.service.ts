import type {
  PaginatedResponseDto,
  TransactionQueryDto,
  TransactionResponseDtoSchema,
  UserBalanceResponseDto,
} from "@repo/contracts";

type PaginatedTransactions = PaginatedResponseDto<typeof TransactionResponseDtoSchema>;

export async function getUserTransactions(
  _userId: string,
  _filters: TransactionQueryDto = {} as TransactionQueryDto,
): Promise<PaginatedTransactions> {
  throw new Error("Not implemented");
}

export async function getUserBalance(_userId: string): Promise<UserBalanceResponseDto> {
  throw new Error("Not implemented");
}
