import { z } from "../zod";

export const TransactionTypeSchema = z.enum(["credit", "debit", "transfer_in", "transfer_out"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionRefTypeSchema = z.enum(["contract", "listing", "event", "manual", "system"]);
export type TransactionRefType = z.infer<typeof TransactionRefTypeSchema>;

export const TransactionResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique transaction identifier" }),
    userId: z.string().openapi({ description: "ID of the user this transaction belongs to" }),
    type: TransactionTypeSchema.openapi({ description: "Direction of the points movement" }),
    amount: z.number().int().openapi({ description: "Amount in tokens (can be negative for debits)" }),
    refId: z.string().optional().openapi({ description: "ID of the referenced resource" }),
    refType: TransactionRefTypeSchema.optional().openapi({ description: "Type of the referenced resource" }),
    createdAt: z.string().datetime(),
  })
  .openapi({ title: "TransactionResponse" });
export type TransactionResponseDto = z.infer<typeof TransactionResponseDtoSchema>;

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

export const TransactionParamsDtoSchema = z
  .object({ id: z.string() })
  .openapi({ title: "TransactionParams" });
export type TransactionParamsDto = z.infer<typeof TransactionParamsDtoSchema>;

export const TransactionQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    userId: z.string().optional(),
    type: TransactionTypeSchema.optional(),
    refType: TransactionRefTypeSchema.optional(),
  })
  .openapi({ title: "TransactionQuery" });
export type TransactionQueryDto = z.infer<typeof TransactionQueryDtoSchema>;

export const UserBalanceResponseDtoSchema = z
  .object({
    userId: z.string(),
    balance: z.number().int(),
  })
  .openapi({ title: "UserBalanceResponse" });
export type UserBalanceResponseDto = z.infer<typeof UserBalanceResponseDtoSchema>;

export const UserTransactionsParamsDtoSchema = z
  .object({ id: z.string() })
  .openapi({ title: "UserTransactionsParams" });
export type UserTransactionsParamsDto = z.infer<typeof UserTransactionsParamsDtoSchema>;
