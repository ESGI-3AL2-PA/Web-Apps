import { initServer } from "@ts-rest/express";
import { transactionsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getTransactionsUseCase } from "../../use-cases/transactions/get-transactions.use-case.js";
import { createTransactionUseCase } from "../../use-cases/transactions/create-transaction.use-case.js";
import { getUserBalanceUseCase } from "../../use-cases/transactions/get-user-balance.use-case.js";

const s = initServer();

export const transactionsRouter = s.router(transactionsContract, {
  getTransactions: async ({ query, req }) => {
    // Non-admins may only read their own ledger.
    const isAdmin = req.user!.role === "admin";
    const scopedQuery = isAdmin ? query : { ...query, userId: req.user!.sub };
    const result = await getTransactionsUseCase(resolve("transaction"))(scopedQuery);
    return { status: 200, body: result };
  },

  createTransaction: async ({ body, req }) => {
    const isAdmin = req.user!.role === "admin";
    // Non-admins can only move their own tokens (no spoofed source, no system minting).
    const data = isAdmin ? body : { ...body, fromUserId: req.user!.sub };

    const result = await createTransactionUseCase(resolve("transaction"))(data);
    if (result.kind === "insufficient-funds") {
      return { status: 400, body: { message: "Insufficient balance" } };
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

  getUserTransactions: async ({ params: { id }, query, req }) => {
    // Non-admins may only read their own ledger.
    if (req.user!.role !== "admin" && req.user!.sub !== id) {
      return { status: 403, body: { message: "Forbidden" } };
    }
    const result = await getTransactionsUseCase(resolve("transaction"))({ ...query, userId: id });
    return { status: 200, body: result };
  },

  getUserBalance: async ({ params: { id }, req }) => {
    // Non-admins may only read their own balance.
    if (req.user!.role !== "admin" && req.user!.sub !== id) {
      return { status: 403, body: { message: "Forbidden" } };
    }
    const balance = await getUserBalanceUseCase(resolve("transaction"))(id);
    if (balance === null) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: { userId: id, balance } };
  },
});
