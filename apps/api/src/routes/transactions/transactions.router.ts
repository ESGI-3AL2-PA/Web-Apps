import { initServer } from "@ts-rest/express";
import { transactionsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getTransactionsUseCase } from "../../use-cases/transactions/get-transactions.use-case.js";
import { createTransactionUseCase } from "../../use-cases/transactions/create-transaction.use-case.js";
import { getUserBalanceUseCase } from "../../use-cases/transactions/get-user-balance.use-case.js";

const s = initServer();

export const transactionsRouter = s.router(transactionsContract, {
  getTransactions: async ({ query, req }) => {
    // Non-admins may only read their own ledger (userId already scopes it to a single district).
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superAdmin";
    if (!isAdmin) {
      const result = await getTransactionsUseCase(resolve("transaction"))({ ...query, userId: req.user!.sub });
      return { status: 200, body: result };
    }

    const scope = resolveListDistrictScope(req.user!, query.districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page: query.page, limit: query.limit } };
    }
    const result = await getTransactionsUseCase(resolve("transaction"))({ ...query, districtId: scope.districtId });
    return { status: 200, body: result };
  },

  createTransaction: async ({ body, req }) => {
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superAdmin";
    // Non-admins can only move their own tokens (no spoofed source, no system minting).
    const data = isAdmin ? body : { ...body, fromUserId: req.user!.sub };

    const result = await createTransactionUseCase(resolve("transaction"), resolve("user"))(data);
    if (result.kind === "insufficient-funds") {
      return { status: 400, body: { message: "Insufficient balance" } };
    }
    if (result.kind === "sender-not-found") {
      return { status: 400, body: { message: "Sender not found" } };
    }
    if (result.kind === "recipient-not-found") {
      return { status: 400, body: { message: "Recipient not found" } };
    }
    const entries = result.entries;
    return {
      status: 201,
      body: {
        data: entries,
        total: entries.length,
        page: 1,
        limit: entries.length,
      },
    };
  },

  getUserTransactions: async ({ params: { id }, query }) => {
    // Self/admin authorization is enforced by the contract-metadata middleware.
    const result = await getTransactionsUseCase(resolve("transaction"))({ ...query, userId: id });
    return { status: 200, body: result };
  },

  getUserBalance: async ({ params: { id } }) => {
    // Self/admin authorization is enforced by the contract-metadata middleware.
    const balance = await getUserBalanceUseCase(resolve("transaction"))(id);
    if (balance === null) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: { userId: id, balance } };
  },
});
