import type { CreateTransactionDto } from "@repo/contracts";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { runInTransaction } from "../../repositories/tx.js";

export type CreateTransactionResult =
  | { kind: "ok"; entries: Transaction[] }
  | { kind: "insufficient-funds" }
  | { kind: "sender-not-found" }
  | { kind: "recipient-not-found" }
  | { kind: "forbidden" };

// Who is initiating the movement. Authorization (district scoping, mint/burn gating)
// is enforced here rather than in the router so it is covered by unit tests.
export interface TransactionActor {
  sub: string;
  role: string;
  adminDistrictId?: string | null;
}

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
  return async (data: CreateTransactionDto, actor: TransactionActor): Promise<CreateTransactionResult> => {
    const isSuperAdmin = actor.role === "superAdmin";
    const isDistrictAdmin = actor.role === "admin";

    // Non-admins can only move their own tokens: the source is forced to the caller,
    // so a client body can neither spoof another sender nor mint from the system.
    const fromUserId = isSuperAdmin || isDistrictAdmin ? data.fromUserId : actor.sub;
    const { toUserId, amount, refId, refType } = data;

    // Mint (no source) and burn (no destination) create or destroy value; they are
    // superAdmin-only. A district admin must move points between two existing users.
    if (isDistrictAdmin && (!fromUserId || !toUserId || !actor.adminDistrictId)) {
      return { kind: "forbidden" };
    }

    // districtId is server-derived from each entry's own user — a transfer's
    // debit and credit entries can belong to users in different districts.
    const fromUser = fromUserId ? await userRepository.getUserById(fromUserId) : null;
    if (fromUserId && !fromUser) return { kind: "sender-not-found" };

    const toUser = toUserId ? await userRepository.getUserById(toUserId) : null;
    if (toUserId && !toUser) return { kind: "recipient-not-found" };

    // A district admin may only touch users inside their own district — both the
    // debited and credited account must belong to actor.adminDistrictId.
    if (
      isDistrictAdmin &&
      (fromUser!.districtId !== actor.adminDistrictId || toUser!.districtId !== actor.adminDistrictId)
    ) {
      return { kind: "forbidden" };
    }

    // Move balances and write the ledger inside one transaction so a failure after
    // the debit can't leave money moved without matching entries. On a standalone
    // Mongo (no replica set) runInTransaction runs sequentially with session=undefined;
    // there we compensate the debit by hand since there is nothing to roll back.
    try {
      const outcome = await runInTransaction(async (session) => {
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

        return {
          kind: "ok" as const,
          entries: await transactionRepository.createTransactions(entries, session),
        };
      });

      // Audit trail: any admin-initiated balance movement is recorded. No dedicated
      // audit collection exists yet (see PR note) so we emit a structured log line
      // identifying the actor, which the ledger entries alone do not capture.
      if (isSuperAdmin || isDistrictAdmin) {
        console.warn(
          JSON.stringify({
            audit: "transaction.create",
            actorSub: actor.sub,
            actorRole: actor.role,
            fromUserId: fromUserId ?? null,
            toUserId: toUserId ?? null,
            amount,
          }),
        );
      }

      return outcome;
    } catch (err) {
      if (err instanceof TxAbort) return { kind: err.kind };
      throw err;
    }
  };
};
