import type { CreateTransactionDto } from "@repo/contracts";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { runInTransaction } from "../../repositories/tx.js";

export type CreateTransactionResult =
  | { kind: "ok"; entries: Transaction[] }
  | { kind: "insufficient-funds" }
  | { kind: "sender-not-found" }
  | { kind: "recipient-not-found" };

// Thrown inside the transaction to abort it (rolling back the debit) while still
// surfacing a typed result to the caller rather than a raw error.
type AbortKind = "insufficient-funds" | "recipient-not-found";
class TxAbort extends Error {
  constructor(readonly kind: AbortKind) {
    super(kind);
  }
}

export const createTransactionUseCase = (
  transactionRepository: ITransactionRepository,
  userRepository: IUserRepository,
) => {
  return async (data: CreateTransactionDto): Promise<CreateTransactionResult> => {
    const { fromUserId, toUserId, amount, refId, refType } = data;

    // districtId is server-derived from each entry's own user — a transfer's
    // debit and credit entries can belong to users in different districts.
    const fromUser = fromUserId ? await userRepository.getUserById(fromUserId) : null;
    if (fromUserId && !fromUser) return { kind: "sender-not-found" };

    const toUser = toUserId ? await userRepository.getUserById(toUserId) : null;
    if (toUserId && !toUser) return { kind: "recipient-not-found" };

    // Move balances and write the ledger inside one transaction so a failure after
    // the debit can't leave money moved without matching entries. On a standalone
    // Mongo (no replica set) runInTransaction runs sequentially with session=undefined;
    // there we compensate the debit by hand since there is nothing to roll back.
    try {
      return await runInTransaction(async (session) => {
        const entries: Omit<Transaction, "id" | "createdAt">[] = [];

        // Atomically debit the source first; bails out without side effects if the
        // balance doesn't cover it (closes the check-then-write race).
        if (fromUserId) {
          const debited = await transactionRepository.tryDebit(fromUserId, amount, session);
          if (!debited) throw new TxAbort("insufficient-funds");
          entries.push({
            userId: fromUserId,
            districtId: fromUser!.districtId,
            type: toUserId ? "transfer_out" : "debit",
            amount: -amount,
            refId,
            refType,
          });
        }

        if (toUserId) {
          const credited = await transactionRepository.adjustBalance(toUserId, amount, session);
          if (credited === null) {
            // Recipient vanished after the pre-check — roll back (or, on standalone
            // Mongo where there is no session, refund the debit by hand).
            if (fromUserId && !session) await transactionRepository.adjustBalance(fromUserId, amount);
            throw new TxAbort("recipient-not-found");
          }
          entries.push({
            userId: toUserId,
            districtId: toUser!.districtId,
            type: fromUserId ? "transfer_in" : "credit",
            amount,
            refId,
            refType,
          });
        }

        return { kind: "ok", entries: await transactionRepository.createTransactions(entries, session) };
      });
    } catch (err) {
      if (err instanceof TxAbort) return { kind: err.kind };
      throw err;
    }
  };
};
