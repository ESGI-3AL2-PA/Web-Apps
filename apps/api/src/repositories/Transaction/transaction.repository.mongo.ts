/**
 * Repository (implémentation Mongo) du grand livre de points.
 *
 * Tient deux collections : `transactions` (lignes du grand livre, immuables) et le
 * champ `balance` des `users`. Expose le listage paginé/filtré des transactions et
 * les mutations de solde (crédit/débit atomique) qui peuvent participer à une
 * transaction Mongo via une `ClientSession` optionnelle.
 */
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
    // Soutient le filtrage du listage par quartier (côté admin).
    await this.transactions.createIndex({ districtId: 1 });
  }

  /** Listage paginé des transactions (plus récentes d'abord), filtrable par utilisateur, quartier, type et refType. */
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

  /** Insère un lot de lignes de grand livre (horodatées au même instant), éventuellement dans une session. */
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

  /** Applique un delta (positif ou négatif) au solde et renvoie le nouveau solde, ou null si l'utilisateur est absent. */
  async adjustBalance(userId: string, delta: number, session?: ClientSession): Promise<number | null> {
    const result = await this.users.findOneAndUpdate(
      { _id: userId },
      { $inc: { balance: delta } },
      { returnDocument: "after", session },
    );
    return result ? (result.balance ?? 0) : null;
  }

  /** Débit conditionnel atomique : ne débite que si le solde couvre le montant. Renvoie false sinon. */
  async tryDebit(userId: string, amount: number, session?: ClientSession): Promise<boolean> {
    // La garde {$gte} et le {$inc} s'exécutent comme une seule mise à jour atomique du
    // document, donc deux débits concurrents ne peuvent pas passer tous deux le contrôle de solde.
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

  /** Pseudonymisation RGPD : conserve les écritures mais rompt le lien avec l'identité. */
  async pseudonymiseUser(userId: string): Promise<void> {
    // Garde les lignes du grand livre (rétention comptable) mais coupe le lien d'identité.
    await this.transactions.updateMany({ userId }, { $set: { userId: "[deleted]" } });
  }
}
