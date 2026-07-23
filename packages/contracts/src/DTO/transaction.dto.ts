// DTO (couche contracts) : schémas zod du registre de points (transactions).
// Chaque mouvement de points est une ligne immuable ; le solde d'un utilisateur en
// est la somme. Couvre le sens du mouvement, la ressource référencée, la création
// (crédit/débit/transfert) et les vues solde + historique.
import { z } from "../zod";

/** Sens du mouvement de points : crédit/débit simple, ou les deux jambes d'un transfert (entrée/sortie). */
export const TransactionTypeSchema = z.enum(["credit", "debit", "transfer_in", "transfer_out"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

/** Nature de la ressource à l'origine du mouvement (contrat, annonce, événement, ajustement manuel, système). */
export const TransactionRefTypeSchema = z.enum(["contract", "listing", "event", "manual", "system"]);
export type TransactionRefType = z.infer<typeof TransactionRefTypeSchema>;

/** Transaction renvoyée par l'API : utilisateur/quartier concernés, sens, montant (négatif possible pour un débit) et ressource référencée. */
export const TransactionResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique transaction identifier" }),
    userId: z.string().openapi({ description: "ID of the user this transaction belongs to" }),
    districtId: z.string().openapi({ description: "District of the user this transaction belongs to" }),
    type: TransactionTypeSchema.openapi({ description: "Direction of the points movement" }),
    amount: z.number().int().openapi({ description: "Amount in tokens (can be negative for debits)" }),
    refId: z.string().optional().openapi({ description: "ID of the referenced resource" }),
    refType: TransactionRefTypeSchema.optional().openapi({ description: "Type of the referenced resource" }),
    createdAt: z.string().datetime(),
  })
  .openapi({ title: "TransactionResponse" });
export type TransactionResponseDto = z.infer<typeof TransactionResponseDtoSchema>;

// Corps de création d'un mouvement. Le montant est toujours positif ; le sens se
// déduit des extrémités : `fromUserId` seul => débit, `toUserId` seul => crédit,
// les deux => transfert (le serveur écrit alors les deux jambes).
/** Corps de création d'une transaction de points (crédit, débit ou transfert). */
export const CreateTransactionDtoSchema = z
  .object({
    fromUserId: z.string().optional().openapi({ description: "Source user (omit for credits from the system)" }),
    toUserId: z.string().optional().openapi({ description: "Destination user (omit for pure debits)" }),
    amount: z.number().int().positive().openapi({ description: "Amount in tokens (positive)" }),
    refId: z.string().optional(),
    refType: TransactionRefTypeSchema.optional(),
  })
  .openapi({ title: "CreateTransaction" });
export type CreateTransactionDto = z.infer<typeof CreateTransactionDtoSchema>;

/** Param de route : identifiant de la transaction ciblée. */
export const TransactionParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "TransactionParams" });
export type TransactionParamsDto = z.infer<typeof TransactionParamsDtoSchema>;

/** Query d'historique des transactions : pagination et filtres (utilisateur, quartier, sens, type de ressource). */
export const TransactionQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    userId: z.string().optional(),
    districtId: z.string().optional(),
    type: TransactionTypeSchema.optional(),
    refType: TransactionRefTypeSchema.optional(),
  })
  .openapi({ title: "TransactionQuery" });
export type TransactionQueryDto = z.infer<typeof TransactionQueryDtoSchema>;
export type TransactionQueryInput = z.input<typeof TransactionQueryDtoSchema>;

/** Solde de points d'un utilisateur (somme de ses transactions). */
export const UserBalanceResponseDtoSchema = z
  .object({
    userId: z.string(),
    balance: z.number().int(),
  })
  .openapi({ title: "UserBalanceResponse" });
export type UserBalanceResponseDto = z.infer<typeof UserBalanceResponseDtoSchema>;

/** Param de route pour l'historique d'un utilisateur donné (`id` = identifiant de l'utilisateur). */
export const UserTransactionsParamsDtoSchema = z
  .object({ id: z.string() })
  .openapi({ title: "UserTransactionsParams" });
export type UserTransactionsParamsDto = z.infer<typeof UserTransactionsParamsDtoSchema>;
