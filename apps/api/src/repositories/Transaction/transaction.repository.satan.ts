import type { ClientSession } from "mongodb";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { ITransactionRepository } from "./transaction.repository.js";

/** SATAN QL for the projected balance read and the pseudonymise `updateMany`;
 *  Mongo for the ledger list, bulk inserts and the atomic guarded balance ops
 *  (which run inside multi-document transactions). */
export class SatanTransactionRepository implements ITransactionRepository {
  constructor(
    private readonly mongo: ITransactionRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  async getBalance(userId: string): Promise<number | null> {
    const doc = await this.satan.findOne<{ id: string; balance?: number }>(
      `FIND users WHERE _id = ${this.satan.q(userId)} SELECT balance`,
    );
    return doc?.balance ?? null;
  }

  async pseudonymiseUser(userId: string): Promise<void> {
    await this.satan.update(
      `UPDATE transactions SET userId = ${this.satan.q("[deleted]")} WHERE userId = ${this.satan.q(userId)}`,
    );
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getTransactions(params: Parameters<ITransactionRepository["getTransactions"]>[0]) {
    return this.mongo.getTransactions(params);
  }
  createTransactions(
    entries: Omit<Transaction, "id" | "createdAt">[],
    session?: ClientSession,
  ): Promise<Transaction[]> {
    return this.mongo.createTransactions(entries, session);
  }
  adjustBalance(userId: string, delta: number, session?: ClientSession): Promise<number | null> {
    return this.mongo.adjustBalance(userId, delta, session);
  }
  tryDebit(userId: string, amount: number, session?: ClientSession): Promise<boolean> {
    return this.mongo.tryDebit(userId, amount, session);
  }
}
