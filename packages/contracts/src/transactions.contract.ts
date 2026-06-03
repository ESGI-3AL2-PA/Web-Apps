import { initContract } from "@ts-rest/core";

import {
  CreateTransactionDtoSchema,
  TransactionQueryDtoSchema,
  TransactionResponseDtoSchema,
  UserBalanceResponseDtoSchema,
  UserTransactionsParamsDtoSchema,
  NotFoundErrorSchema,
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";

const c = initContract();

export const transactionsContract = c.router({
  getTransactions: {
    method: "GET",
    path: "/transactions",
    query: TransactionQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(TransactionResponseDtoSchema),
    },
    summary: "Get a paginated list of transactions",
  },

  createTransaction: {
    method: "POST",
    path: "/transactions",
    body: CreateTransactionDtoSchema,
    responses: {
      201: PaginatedResponseDtoSchema(TransactionResponseDtoSchema),
      400: BadRequestErrorSchema,
    },
    summary:
      "Create a transaction (transfer between users or system credit/debit). Returns the resulting transaction entries.",
  },

  getUserTransactions: {
    method: "GET",
    path: "/users/:id/transactions",
    pathParams: UserTransactionsParamsDtoSchema,
    query: TransactionQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(TransactionResponseDtoSchema),
      403: ForbiddenErrorSchema,
    },
    summary: "Get a paginated list of transactions for a specific user",
  },

  getUserBalance: {
    method: "GET",
    path: "/users/:id/balance",
    pathParams: UserTransactionsParamsDtoSchema,
    responses: {
      200: UserBalanceResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get the current points balance of a user",
  },
});
