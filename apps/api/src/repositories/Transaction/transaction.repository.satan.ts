import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "./transaction.repository.js";
import { eq, paginate, where } from "../satan.helpers.js";

/** SATAN QL for the projected balance read, the pseudonymise `updateMany` and
 *  the paginated ledger list (COUNT + FIND, newest first); Mongo for the bulk
 *  inserts and the atomic guarded balance ops (which run inside multi-document
 *  transactions). */
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

  getTransactions(params: Parameters<ITransactionRepository["getTransactions"]>[0]) {
    const { userId, districtId, type, refType, page = 1, limit = 20 } = params;
    const clause = where([
      userId && eq("userId", userId),
      districtId && eq("districtId", districtId),
      type && eq("type", type),
      refType && eq("refType", refType),
    ]);
    return paginate<Transaction>(this.satan, "transactions", clause, { page, limit, sort: "createdAt DESC" });
  }

  // --- delegated to Mongo (transactional / bulk writes) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
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
