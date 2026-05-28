import { initServer } from "@ts-rest/express";
import { transactionsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getTransactionsUseCase } from "../../use-cases/transactions/get-transactions.use-case.js";
import { createTransactionUseCase } from "../../use-cases/transactions/create-transaction.use-case.js";
import { getUserBalanceUseCase } from "../../use-cases/transactions/get-user-balance.use-case.js";

const s = initServer();

export const transactionsRouter = s.router(transactionsContract, {
  getTransactions: async ({ query }) => {
    const result = await getTransactionsUseCase(resolve("transaction"))(query);
    return { status: 200, body: result };
  },

  createTransaction: async ({ body }) => {
    const entries = await createTransactionUseCase(resolve("transaction"))(body);
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
    const result = await getTransactionsUseCase(resolve("transaction"))({ ...query, userId: id });
    return { status: 200, body: result };
  },

  getUserBalance: async ({ params: { id } }) => {
    const balance = await getUserBalanceUseCase(resolve("transaction"))(id);
    if (balance === null) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: { userId: id, balance } };
  },
});
