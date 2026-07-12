import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "./transaction.repository.js";

/** SATAN QL for the projected balance read and the pseudonymise `updateMany`;
 *  Mongo for the ledger list, bulk inserts and the atomic guarded balance ops
 *  (which run inside multi-document transactions). */
export class SatanTransactionRepository implements ITransactionRepository {
  constructor(
    private readonly mongo: ITransactionRepository,
    private readonly satan: SatanClient,
  ) {}

  async getBalance(userId: string): Promise<number | null> {
    const rows = (await this.satan.query(`FIND users WHERE _id = ${quote(userId)} SELECT balance`)) as {
      balance?: number;
    }[];
    return rows[0]?.balance ?? null;
  }

  async pseudonymiseUser(userId: string): Promise<void> {
    await this.satan.query(`UPDATE transactions SET userId = ${quote("[deleted]")} WHERE userId = ${quote(userId)}`);
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
