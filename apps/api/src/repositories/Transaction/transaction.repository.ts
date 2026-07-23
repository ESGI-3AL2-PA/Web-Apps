import type { ClientSession } from "mongodb";
import type { Transaction } from "../../entities/transaction.entity.js";

/**
 * Contrat du repository des transactions (le registre / grand livre des points).
 *
 * Couche repository : définit l'interface commune que les implémentations Mongo
 * et SATAN respectent. Elle expose la lecture paginée du registre, les écritures
 * en masse et les opérations atomiques sur le solde (crédit/débit) — ces
 * dernières acceptent une `ClientSession` optionnelle pour s'inscrire dans une
 * transaction multi-documents.
 */
export interface ITransactionRepository {
  ensureIndexes(): Promise<void>;

  // Liste paginée du registre, filtrable par utilisateur / quartier / type / type de référence.
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

  // Insère en masse des lignes de registre (crédits/débits déjà calculés).
  createTransactions(entries: Omit<Transaction, "id" | "createdAt">[], session?: ClientSession): Promise<Transaction[]>;

  // Ajuste le solde d'un utilisateur de `delta` (signé) ; renvoie le nouveau solde, ou null si l'utilisateur est absent.
  adjustBalance(userId: string, delta: number, session?: ClientSession): Promise<number | null>;

  // Débite `amount` de façon atomique uniquement si le solde le couvre. Renvoie true
  // en cas de succès, false si l'utilisateur est absent ou n'a pas les fonds suffisants.
  // Ferme la fenêtre de course « vérifier puis écrire » qu'un couple getBalance + adjustBalance laisserait ouverte.
  tryDebit(userId: string, amount: number, session?: ClientSession): Promise<boolean>;

  getBalance(userId: string): Promise<number | null>;

  /** Coupe le lien d'identité sur les lignes de registre d'un utilisateur supprimé,
   *  tout en conservant l'écriture financière (exception de conservation comptable, art. 17(3) du RGPD). */
  pseudonymiseUser(userId: string): Promise<void>;
}
