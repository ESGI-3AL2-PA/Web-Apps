import type { Transaction } from "../../entities/transaction.entity.js";

export interface ITransactionRepository {
  ensureIndexes(): Promise<void>;

  getTransactions(params: {
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
  }>;

  createTransactions(entries: Omit<Transaction, "id" | "createdAt">[]): Promise<Transaction[]>;

  adjustBalance(userId: string, delta: number): Promise<number | null>;

  // Atomically debit `amount` only if the balance covers it. Returns true on
  // success, false if the user is missing or has insufficient funds. Closes the
  // check-then-write race a getBalance + adjustBalance pair would leave open.
  tryDebit(userId: string, amount: number): Promise<boolean>;

  getBalance(userId: string): Promise<number | null>;
}
