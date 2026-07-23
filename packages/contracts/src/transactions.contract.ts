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

/**
 * Contract ts-rest des transactions de points.
 *
 * Une transaction est soit un transfert entre utilisateurs, soit un
 * crédit/débit système. La création exige une revérification step-up TOTP
 * systématique (`stepUp: { always: true }`). Les relevés par utilisateur (liste
 * et solde) sont accessibles à l'intéressé, à l'admin de son quartier ou au
 * superAdmin.
 */
export const transactionsContract = c.router({
  // GET /transactions — liste paginée des transactions. Tout utilisateur authentifié.
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

  // POST /transactions — crée une transaction (transfert entre utilisateurs ou crédit/débit système).
  // Renvoie les écritures de transaction résultantes. Step-up TOTP systématique.
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
    // GET /users/:id/transactions — relevé paginé d'un utilisateur. Lui-même, admin de son quartier, ou superAdmin.
    // ownerField:"id" (soi-même) + districtField (un admin peut voir un utilisateur DE son quartier)
    // + bypass superAdmin. On n'utilise pas selfParam, qui court-circuite en 403 avant le contrôle
    // de quartier et exclurait les admins.
    metadata: auth({
      audience: "api",
      scope: { resource: "user", ownerField: "id", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },

  // GET /users/:id/balance — solde de points courant d'un utilisateur. Lui-même, admin de son quartier, ou superAdmin.
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
