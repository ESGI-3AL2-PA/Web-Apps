import { z } from "zod";

// Entité Transaction : ligne du grand livre des points d'un utilisateur (crédit,
// débit ou transfert entre membres), rattachée à la ressource qui l'a déclenchée.

// Sens du mouvement : crédit/débit simple, ou les deux jambes d'un transfert (in/out).
export const TransactionTypeSchema = z.enum(["credit", "debit", "transfer_in", "transfer_out"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

// Origine du mouvement : contrat, annonce, événement, geste manuel d'admin, ou système.
export const TransactionRefTypeSchema = z.enum(["contract", "listing", "event", "manual", "system"]);
export type TransactionRefType = z.infer<typeof TransactionRefTypeSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  districtId: z.string(),
  type: TransactionTypeSchema,
  // Montant en points ; entier signé (peut être négatif selon le sens).
  amount: z.number().int(),
  // refId/refType : id + type de la ressource à l'origine du mouvement. Optionnels.
  refId: z.string().optional(),
  refType: TransactionRefTypeSchema.optional(),
  createdAt: z.string().datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
