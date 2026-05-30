import type { Transaction } from "../../entities/transaction.entity.js";

export interface ITransactionRepository {
  getTransactions(params: {
    userId?: string;
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

  getBalance(userId: string): Promise<number | null>;
}
