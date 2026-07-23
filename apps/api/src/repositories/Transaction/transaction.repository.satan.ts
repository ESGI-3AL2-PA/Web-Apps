import { quote, type SatanClient } from "@repo/satan";
import type { ClientSession } from "mongodb";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "./transaction.repository.js";
import { eq, paginate, where } from "../satan.helpers.js";

/**
 * Implémentation SATAN QL du repository des transactions (couche repository).
 *
 * Enveloppe l'implémentation Mongo : SATAN QL sert la lecture projetée du solde,
 * l'`updateMany` de pseudonymisation et la liste paginée du registre (COUNT +
 * FIND, du plus récent au plus ancien) ; Mongo garde les insertions en masse et
 * les opérations de solde atomiques et gardées (qui tournent dans des
 * transactions multi-documents, hors de portée de SATAN QL).
 */
export class SatanTransactionRepository implements ITransactionRepository {
  constructor(
    private readonly mongo: ITransactionRepository,
    private readonly satan: SatanClient,
  ) {}

  // Lit uniquement le champ `balance` de l'utilisateur (projection SELECT), null si absent.
  async getBalance(userId: string): Promise<number | null> {
    const rows = (await this.satan.query(`FIND users WHERE _id = ${quote(userId)} SELECT balance`)) as {
      balance?: number;
    }[];
    return rows[0]?.balance ?? null;
  }

  // Remplace l'userId par un marqueur « [deleted] » sur toutes les lignes de l'utilisateur (pseudonymisation en masse).
  async pseudonymiseUser(userId: string): Promise<void> {
    await this.satan.query(`UPDATE transactions SET userId = ${quote("[deleted]")} WHERE userId = ${quote(userId)}`);
  }

  // Construit la clause WHERE à partir des filtres fournis, puis délègue au helper
  // de pagination (tri par date décroissante).
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

  // --- délégué à Mongo (écritures transactionnelles / en masse) ---
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
