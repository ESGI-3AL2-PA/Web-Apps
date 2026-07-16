import { randomUUID } from "crypto";
import type { ClientSession, Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { Transaction, TransactionRefType, TransactionType } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "./transaction.repository.js";

type TransactionDoc = WithMongoId<Transaction>;
type UserBalanceDoc = { _id: string; balance: number };

export class MongoTransactionRepository implements ITransactionRepository {
  private transactions: Collection<TransactionDoc>;
  private users: Collection<UserBalanceDoc>;

  constructor(db: Db) {
    this.transactions = db.collection("transactions");
    this.users = db.collection("users");
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped (admin) list filtering.
    await this.transactions.createIndex({ districtId: 1 });
  }

  async getTransactions(params: {
    userId?: string;
    districtId?: string;
    type?: string;
    refType?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { userId, districtId, type, refType, page = 1, limit = 20 } = params;

    const filter: Filter<TransactionDoc> = {};
    if (userId) filter.userId = userId;
    if (districtId) filter.districtId = districtId;
    if (type) filter.type = type as TransactionType;
    if (refType) filter.refType = refType as TransactionRefType;

    const [total, docs] = await Promise.all([
      this.transactions.countDocuments(filter),
      this.transactions
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map((d) => toEntity<Transaction>(d)), total, page, limit };
  }

  async createTransactions(
    entries: Omit<Transaction, "id" | "createdAt">[],
    session?: ClientSession,
  ): Promise<Transaction[]> {
    const now = new Date().toISOString();
    const docs: TransactionDoc[] = entries.map((e) => ({
      ...e,
      _id: randomUUID(),
      createdAt: now,
    }));
    if (docs.length === 0) return [];
    await this.transactions.insertMany(docs, { session });
    return docs.map((d) => toEntity<Transaction>(d));
  }

  async adjustBalance(userId: string, delta: number, session?: ClientSession): Promise<number | null> {
    const result = await this.users.findOneAndUpdate(
      { _id: userId },
      { $inc: { balance: delta } },
      { returnDocument: "after", session },
    );
    return result ? (result.balance ?? 0) : null;
  }

  async tryDebit(userId: string, amount: number, session?: ClientSession): Promise<boolean> {
    // The {$gte} guard and the {$inc} run as a single atomic document update,
    // so two concurrent debits can't both pass the balance check.
    const result = await this.users.findOneAndUpdate(
      { _id: userId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { session },
    );
    return result !== null;
  }

  async getBalance(userId: string): Promise<number | null> {
    const user = await this.users.findOne({ _id: userId }, { projection: { balance: 1 } });
    if (!user) return null;
    return user.balance ?? 0;
  }

  async pseudonymiseUser(userId: string): Promise<void> {
    // Keep the ledger rows (accounting retention) but sever the identity link.
    await this.transactions.updateMany({ userId }, { $set: { userId: "[deleted]" } });
  }
}
