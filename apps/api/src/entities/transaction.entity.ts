import { z } from "zod";

export const TransactionTypeSchema = z.enum(["credit", "debit", "transfer_in", "transfer_out"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionRefTypeSchema = z.enum(["contract", "listing", "event", "manual", "system"]);
export type TransactionRefType = z.infer<typeof TransactionRefTypeSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: TransactionTypeSchema,
  amount: z.number().int(),
  refId: z.string().optional(),
  refType: TransactionRefTypeSchema.optional(),
  createdAt: z.string().datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
