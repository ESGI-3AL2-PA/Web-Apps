import { initServer } from "@ts-rest/express";
import { transactionsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { getTransactionsUseCase } from "../../use-cases/transactions/get-transactions.use-case.js";
import { createTransactionUseCase } from "../../use-cases/transactions/create-transaction.use-case.js";
import { getUserBalanceUseCase } from "../../use-cases/transactions/get-user-balance.use-case.js";

const s = initServer();

/**
 * Router ts-rest des transactions de points.
 *
 * Couche router. Consultation du grand livre (ledger) et création de transactions
 * (transfert entre users, mint/burn par un admin). La logique d'autorisation lourde
 * vit dans le cas d'usage `createTransaction` pour être couverte par les tests unitaires.
 */
export const transactionsRouter = s.router(transactionsContract, {
  getTransactions: async ({ query, req }) => {
    // Un non-admin ne lit que son propre ledger (userId le scope déjà à un seul quartier).
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
    // L'autorisation (source forcée pour les non-admins, scoping par quartier +
    // contrôle mint/burn pour les admins) vit dans le cas d'usage, donc couverte
    // par les tests unitaires.
    const result = await createTransactionUseCase(resolve("transaction"), resolve("user"))(body, {
      sub: req.user!.sub,
      role: req.user!.role,
      adminDistrictId: req.user!.adminDistrictId ?? null,
    });
    if (result.kind === "forbidden") {
      return { status: 403, body: { message: "Forbidden" } };
    }
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
    // Autorisation self/admin imposée par le middleware contract-metadata.
    const result = await getTransactionsUseCase(resolve("transaction"))({ ...query, userId: id });
    return { status: 200, body: result };
  },

  getUserBalance: async ({ params: { id } }) => {
    // Autorisation self/admin imposée par le middleware contract-metadata.
    const balance = await getUserBalanceUseCase(resolve("transaction"))(id);
    if (balance === null) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: { userId: id, balance } };
  },
});
