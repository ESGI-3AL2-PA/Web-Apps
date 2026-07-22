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
import { auth } from "./auth-meta";

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
    metadata: auth({ audience: "api" }),
  },

  createTransaction: {
    method: "POST",
    path: "/transactions",
    body: CreateTransactionDtoSchema,
    responses: {
      201: PaginatedResponseDtoSchema(TransactionResponseDtoSchema),
      400: BadRequestErrorSchema,
      403: ForbiddenErrorSchema,
    },
    summary:
      "Create a transaction (transfer between users or system credit/debit). Returns the resulting transaction entries.",
    metadata: auth({ audience: "api", stepUp: { always: true } }),
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
    summary: "Get a paginated list of transactions for a specific user (self, district admin, or superAdmin)",
    // ownerField:"id" (self) + districtField (a district admin may view a user IN their
    // district) + superAdmin bypass. Not selfParam, which short-circuits to 403 before the
    // district check and would exclude admins.
    metadata: auth({
      audience: "api",
      scope: { resource: "user", ownerField: "id", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
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
    summary: "Get the current points balance of a user (self, district admin, or superAdmin)",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", ownerField: "id", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },
});
